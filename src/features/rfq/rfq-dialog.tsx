import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog as DialogPrimitive, Tabs } from "radix-ui";
import {
  ClipboardTextIcon,
  FileArrowUpIcon,
  FileTextIcon,
  LockSimpleIcon,
  PencilSimpleLineIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils/cn";
import { catalogService } from "@/services/catalog.service";
import { EMIRATES } from "@/features/search/lib/search-params";
import { useFileDrop } from "@/features/seller/lib/file-drop";
import { RFQ_SUBMIT_LIVE } from "./lib/flags";
import { EMPTY_DRAFT, loadDraft, saveDraft, type RfqDraft } from "./lib/draft";

/** Where the buyer opened the RFQ from; sent with the request once the API exists, for marketing attribution. */
export type RfqSource =
  | "search-empty"
  | "search-results"
  | "cart"
  | "listing"
  | "home"
  | "categories"
  | "footer";

export interface OpenRfqOptions {
  source: RfqSource;
  /** Fields to fill in (only empty fields are overwritten, so a saved draft isn't lost). */
  prefill?: Partial<
    Pick<RfqDraft, "item" | "categoryId" | "quantity" | "unit" | "details">
  >;
  /** One line explaining the context, e.g. "Need more than 120 m² of Glass Office Partition?" */
  context?: string;
  tab?: "type" | "upload";
}

const RfqContext = React.createContext<
  ((options: OpenRfqOptions) => void) | null
>(null);

const ACCEPT =
  ".pdf,.xls,.xlsx,.csv,.doc,.docx,image/jpeg,image/png,image/webp";
const MAX_FILES = 5;
const MAX_BYTES = 20 * 1024 * 1024;
const UNITS = [
  "pcs",
  "box",
  "carton",
  "set",
  "m",
  "m²",
  "m³",
  "kg",
  "ton",
  "litre",
  "roll",
  "sheet",
  "length",
  "drum",
  "coil",
  "pallet",
];

/** Request-for-quote popup: buyers describe what they couldn't find (typed, or a BOQ / spec file) and sellers quote. */
export function RfqProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<OpenRfqOptions>({
    source: "footer",
  });
  const [session, setSession] = React.useState(0);

  const openRfq = React.useCallback((o: OpenRfqOptions) => {
    setOptions(o);
    setSession((s) => s + 1);
    setOpen(true);
  }, []);

  return (
    <RfqContext.Provider value={openRfq}>
      {children}
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
          <DialogPrimitive.Content
            onOpenAutoFocus={(event) => {
              const field = (
                event.currentTarget as HTMLElement | null
              )?.querySelector<HTMLInputElement>("#rfq-item");
              if (field) {
                event.preventDefault();
                field.focus();
              }
            }}
            className={cn(
              "fixed inset-0 z-[55] flex flex-col bg-surface shadow-raised focus:outline-none data-[state=open]:animate-[fade-in_150ms_ease-out]",
              "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:w-[620px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            )}
          >
            <RfqForm
              key={session}
              options={options}
              onClose={() => setOpen(false)}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </RfqContext.Provider>
  );
}

/** Opens the RFQ popup. Outside the provider (a page rendered on its own) it does nothing. */
export function useRfq(): (options: OpenRfqOptions) => void {
  return React.useContext(RfqContext) ?? noop;
}
const noop = () => undefined;

function RfqForm({
  options,
  onClose,
}: {
  options: OpenRfqOptions;
  onClose: () => void;
}) {
  const { status } = useAuth();
  const [draft, setDraft] = React.useState<RfqDraft>(() => {
    const saved = loadDraft();
    const merged = { ...saved };
    for (const [k, v] of Object.entries(options.prefill ?? {}) as Array<
      [keyof RfqDraft, string | undefined]
    >) {
      if (v && !merged[k].trim()) merged[k] = v;
    }
    return merged;
  });
  const [tab, setTab] = React.useState(options.tab ?? "type");
  const [files, setFiles] = React.useState<File[]>([]);

  React.useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const tree = useQuery({
    queryKey: ["catalog", "tree"],
    queryFn: ({ signal }) => catalogService.categoryTree(signal),
    staleTime: 10 * 60_000,
  });
  const categories = (tree.data ?? []).flatMap((root) => [
    { id: root.categoryId, name: root.name },
    ...(root.children ?? []).map((c) => ({
      id: c.categoryId,
      name: `${root.name} › ${c.name}`,
    })),
  ]);

  const set =
    (key: keyof RfqDraft) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setDraft((d) => ({ ...d, [key]: e.target.value }));

  const addFiles = React.useCallback((incoming: File[]) => {
    const tooBig = incoming.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length)
      toast.error(
        `${tooBig.map((f) => f.name).join(", ")} ${tooBig.length === 1 ? "is" : "are"} over 20 MB.`,
      );
    setFiles((cur) => {
      const next = [
        ...cur,
        ...incoming.filter(
          (f) =>
            f.size <= MAX_BYTES &&
            !cur.some((c) => c.name === f.name && c.size === f.size),
        ),
      ];
      if (next.length > MAX_FILES)
        toast.error(`Attach up to ${MAX_FILES} files.`);
      return next.slice(0, MAX_FILES);
    });
  }, []);
  const drop = useFileDrop({
    accept: ACCEPT,
    multiple: true,
    onFiles: addFiles,
  });
  const inputRef = React.useRef<HTMLInputElement>(null);

  const hasContent = !!(
    draft.item.trim() ||
    files.length ||
    draft.fileNote.trim()
  );

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-7">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-eyebrow font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <ClipboardTextIcon className="size-4" /> Request for quote
          </p>
          <DialogPrimitive.Title className="mt-1 font-heading text-[24px] font-bold leading-8 tracking-tight text-foreground">
            Tell us what you need
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
            {options.context ??
              "Verified sellers with matching stock send you a quote. Free, no obligation."}
          </DialogPrimitive.Description>
        </div>
        <DialogPrimitive.Close
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "-mr-2 shrink-0",
          )}
          aria-label="Close"
        >
          <XIcon />
        </DialogPrimitive.Close>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
        <Tabs.Root
          value={tab}
          onValueChange={(v) => setTab(v as "type" | "upload")}
        >
          <Tabs.List
            aria-label="How to share your requirement"
            className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1"
          >
            {[
              ["type", "Type it", PencilSimpleLineIcon],
              ["upload", "Upload BOQ / file", FileArrowUpIcon],
            ].map(([value, label, Icon]) => {
              const I = Icon as typeof PencilSimpleLineIcon;
              return (
                <Tabs.Trigger
                  key={value as string}
                  value={value as string}
                  className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <I className="size-4" /> {label as string}
                </Tabs.Trigger>
              );
            })}
          </Tabs.List>

          <Tabs.Content
            value="type"
            className="mt-5 space-y-4 focus:outline-none"
          >
            <FormField label="What do you need?" htmlFor="rfq-item" required>
              <Input
                value={draft.item}
                onChange={set("item")}
                placeholder="e.g. PPR pipe PN20, 25 mm"
                maxLength={200}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr]">
              <FormField label="Quantity" htmlFor="rfq-qty">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={draft.quantity}
                  onChange={set("quantity")}
                  placeholder="e.g. 500"
                />
              </FormField>
              <FormField label="Unit" htmlFor="rfq-unit">
                <Input
                  value={draft.unit}
                  onChange={set("unit")}
                  list="rfq-units"
                  placeholder="e.g. m, pcs, ton"
                  maxLength={30}
                />
              </FormField>
              <datalist id="rfq-units">
                {UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
            <FormField
              label="Category"
              htmlFor="rfq-category"
              hint="Helps us reach the right sellers."
            >
              <NativeSelect
                value={draft.categoryId}
                onChange={set("categoryId")}
              >
                <option value="">Not sure</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Specifications, brand or grade"
              htmlFor="rfq-details"
            >
              <Textarea
                value={draft.details}
                onChange={set("details")}
                rows={3}
                maxLength={2000}
                placeholder="Size, standard, brand, condition (new / used), certificates…"
              />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                label="Target price (AED)"
                htmlFor="rfq-price"
                hint="Per unit, optional"
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={draft.targetPrice}
                  onChange={set("targetPrice")}
                />
              </FormField>
              <FormField label="Deliver to" htmlFor="rfq-emirate">
                <NativeSelect value={draft.emirate} onChange={set("emirate")}>
                  <option value="">Any emirate</option>
                  {EMIRATES.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label="Needed by" htmlFor="rfq-date">
                <Input
                  type="date"
                  value={draft.neededBy}
                  onChange={set("neededBy")}
                  min={new Date().toISOString().slice(0, 10)}
                />
              </FormField>
            </div>
          </Tabs.Content>

          <Tabs.Content
            value="upload"
            className="mt-5 space-y-4 focus:outline-none"
          >
            <div
              {...drop.handlers}
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              aria-label="Add BOQ or specification files"
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-strong bg-surface-muted/60 px-6 py-8 text-center transition-colors hover:border-foreground/40",
                drop.over && "border-action-border bg-action-soft",
              )}
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-surface text-foreground shadow-raised">
                <FileArrowUpIcon className="size-6" />
              </span>
              <p className="font-heading text-[15px] font-bold text-foreground">
                {drop.over
                  ? "Drop files to attach"
                  : "Drag your BOQ, material list or drawings here"}
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse · PDF, Excel, CSV, Word, JPG, PNG · up to{" "}
                {MAX_FILES} files, 20 MB each
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  drop.take(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            {files.length > 0 && (
              <ul
                className="divide-y divide-border rounded-xl border border-border"
                aria-label="Attached files"
              >
                {files.map((f) => (
                  <li
                    key={`${f.name}-${f.size}`}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm"
                  >
                    <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {f.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(f.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setFiles((cur) => cur.filter((c) => c !== f))
                      }
                      aria-label={`Remove ${f.name}`}
                      className="cursor-pointer rounded p-1 text-muted-foreground hover:text-danger"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <FormField label="Anything we should know?" htmlFor="rfq-file-note">
              <Textarea
                value={draft.fileNote}
                onChange={set("fileNote")}
                rows={3}
                maxLength={2000}
                placeholder="Project name, delivery site, deadline, acceptable alternatives…"
              />
            </FormField>
          </Tabs.Content>
        </Tabs.Root>
      </div>

      <div className="border-t border-border px-5 py-4 sm:px-7">
        {RFQ_SUBMIT_LIVE ? (
          <p className="mb-3 text-xs text-muted-foreground">
            {status === "authenticated"
              ? "Sellers reply to the contact details on your account."
              : "You'll log in or create a free account when you send, so sellers can reach you."}
          </p>
        ) : (
          <p className="mb-3 flex items-start gap-2 rounded-lg bg-cream p-3 text-xs leading-5 text-body">
            <LockSimpleIcon className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-medium text-foreground">
                Sending RFQs opens soon.
              </span>{" "}
              What you type is saved on this device, so it'll be here when
              sending goes live
              {files.length
                ? " (attached files aren't saved, add them again then)"
                : ""}
              .
            </span>
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setFiles([]);
            }}
            disabled={
              !hasContent && !Object.values(draft).some((v) => v.trim())
            }
            className="cursor-pointer py-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
          >
            Clear form
          </button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 sm:flex-none"
              onClick={onClose}
            >
              {RFQ_SUBMIT_LIVE ? "Cancel" : "Close"}
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              disabled={!RFQ_SUBMIT_LIVE || !hasContent}
            >
              {RFQ_SUBMIT_LIVE ? "Send request" : "Send request · soon"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
