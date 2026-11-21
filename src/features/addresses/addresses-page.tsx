import { AccountTabs } from "@/features/account/account-tabs";
import * as React from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BuildingsIcon, MapPinIcon, PencilSimpleIcon, PlusIcon, StarIcon, TrashIcon, UserIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { cn } from "@/lib/utils/cn";
import { countryLabel } from "@/features/verification/countries";
import { ADDRESS_PAGE_SIZE, addressKeys, addressesService, type AddressOwner } from "@/services/addresses.service";
import type { BuyerDeliveryAddressDto } from "@/api/types/addresses";
import { AddressFormDialog } from "./address-form";
import { mapLink } from "./geocode";
import { addressCode, addressMessage } from "./address-messages";
import { useAddressOwner } from "./use-address-owner";

const DENIED = new Set(["BUYER_ADDRESS_ACCESS_DENIED", "BUYER_ADDRESS_PERMISSION_DENIED", "BUYER_ADDRESS_ORG_NOT_ACTIVE", "BUYER_ADDRESS_INDIVIDUAL_BUYER_NOT_FOUND"]);

/** One line: building, street, area, city, emirate, country. */
export function addressLine(a: BuyerDeliveryAddressDto) {
  return [a.unit, a.building, a.street, a.area, a.city, a.stateOrEmirate, a.countryCode === "ARE" ? null : countryLabel(a.countryCode)].filter(Boolean).join(", ");
}

/** /account/addresses: COM-ADDR-01 delivery address book for the individual buyer or the selected company. */
export default function AddressesPage() {
  const ctx = useAddressOwner();
  return (
    <div>
      <AccountTabs />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Delivery addresses</h1>
          <p className="mt-1 text-sm text-muted-foreground">Where sellers deliver your orders. Your default address is preselected at checkout.</p>
        </div>
      </div>
      <div className="mt-5">
        {ctx.loading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : ctx.options.length === 0 ? (
          <EmptyState
            icon={<MapPinIcon />}
            title="Set up your buyer account first"
            description="Delivery addresses belong to your verified buyer account. Complete identity verification, then come back to add addresses."
            action={
              <Button asChild variant="secondary">
                <Link to="/account/verification">Go to verification</Link>
              </Button>
            }
            className="rounded-2xl border border-border bg-surface"
          />
        ) : (
          <>
            {ctx.options.length > 1 && (
              <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Address book">
                <span className="text-sm text-muted-foreground">Showing addresses for</span>
                {ctx.options.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={ctx.selected?.key === o.key}
                    onClick={() => ctx.select(o.key)}
                    className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm", ctx.selected?.key === o.key ? "border-foreground font-semibold" : "border-border")}
                  >
                    {o.owner.kind === "individual" ? <UserIcon className="size-4" aria-hidden /> : <BuildingsIcon className="size-4" aria-hidden />}
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            {ctx.selected ? (
              <AddressBook key={ctx.selected.key} owner={ctx.selected.owner} ownerLabel={ctx.selected.label} />
            ) : (
              <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-body">Choose which address book to open.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AddressBook({ owner, ownerLabel }: { owner: AddressOwner; ownerLabel: string }) {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [showInactive, setShowInactive] = React.useState(false);
  const [editing, setEditing] = React.useState<BuyerDeliveryAddressDto | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState<BuyerDeliveryAddressDto | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const q = useQuery({
    queryKey: addressKeys.list(owner, page, showInactive),
    queryFn: ({ signal }) => addressesService.list(owner, page, showInactive, signal),
    retry: (n, e) => !DENIED.has(addressCode(e) ?? "") && n < 1,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: addressKeys.all });
  const items = [...(q.data?.items ?? [])].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || Number(a.status !== "ACTIVE") - Number(b.status !== "ACTIVE"));
  const total = q.data?.totalCount ?? 0;
  const pages = Math.max(1, Math.ceil(total / ADDRESS_PAGE_SIZE));
  const activeCount = items.filter((a) => a.status === "ACTIVE").length;
  const noDefault = activeCount > 0 && !items.some((a) => a.isDefault && a.status === "ACTIVE");

  const act = async (id: string, run: () => Promise<unknown>, ok: string) => {
    setBusyId(id);
    setNotice(null);
    try {
      await run();
      setNotice({ tone: "ok", text: ok });
    } catch (e) {
      setNotice({ tone: "error", text: addressMessage(e) });
    } finally {
      setBusyId(null);
      void refresh();
    }
  };

  if (q.isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (q.error) {
    const code = addressCode(q.error);
    if (code && DENIED.has(code))
      return (
        <p role="alert" className="rounded-2xl border border-border bg-surface p-6 text-sm text-body">
          {addressMessage(q.error)}
        </p>
      );
    return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  }

  return (
    <section aria-label={`Addresses for ${ownerLabel}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-body">
          <input type="checkbox" className="size-4 accent-foreground" checked={showInactive} onChange={(e) => (setShowInactive(e.target.checked), setPage(1))} />
          Show removed addresses
        </label>
        <Button onClick={() => (setEditing(null), setFormOpen(true))}>
          <PlusIcon /> Add address
        </Button>
      </div>

      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"} className={cn("mb-3 rounded-lg p-3 text-sm", notice.tone === "error" ? "bg-danger-soft text-danger-soft-foreground" : "bg-success-soft text-success-soft-foreground")}>
          {notice.text}
        </p>
      )}
      {noDefault && <p className="mb-3 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">You have no default address. Choose one so checkout can preselect it.</p>}

      {items.length === 0 ? (
        <EmptyState
          icon={<MapPinIcon />}
          title="No delivery addresses yet"
          description="Add the sites you want orders delivered to, such as your warehouse or project site."
          action={
            <Button onClick={() => (setEditing(null), setFormOpen(true))}>
              <PlusIcon /> Add your first address
            </Button>
          }
          className="rounded-2xl border border-border bg-surface"
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((a) => {
            const inactive = a.status !== "ACTIVE";
            return (
              <li key={a.addressId} className={cn("flex flex-col rounded-2xl border bg-surface p-4", a.isDefault && !inactive ? "border-foreground" : "border-border", inactive && "opacity-60")}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-heading font-bold text-foreground">{a.label}</p>
                  {a.isDefault && !inactive && <Badge tone="primary">Default</Badge>}
                  {inactive && <Badge tone="neutral">Removed</Badge>}
                  {!inactive && (a.latitude != null && a.longitude != null ? (
                    <a href={mapLink({ lat: a.latitude, lng: a.longitude })} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline">
                      <MapPinIcon className="size-3.5" weight="fill" aria-hidden /> Map pin
                    </a>
                  ) : (
                    <>
                      <Badge tone="warning">Map pin missing</Badge>
                      <button type="button" onClick={() => (setEditing(a), setFormOpen(true))} className="inline-flex min-h-8 items-center gap-1 text-xs font-medium text-foreground underline underline-offset-4">
                        <MapPinIcon className="size-3.5" aria-hidden /> Add delivery pin
                      </button>
                    </>
                  ))}
                </div>
                <p className="mt-1 text-sm text-body">{addressLine(a)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {a.contactName} · <span dir="ltr">{a.contactPhone}</span>
                </p>
                {a.siteName && <p className="text-xs text-muted-foreground">Site: {a.siteName}</p>}
                {!inactive && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button size="sm" variant="ghost" onClick={() => (setEditing(a), setFormOpen(true))} disabled={busyId === a.addressId}>
                      <PencilSimpleIcon /> Edit
                    </Button>
                    {!a.isDefault && (
                      <Button size="sm" variant="ghost" loading={busyId === a.addressId} onClick={() => void act(a.addressId, () => addressesService.setDefault(owner, a.addressId), `"${a.label}" is now your default address.`)}>
                        <StarIcon /> Make default
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="ml-auto text-danger-soft-foreground" onClick={() => setRemoving(a)} disabled={busyId === a.addressId}>
                      <TrashIcon /> Remove
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <AddressFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        owner={owner}
        editing={editing}
        firstAddress={!editing && total === 0}
        onSaved={(a) => {
          setNotice({ tone: "ok", text: editing ? "Address updated." : `"${a.label}" was added.` });
          void refresh();
        }}
        onConflict={() => void refresh()}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this address?"
        description={
          removing?.isDefault
            ? `"${removing.label}" is your default. After removing it, choose another default address.`
            : `"${removing?.label ?? ""}" will no longer be offered at checkout. Removed addresses can't be restored.`
        }
        confirmLabel="Remove address"
        loading={!!removing && busyId === removing.addressId}
        onConfirm={() => {
          const a = removing;
          if (!a) return;
          void act(a.addressId, () => addressesService.deactivate(owner, a.addressId, a.rowVersion), `"${a.label}" was removed.`).then(() => setRemoving(null));
        }}
      />
    </section>
  );
}
