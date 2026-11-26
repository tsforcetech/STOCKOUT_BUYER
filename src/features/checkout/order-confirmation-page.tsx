import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { BellIcon, CheckCircleIcon, CreditCardIcon, MapPinIcon, StorefrontIcon, TruckIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/utils/format";
import { useSeo } from "@/lib/seo/use-seo";
import { orderKeys, ordersService } from "@/services/orders.service";
import type { MarketplaceOrderDto } from "@/api/types/orders";

/** The order-time delivery address (DeliveryAddressSnapshotJson); read defensively, either casing. */
export function deliveryAddressLines(json: string | null | undefined): { name: string | null; lines: string[] } | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const get = (k: string) => {
      const v = raw[k] ?? raw[k.charAt(0).toUpperCase() + k.slice(1)];
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };
    const lines = [
      [get("label"), get("siteName")].filter(Boolean).join(" · "),
      [get("building"), get("unit"), get("street")].filter(Boolean).join(", "),
      [get("area"), get("city"), get("stateOrEmirate")].filter((v, i, a) => v && a.indexOf(v) === i).join(", "),
    ].filter(Boolean);
    if (!lines.length) return null;
    const name = [get("contactName"), get("contactPhone")].filter(Boolean).join(" · ") || null;
    return { name, lines };
  } catch {
    return null;
  }
}

const earliest = (o: MarketplaceOrderDto) =>
  o.subOrders
    .map((s) => s.confirmationDeadlineUtc)
    .filter((d): d is string => !!d)
    .sort()[0] ?? null;

/**
 * /checkout/complete/:orderId — the page a buyer lands on once the order exists (replaces the checkout in history, so
 * Back never returns to a used checkout). Everything comes from GET /buyer/orders/{id}: reload-safe and authoritative.
 */
export default function OrderConfirmationPage() {
  const { orderId = "" } = useParams();
  useSeo({ title: "Order placed", description: "Your StockOut order is placed.", path: `/checkout/complete/${orderId}`, noindex: true });
  const q = useQuery({ queryKey: orderKeys.buyerDetail(orderId), queryFn: ({ signal }) => ordersService.buyerOrder(orderId, signal), enabled: !!orderId });
  const o = q.data;
  const address = o ? deliveryAddressLines(o.deliveryAddressSnapshotJson) : null;
  const by = o ? earliest(o) : null;
  const items = o ? o.subOrders.reduce((n, s) => n + s.items.length, 0) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-success-soft text-success">
          <CheckCircleIcon className="size-10" weight="fill" aria-hidden />
        </span>
        <h1 className="mt-5 font-heading text-3xl font-bold text-foreground">Thank you, your order is placed</h1>
        {o ? (
          <p className="mt-2 text-base text-body">
            Order <span className="font-semibold text-foreground">{o.orderNumber}</span> · {formatNumber(items)} item{items === 1 ? "" : "s"} from {formatNumber(o.subOrders.length)} seller{o.subOrders.length === 1 ? "" : "s"}
          </p>
        ) : q.isLoading ? (
          <Skeleton className="mx-auto mt-3 h-5 w-64" />
        ) : null}
      </div>

      {q.isLoading ? (
        <div className="mt-8 space-y-3" aria-busy="true">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : q.error || !o ? (
        <p className="mt-8 rounded-2xl bg-cream p-4 text-center text-sm text-body">
          Your order is placed. We couldn&apos;t load its details right now; you&apos;ll find it in My orders.
        </p>
      ) : (
        <>
          <section aria-label="Payment" className="mt-8 flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <CreditCardIcon className="mt-0.5 size-5 shrink-0 text-foreground" aria-hidden />
            <div className="text-sm">
              <p className="font-bold text-foreground">{formatMoney(o.totalPayableAmount, o.currency)} on hold on your card</p>
              <p className="mt-0.5 text-muted-foreground">Not charged yet. You&apos;re charged only for the parts sellers confirm; anything not confirmed is released.</p>
            </div>
          </section>

          <section aria-labelledby="next-h" className="mt-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <h2 id="next-h" className="font-heading text-lg font-bold text-foreground">
              What happens next
            </h2>
            <ol className="mt-4 space-y-4">
              <Step icon={<StorefrontIcon />} title="Sellers confirm your order" text={by ? `By ${formatDateTime(by)}. We'll let you know as each seller confirms.` : "Usually within 24 hours. We'll let you know as each seller confirms."} />
              <Step icon={<CreditCardIcon />} title="Your card is charged" text="Only for the items sellers confirm." />
              <Step icon={<TruckIcon />} title="StockOut delivers to your site" text={`Freight delivery${o.deliveryAmount + o.deliveryVatAmount > 0 ? ` (${formatMoney(o.deliveryAmount + o.deliveryVatAmount, o.currency)}, VAT included)` : ""}. You then have 5 days to check the goods.`} last />
            </ol>
          </section>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <section aria-label="Sellers" className="rounded-2xl border border-border bg-surface p-4 text-sm">
              <h2 className="font-bold text-foreground">Sellers</h2>
              <ul className="mt-2 space-y-2">
                {o.subOrders.map((s) => (
                  <li key={s.subOrderId} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate text-body">{s.sellerTradingName || s.sellerLegalName || s.subOrderNumber}</span>
                    <span className="shrink-0 font-medium text-foreground">{formatMoney(s.subOrderTotal, o.currency)}</span>
                  </li>
                ))}
                {o.deliveryAmount + o.deliveryVatAmount > 0 && (
                  <li className="flex justify-between gap-3 border-t border-border pt-2">
                    <span className="text-body">Freight delivery</span>
                    <span className="font-medium text-foreground">{formatMoney(o.deliveryAmount + o.deliveryVatAmount, o.currency)}</span>
                  </li>
                )}
                <li className="flex justify-between gap-3 border-t border-border pt-2 font-bold text-foreground">
                  <span>Total</span>
                  <span>{formatMoney(o.totalPayableAmount, o.currency)}</span>
                </li>
              </ul>
            </section>
            <section aria-label="Delivery address" className="rounded-2xl border border-border bg-surface p-4 text-sm">
              <h2 className="flex items-center gap-1.5 font-bold text-foreground">
                <MapPinIcon className="size-4" aria-hidden /> Delivering to
              </h2>
              {address ? (
                <div className="mt-2 space-y-0.5 text-body">
                  {address.lines.map((l) => (
                    <p key={l}>{l}</p>
                  ))}
                  {address.name && <p className="text-muted-foreground">{address.name}</p>}
                </div>
              ) : (
                <p className="mt-2 text-muted-foreground">The address you chose at checkout. You can see it on the order.</p>
              )}
            </section>
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <BellIcon className="size-4" aria-hidden /> You&apos;ll get a notification at every step.
          </p>
        </>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg" className="rounded-full">
          <Link to={orderId ? `/account/orders/${orderId}` : "/account/orders"}>View order</Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="rounded-full">
          <Link to="/">Continue shopping</Link>
        </Button>
      </div>
    </div>
  );
}

function Step({ icon, title, text, last = false }: { icon: React.ReactNode; title: string; text: string; last?: boolean }) {
  return (
    <li className="relative flex gap-3">
      {!last && <span aria-hidden className="absolute left-[15px] top-9 h-[calc(100%-1rem)] w-px bg-border" />}
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-muted text-foreground [&>svg]:size-4" aria-hidden>
        {icon}
      </span>
      <div className="text-sm">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-muted-foreground">{text}</p>
      </div>
    </li>
  );
}
