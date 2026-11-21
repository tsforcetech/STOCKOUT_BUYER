import * as React from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPinIcon, PlusIcon } from "@phosphor-icons/react";
import { Badge, Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils/cn";
import { addressKeys, addressesService, type AddressOwner } from "@/services/addresses.service";
import type { BuyerDeliveryAddressDto } from "@/api/types/addresses";
import { addressLine } from "./addresses-page";
import { addressMessage } from "./address-messages";
import { AddressFormDialog } from "./address-form";

/**
 * Checkout "Deliver to" (COM-ADDR-01, UI only). Shows the active addresses of the buying context, preselects the
 * default, and keeps only the chosen addressId in page state. Nothing is sent to an order: placing orders and the
 * address snapshot are backend steps that aren't live yet.
 */
export function CheckoutAddressPicker({ owner, onChange }: { owner: AddressOwner | null; onChange?: (addressId: string | null) => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: owner ? addressKeys.active(owner) : ["buyer", "addresses", "none"],
    queryFn: ({ signal }) => addressesService.list(owner!, 1, false, signal),
    enabled: !!owner,
    retry: false,
  });
  const active = (q.data?.items ?? []).filter((a) => a.status === "ACTIVE");
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  // BE-13 remediation: a legacy address without coordinates is edited in place to add its pin.
  const [pinFor, setPinFor] = React.useState<BuyerDeliveryAddressDto | null>(null);
  const fallback = active.find((a) => a.isDefault)?.addressId ?? null;
  const selected = active.some((a) => a.addressId === chosen) ? chosen : fallback;
  React.useEffect(() => onChange?.(selected), [selected, onChange]);

  const header = (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <p className="text-sm font-semibold text-foreground" id="co-deliver-to">
        Deliver to
      </p>
      {owner && active.length > 0 && (
        <Link to="/account/addresses" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Manage addresses
        </Link>
      )}
    </div>
  );

  if (!owner)
    return (
      <div>
        {header}
        <p className="text-sm text-muted-foreground">Choose who is buying (above) to pick a delivery address.</p>
      </div>
    );
  if (q.isLoading)
    return (
      <div>
        {header}
        <Skeleton className="h-24 w-full" />
      </div>
    );
  if (q.error)
    return (
      <div>
        {header}
        <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">{addressMessage(q.error)}</p>
      </div>
    );

  return (
    <div role="radiogroup" aria-labelledby="co-deliver-to">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-foreground" id="co-deliver-to">
          Deliver to
        </p>
        <span className="flex items-center gap-3 text-xs">
          <button type="button" onClick={() => setAdding(true)} className="inline-flex cursor-pointer items-center gap-1 font-medium text-foreground underline underline-offset-4">
            <PlusIcon className="size-3.5" aria-hidden /> Add address
          </button>
          {active.length > 0 && (
            <Link to="/account/addresses" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Manage
            </Link>
          )}
        </span>
      </div>
      {active.length === 0 ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong p-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
        >
          <PlusIcon className="size-4" aria-hidden /> Add a delivery address
        </button>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {active.map((a) => {
            const on = selected === a.addressId;
            const pin = a.latitude != null && a.longitude != null;
            return (
              <label key={a.addressId} className={cn("flex cursor-pointer items-start gap-3 px-4 py-3 text-sm transition-colors", on ? "bg-surface-muted" : "hover:bg-surface-muted/60")}>
                <input type="radio" name="delivery-address" className="mt-0.5 size-4 shrink-0 accent-foreground" checked={on} onChange={() => setChosen(a.addressId)} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{a.label}</span>
                    {a.isDefault && <Badge tone="neutral">Default</Badge>}
                    {!pin && <Badge tone="warning">Map pin missing</Badge>}
                  </span>
                  <span className="mt-0.5 block truncate text-body">{addressLine(a)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {a.contactName} · {a.contactPhone}
                  </span>
                  {!pin && (
                    <button type="button" onClick={() => setPinFor(a)} className="mt-1 inline-flex min-h-8 items-center gap-1 text-xs font-medium text-foreground underline underline-offset-4">
                      <MapPinIcon className="size-3.5" aria-hidden /> Add delivery pin
                    </button>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}
      {active.length > 0 && !selected && <p className="mt-2 text-xs text-warning-soft-foreground">Choose a delivery address.</p>}
      <AddressFormDialog
        open={adding}
        onOpenChange={setAdding}
        owner={owner}
        editing={null}
        firstAddress={active.length === 0}
        onSaved={(a) => {
          setChosen(a.addressId);
          void qc.invalidateQueries({ queryKey: addressKeys.all });
        }}
      />
      <AddressFormDialog
        open={!!pinFor}
        onOpenChange={(o) => !o && setPinFor(null)}
        owner={owner}
        editing={pinFor}
        firstAddress={false}
        onSaved={() => void qc.invalidateQueries({ queryKey: addressKeys.all })}
      />
    </div>
  );
}
