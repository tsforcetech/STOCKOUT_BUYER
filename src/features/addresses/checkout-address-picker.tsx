import * as React from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPinIcon } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils/cn";
import { addressKeys, addressesService, type AddressOwner } from "@/services/addresses.service";
import { addressLine } from "./addresses-page";
import { addressMessage } from "./address-messages";

/**
 * Checkout "Deliver to" (COM-ADDR-01, UI only). Shows the active addresses of the buying context, preselects the
 * default, and keeps only the chosen addressId in page state. Nothing is sent to an order: placing orders and the
 * address snapshot are backend steps that aren't live yet.
 */
export function CheckoutAddressPicker({ owner, onChange }: { owner: AddressOwner | null; onChange?: (addressId: string | null) => void }) {
  const q = useQuery({
    queryKey: owner ? addressKeys.active(owner) : ["buyer", "addresses", "none"],
    queryFn: ({ signal }) => addressesService.list(owner!, 1, false, signal),
    enabled: !!owner,
    retry: false,
  });
  const active = (q.data?.items ?? []).filter((a) => a.status === "ACTIVE");
  const [chosen, setChosen] = React.useState<string | null>(null);
  const fallback = active.find((a) => a.isDefault)?.addressId ?? null;
  const selected = active.some((a) => a.addressId === chosen) ? chosen : fallback;
  React.useEffect(() => onChange?.(selected), [selected, onChange]);

  if (!owner) return <p className="text-sm text-muted-foreground">Choose who is buying (above) to pick a delivery address.</p>;
  if (q.isLoading) return <Skeleton className="h-20 w-full" />;
  if (q.error) return <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">{addressMessage(q.error)}</p>;
  if (active.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-border-strong p-4 text-sm">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <MapPinIcon className="size-4" aria-hidden /> No delivery address yet
        </p>
        <Link to="/account/addresses" className="mt-2 inline-block font-medium underline underline-offset-4">
          Add a delivery address
        </Link>
      </div>
    );
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-foreground">Deliver to</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {active.map((a) => (
          <label key={a.addressId} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3 text-sm", selected === a.addressId ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-border-strong")}>
            <input type="radio" name="delivery-address" className="mt-1 accent-foreground" checked={selected === a.addressId} onChange={() => setChosen(a.addressId)} />
            <span className="min-w-0">
              <span className="font-bold text-foreground">{a.label}</span>
              {a.isDefault && <span className="ml-2 text-xs text-muted-foreground">Default</span>}
              <span className="mt-0.5 block text-muted-foreground">{addressLine(a)}</span>
            </span>
          </label>
        ))}
      </div>
      {!selected && <p className="mt-2 text-xs text-warning-soft-foreground">Choose a delivery address.</p>}
      <Link to="/account/addresses" className="mt-2 inline-block text-xs underline underline-offset-4">
        Manage addresses
      </Link>
    </fieldset>
  );
}
