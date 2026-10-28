import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArchiveIcon, PaperPlaneTiltIcon, PauseIcon, PercentIcon, PlayIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { getSellerListingActions, type SellerListingListItemResponse } from "@/api/types/seller-listings";
import { sellerErrorMessage } from "../lib/errors";
import { setDraftPrice } from "../lib/listing-quick-edit";
import { sellerKeys } from "../lib/queries";
import { runLifecycleAction, type LifecycleAction } from "./listing-lifecycle";

type BulkAction = LifecycleAction | "price";

const DONE: Record<BulkAction, string> = {
  pause: "Paused",
  resume: "Live again",
  submit: "Sent for review",
  archive: "Archived",
  price: "Repriced",
};

const can = (l: SellerListingListItemResponse) => getSellerListingActions({ status: l.status, currentDraftVersionId: l.currentDraftVersionId, expiresAtUtc: null });
const isPlainDraft = (l: SellerListingListItemResponse) => l.status === "DRAFT" && !!l.currentDraftVersionId && (!l.currentDraftVersionStatus || l.currentDraftVersionStatus === "DRAFT");

const ELIGIBLE: Record<BulkAction, (l: SellerListingListItemResponse) => boolean> = {
  pause: (l) => can(l).canPause,
  resume: (l) => can(l).canResume,
  submit: (l) => can(l).canSubmit && isPlainDraft(l),
  archive: (l) => can(l).canArchive && l.status !== "ARCHIVED",
  price: isPlainDraft,
};

/**
 * Actions on the selected listings, run one after another (each needs its own fresh rowVersion), with one
 * summary at the end. Only archive asks first — it can't be undone.
 */
export function BulkBar({ sellerId, selected, onClear }: { sellerId: string; selected: SellerListingListItemResponse[]; onClear: () => void }) {
  const qc = useQueryClient();
  const [running, setRunning] = React.useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = React.useState(false);
  const [priceOpen, setPriceOpen] = React.useState(false);
  const [percent, setPercent] = React.useState("");

  const eligible = (a: BulkAction) => selected.filter(ELIGIBLE[a]);

  const run = async (action: BulkAction, pct?: number) => {
    const targets = eligible(action);
    const failed: Array<{ title: string; message: string }> = [];
    for (const [i, l] of targets.entries()) {
      setRunning(`Working on ${i + 1} of ${targets.length}…`);
      try {
        if (action === "price") await setDraftPrice(qc, sellerId, l.listingId, (p) => p * (1 + pct! / 100));
        else await runLifecycleAction(qc, sellerId, action, l.listingId);
      } catch (error) {
        failed.push({ title: l.title, message: sellerErrorMessage(error) });
      }
    }
    setRunning(null);
    void qc.invalidateQueries({ queryKey: sellerKeys.listings(sellerId) });
    const ok = targets.length - failed.length;
    const skipped = selected.length - targets.length;
    const parts = [`${DONE[action]}: ${ok}`, failed.length ? `failed: ${failed.length}` : "", skipped ? `skipped (not possible for their status): ${skipped}` : ""].filter(Boolean);
    const detail = failed.length ? failed.slice(0, 3).map((f) => `“${f.title}” — ${f.message}`).join("\n") : undefined;
    if (failed.length) toast.error(parts.join(" · "), { description: detail, duration: 12_000 });
    else toast.success(parts.join(" · "));
    if (!failed.length) onClear();
  };

  const busy = running !== null;
  const btn = (action: BulkAction, label: string, icon: React.ReactNode, onClick: () => void, tone?: "danger") => {
    const n = eligible(action).length;
    return (
      <Button variant="secondary" size="sm" disabled={busy || n === 0} onClick={onClick} className={tone === "danger" ? "text-danger-soft-foreground" : undefined}>
        {icon} {label}
        {n > 0 && n < selected.length ? ` (${n})` : ""}
      </Button>
    );
  };

  const pct = Number(percent);
  const pctValid = percent.trim() !== "" && /^[-+]?\d+(\.\d{1,2})?$/.test(percent.trim()) && pct !== 0 && pct > -100;

  return (
    <div className="sticky top-[72px] z-20 mb-4 rounded-xl border border-foreground/20 bg-surface p-3 shadow-raised" role="region" aria-label="Bulk actions">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium text-foreground">{selected.length} selected</span>
        {btn("pause", "Pause", <PauseIcon />, () => void run("pause"))}
        {btn("resume", "Resume", <PlayIcon />, () => void run("resume"))}
        {btn("submit", "Send for review", <PaperPlaneTiltIcon />, () => void run("submit"))}
        {btn("price", "Change price", <PercentIcon />, () => setPriceOpen((o) => !o))}
        {btn("archive", "Archive", <ArchiveIcon />, () => setConfirmArchive(true), "danger")}
        <Button variant="ghost" size="sm" disabled={busy} onClick={onClear} className="ml-auto">
          <XIcon /> Clear
        </Button>
      </div>
      {running && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {running}
        </p>
      )}
      {priceOpen && !busy && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pctValid) return;
            setPriceOpen(false);
            void run("price", pct);
            setPercent("");
          }}
        >
          <label className="text-sm text-foreground">
            <span className="mb-1 block">Change the price of {eligible("price").length} draft{eligible("price").length === 1 ? "" : "s"} by (%)</span>
            <input
              className="h-9 w-28 rounded-md border border-border-strong bg-surface px-2 text-sm"
              inputMode="decimal"
              placeholder="e.g. -10"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              aria-label="Price change in percent"
            />
          </label>
          <Button type="submit" size="sm" variant="primary" disabled={!pctValid}>
            Apply
          </Button>
          <p className="w-full text-xs text-muted-foreground">Use a minus for a discount (−10 lowers prices by 10%). Only drafts can be repriced; live listings change through a new draft.</p>
        </form>
      )}
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Archive ${eligible("archive").length} listing${eligible("archive").length === 1 ? "" : "s"}?`}
        description="Archived listings can't be restored. Live listings must be paused first and are skipped."
        confirmLabel="Archive"
        onConfirm={() => {
          setConfirmArchive(false);
          void run("archive");
        }}
      />
    </div>
  );
}
