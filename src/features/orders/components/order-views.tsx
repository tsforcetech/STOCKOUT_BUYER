import type * as React from "react";
import { Link } from "react-router";
import { CaretRightIcon, CheckIcon, LockSimpleIcon, StorefrontIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ListingImage, assetUrl } from "@/components/common/listing-image";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/utils/format";
import type { MarketplaceOrderDto, OrderLineSnapshotDto, OrderStatusHistoryDto, SellerSubOrderDto } from "@/api/types/orders";
import { SellerSlaBadge, isPendingConfirmation, slaState, timeLeft, useNow } from "./seller-sla";
import { ORDER_STEPS, buyerOrderHeadline, buyerStep, stepIndex, claimStatus, fulfilmentStatus, historyLine, payoutStatus, paymentStatus, statusIs, subOrderStatus } from "../order-status";
import { ORDER_API } from "@/lib/orders/order-api";
import { BuyerAcceptance } from "../buyer-acceptance";
import { CancelOrderCard, CancelSellerPart, DeliveryAddressCard, ReconciliationNotice } from "../buyer-order-actions";
import { SellerDecision } from "../seller-decision";
import { BuyerOrderImpact } from "@/features/sustainability/impact-report";

/**
 * Read-only order views for the Stage 8C DTOs. Everything shown (amounts, statuses, dates) comes from the API response;
 * nothing is recalculated. There are no actions: placing, confirming, rejecting, dispatching, claims, refunds and
 * payouts have no approved API (ORDER_API in src/lib/orders/order-api.ts).
 */

function StatusBadge({ entry }: { entry: { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" | "primary" | "outline" } }) {
  return (
    <Badge tone={entry.tone} dot>
      {entry.label}
    </Badge>
  );
}

/* ---------------------------------- Buyer: order history ---------------------------------- */

/** Placed → Confirmed → Preparing → Delivered → Completed, from the buyer headline. Ended orders show no tracker. */
export function OrderProgress({ stepKey, compact = false }: { stepKey: string; compact?: boolean }) {
  const at = stepIndex(stepKey);
  if (at < 0) return null;
  return (
    <ol className="flex w-full items-start" aria-label={`Order progress: ${ORDER_STEPS[at]}`}>
      {ORDER_STEPS.map((label, i) => {
        const done = i <= at;
        const current = i === at;
        return (
          <li key={label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center" aria-current={current ? "step" : undefined}>
            <span className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : done ? "bg-foreground" : "bg-border")} />
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full",
                  compact ? "size-3" : "size-6",
                  current ? "bg-action ring-2 ring-foreground" : done ? "bg-foreground" : "border-2 border-border bg-surface",
                )}
              >
                {done && !current && !compact && <CheckIcon className="size-3.5 text-surface" weight="bold" aria-hidden />}
              </span>
              <span className={cn("h-0.5 flex-1", i === ORDER_STEPS.length - 1 ? "bg-transparent" : i < at ? "bg-foreground" : "bg-border")} />
            </span>
            <span className={cn("truncate text-[11px] leading-4", current ? "font-semibold text-foreground" : done ? "text-body" : "text-muted-foreground")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function BuyerOrderList({ orders }: { orders: MarketplaceOrderDto[] }) {
  return (
    <ul className="space-y-3" aria-label="Your orders">
      {orders.map((o) => {
        const head = buyerOrderHeadline(o.subOrders, o.status);
        const items = o.subOrders.flatMap((s) => s.items);
        const sellers = o.subOrders.map((s) => s.sellerTradingName || s.sellerLegalName).filter(Boolean) as string[];
        const ended = stepIndex(head.key) < 0;
        return (
          <li key={o.orderId}>
            <Link to={`/account/orders/${o.orderId}`} className="group block overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:shadow-raised">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-surface-muted/60 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
                <span className="font-heading text-sm font-bold text-foreground">{o.orderNumber}</span>
                <span>Ordered {formatDate(o.orderDateUtc)}</span>
                <span className="ml-auto font-heading text-base font-bold text-foreground">{formatMoney(o.totalPayableAmount, o.currency)}</span>
              </div>
              <div className="flex gap-4 p-4 sm:p-5">
                <div className="relative isolate h-16 w-16 shrink-0 sm:h-20 sm:w-20">
                  {items.slice(0, 3).map((it, i) => (
                    <ListingImage
                      key={it.orderLineId}
                      src={assetUrl(it.thumbnailUrlSnapshot)}
                      alt=""
                      className={cn("absolute size-full rounded-xl border-2 border-surface object-cover", i === 1 && "left-1.5 top-1.5 -z-10 opacity-70", i === 2 && "left-3 top-3 -z-20 opacity-40")}
                    />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-semibold text-foreground group-hover:underline">{items[0]?.titleSnapshot ?? "Order"}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {items.length > 1 ? `+${formatNumber(items.length - 1)} more item${items.length > 2 ? "s" : ""} · ` : ""}
                    {sellers.length === 1 ? `from ${sellers[0]}` : `from ${formatNumber(o.subOrders.length)} sellers`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge entry={head} />
                    <StatusBadge entry={paymentStatus(o.paymentStatus)} />
                  </div>
                </div>
                <CaretRightIcon className="mt-1 size-5 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </div>
              {!ended && (
                <div className="border-t border-border px-4 pb-3 pt-3 sm:px-5">
                  <OrderProgress stepKey={head.key} compact />
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------- Shared: order lines ---------------------------------- */

function Lines({ items, link = false }: { items: OrderLineSnapshotDto[]; link?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((l) => (
        <li key={l.orderLineId} className="flex gap-3 p-4">
          <ListingImage src={assetUrl(l.thumbnailUrlSnapshot)} alt={l.titleSnapshot} className="size-14 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            {link ? (
              <Link to={`/listings/${l.listingId}`} className="line-clamp-2 text-sm font-bold text-foreground hover:underline">
                {l.titleSnapshot}
              </Link>
            ) : (
              <p className="line-clamp-2 text-sm font-bold text-foreground">{l.titleSnapshot}</p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatNumber(l.quantity)} × {formatMoney(l.unitPrice, l.currency)} · VAT {formatNumber(l.taxRatePercent)}% ({formatMoney(l.taxAmount, l.currency)})
              {l.isWholeLot && " · whole lot"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-foreground">{formatMoney(l.lineTotal, l.currency)}</p>
            <p className="text-xs text-muted-foreground">excl. VAT {formatMoney(l.lineSubtotal, l.currency)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Amounts({ rows, currency }: { rows: Array<[string, number, boolean?]>; currency: string }) {
  return (
    <dl className="space-y-2 text-sm">
      {rows.map(([label, value, total]) => (
        <div key={label} className={total ? "flex justify-between border-t border-border pt-2" : "flex justify-between"}>
          <dt className={total ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</dt>
          <dd className={total ? "font-heading text-xl font-bold text-foreground" : "text-foreground"}>{formatMoney(value, currency)}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------------------------------- Buyer: order detail ---------------------------------- */

/** "Seller confirms within 5 h 20 min" for a seller part still waiting (from the server deadline). */
function ConfirmClock({ sub }: { sub: SellerSubOrderDto }) {
  const now = useNow();
  const st = slaState(sub, now);
  if (!st || st.kind !== "due") return null;
  return <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-soft-foreground">Confirms within {timeLeft(st.ms)}</span>;
}

export function BuyerOrderDetail({ order, actions }: { order: MarketplaceOrderDto; actions?: React.ReactNode }) {
  // One status for the buyer, worked out from the sellers' parts (the parent order status lags behind, OJ-14).
  const head = buyerOrderHeadline(order.subOrders, order.status);
  const pay = paymentStatus(order.paymentStatus);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4 lg:col-start-1">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Ordered {formatDateTime(order.orderDateUtc)}</p>
            <h1 className="font-heading text-2xl font-bold text-foreground">Order {order.orderNumber}</h1>
          </div>
          {actions}
        </header>
        <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-label="Order status">
          <p className={cn("font-heading text-xl font-bold", head.tone === "danger" ? "text-danger" : head.tone === "success" ? "text-success" : "text-foreground")}>{head.label}</p>
          {head.next && <p className="mt-1 text-sm text-body">{head.next}</p>}
          {stepIndex(head.key) >= 0 && (
            <div className="mt-4">
              <OrderProgress stepKey={head.key} />
            </div>
          )}
        </section>
        <ReconciliationNotice summary={order.reconciliationSummary} currency={order.currency} />
        {order.subOrders.some((s) => s.isEscalated && isPendingConfirmation(s.status)) && (
          <p role="status" className="rounded-2xl bg-warning-soft p-4 text-sm leading-6 text-warning-soft-foreground">
            One of your sellers is taking longer than usual to confirm. StockOut is following up with them. You don&apos;t need to do anything.
          </p>
        )}
        {order.subOrders.map((s) => {
          const claim = claimStatus(s.claimStatus);
          const hasClaim = !!s.claimStatus && !statusIs(s.claimStatus, "NONE");
          return (
            <section key={s.subOrderId} className="overflow-hidden rounded-2xl border border-border" aria-label={`From ${s.sellerTradingName || s.sellerLegalName || "seller"}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-surface-muted px-4 py-3">
                <p className="flex min-w-0 items-center gap-2 font-bold text-foreground">
                  <StorefrontIcon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{s.sellerTradingName || s.sellerLegalName || "Seller"}</span>
                </p>
                <span className="text-xs text-muted-foreground">{s.subOrderNumber}</span>
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  <ConfirmClock sub={s} />
                  <StatusBadge entry={buyerStep(s)} />
                </span>
              </div>
              {(hasClaim || s.deliveredAtUtc) && (
                <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
                  {s.deliveredAtUtc && <>Delivered {formatDateTime(s.deliveredAtUtc)}</>}
                  {s.deliveredAtUtc && hasClaim && " · "}
                  {hasClaim && claim.label}
                </p>
              )}
              {s.sellerRejectionReason && <p className="border-b border-border bg-danger-soft px-4 py-2 text-sm text-danger-soft-foreground">Seller&apos;s reason: {s.sellerRejectionReason}</p>}
              <Lines items={s.items} link />
              <div className="border-t border-border px-4 py-3">
                <Amounts currency={order.currency} rows={[["Materials", s.materialSubtotal], ["VAT", s.applicableMaterialVat], ["Seller total", s.subOrderTotal, true]]} />
                <div className="-mb-1 mt-1 flex justify-end">
                  <CancelSellerPart order={order} sub={s} />
                </div>
              </div>
              {ORDER_API.buyerAcceptance && <BuyerAcceptance orderId={order.orderId} sub={s} />}
            </section>
          );
        })}
      </div>
      {/* On phones the totals come right after the items, before the history. */}
      <aside className="h-fit space-y-4 rounded-2xl border border-border p-5 lg:sticky lg:top-[176px] lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-label="Order total">
        <h2 className="font-heading text-lg font-bold text-foreground">Order total</h2>
        <Amounts
          currency={order.currency}
          rows={[
            ["Materials", order.aggregateMaterialAmount],
            ["VAT on materials", order.applicableMaterialVat],
            ["Delivery", order.deliveryAmount],
            ["VAT on delivery", order.deliveryVatAmount],
            ["Total payable", order.totalPayableAmount, true],
          ]}
        />
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Payment</span>
          <StatusBadge entry={pay} />
        </div>
        {order.paymentReference && <p className="break-all text-xs text-muted-foreground">Payment reference {order.paymentReference}</p>}
        <p className="rounded-lg bg-cream p-3 text-xs leading-5 text-body">Amounts are shown as recorded on the order. This page isn&apos;t a tax invoice.</p>
        <DeliveryAddressCard order={order} />
        <CancelOrderCard order={order} />
      </aside>
      <div className="min-w-0 space-y-4 lg:col-start-1">
        {ORDER_API.sustainabilityReports && <BuyerOrderImpact orderId={order.orderId} />}
        <History history={order.statusHistory} who="buyer" />
      </div>
    </div>
  );
}

/** Backend reason codes ("ORDER_PLACED_ATOMIC: …") are internal: buyers see plain lines; free-text notes (e.g. a reason) stay. */
const isCodeNote = (n: string | null | undefined) => !!n && /^[A-Z][A-Z0-9_]{3,}(:|$)/.test(n.trim());

function History({ history, title = "History", who }: { history: OrderStatusHistoryDto[] | null | undefined; title?: string; who: "buyer" | "seller" }) {
  const sorted = [...(history ?? [])].sort((a, b) => a.changedAtUtc.localeCompare(b.changedAtUtc));
  // The parent order and each sub-order (and status + fulfilment) record the same step: show it once.
  const rows = sorted.filter((h, i) => !sorted.slice(0, i).some((p) => p.toStatus.toUpperCase().replace(/_/g, "") === h.toStatus.toUpperCase().replace(/_/g, "") && Math.abs(Date.parse(p.changedAtUtc) - Date.parse(h.changedAtUtc)) < 120_000));
  return (
    <section className="rounded-2xl border border-border bg-surface p-4" aria-label={title}>
      <h2 className="font-heading text-lg font-bold text-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No status changes recorded yet.</p>
      ) : (
        <ol className="mt-3 space-y-3 border-l border-border pl-4">
          {rows.map((h) => (
            <li key={h.historyId} className="text-sm">
              <p className="font-medium text-foreground">
                {historyLine(h.toStatus, h.fromStatus, who)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(h.changedAtUtc)}
                {h.reasonOrNote && !isCodeNote(h.reasonOrNote) && ` · ${h.reasonOrNote}`}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ---------------------------------- Seller: suborders ---------------------------------- */

/** "SO-10000002-S2" → "SO-10000002" (the buyer's order number). */
export const parentOrderNumber = (subOrderNumber: string) => subOrderNumber.replace(/-S\d+$/i, "");

/** Seller status with the fulfilment step only when it adds something (no "Confirmed · Not started"). */
function SellerBadges({ sub, claim = false }: { sub: SellerSubOrderDto; claim?: boolean }) {
  const st = subOrderStatus(sub.status);
  const f = fulfilmentStatus(sub.fulfillmentStatus);
  const showF = !!sub.fulfillmentStatus && !statusIs(sub.fulfillmentStatus, "NOT_STARTED") && f.label !== st.label && !isPendingConfirmation(sub.status);
  const showClaim = claim && !!sub.claimStatus && !statusIs(sub.claimStatus, "NONE");
  return (
    <>
      <StatusBadge entry={st} />
      {showF && <StatusBadge entry={f} />}
      {showClaim && <StatusBadge entry={claimStatus(sub.claimStatus)} />}
    </>
  );
}

export function SellerOrderList({ sellerId, subOrders }: { sellerId: string; subOrders: SellerSubOrderDto[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface" aria-label="Orders for your listings">
      {subOrders.map((s) => {
        const isNew = isPendingConfirmation(s.status);
        const first = s.items[0];
        return (
          <li key={s.subOrderId} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center", isNew && "border-l-4 border-l-warning bg-warning-soft/30")}>
            <Link to={`/seller/orders/${s.subOrderId}`} className="group flex min-w-0 flex-1 items-center gap-4">
              <ListingImage src={assetUrl(first?.thumbnailUrlSnapshot)} alt="" className="size-14 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 font-heading font-bold text-foreground group-hover:underline">
                  {isNew && <span className="text-xs font-bold uppercase tracking-wide text-warning-soft-foreground">New</span>}
                  {s.subOrderNumber}
                </p>
                <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                  {first?.titleSnapshot ?? "Order"}
                  {s.items.length > 1 ? ` +${formatNumber(s.items.length - 1)} more` : ""} · {formatDate(s.createdAtUtc)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <SellerBadges sub={s} claim />
                  <SellerSlaBadge sub={s} />
                </div>
              </div>
              <p className="shrink-0 font-heading text-lg font-bold text-foreground">{formatMoney(s.subOrderTotal, first?.currency ?? "AED")}</p>
              <CaretRightIcon className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
            </Link>
            {isNew && (
              <div className="flex shrink-0 gap-2 sm:flex-col">
                <SellerDecision sellerId={sellerId} sub={s} compact />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SellerSubOrderDetail({ sub, actions, children }: { sub: SellerSubOrderDto; actions?: React.ReactNode; children?: React.ReactNode }) {
  const currency = sub.items[0]?.currency ?? "AED";
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <header className="min-w-0 lg:col-start-1">
        <p className="text-sm text-muted-foreground">
          Created {formatDateTime(sub.createdAtUtc)} · Part of buyer order <span className="font-medium text-foreground">{parentOrderNumber(sub.subOrderNumber)}</span>
        </p>
        <h1 className="font-heading text-2xl font-bold text-foreground">Order {sub.subOrderNumber}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <SellerBadges sub={sub} claim />
        </div>
        <div className="mt-3 empty:hidden">
          <SellerSlaBadge sub={sub} detailed />
        </div>
      </header>
      {/* On phones the actions (Confirm / Reject, fulfilment) come right after the header, not below the history. */}
      <aside className="h-fit space-y-3 rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-[176px] lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-label="Order actions">
        <h2 className="font-heading text-lg font-bold text-foreground">{isPendingConfirmation(sub.status) ? "Your decision" : "Next step"}</h2>
        {actions ?? (
          <>
            <Button className="w-full" disabled>
              <LockSimpleIcon /> Confirm order
            </Button>
            <Button variant="secondary" className="w-full" disabled>
              Reject order
            </Button>
          </>
        )}
        {!ORDER_API.sellerFulfilmentActions && (
          <p className="rounded-lg bg-cream p-3 text-xs leading-5 text-body">Dispatch and delivery updates aren&apos;t available yet. They open once the fulfilment rules are approved.</p>
        )}
      </aside>
      <div className="min-w-0 space-y-4 lg:col-start-1">
        <section className="overflow-hidden rounded-2xl border border-border bg-surface" aria-label="Items">
          <Lines items={sub.items} />
          <div className="border-t border-border px-4 py-3">
            <Amounts currency={currency} rows={[["Materials", sub.materialSubtotal], ["VAT", sub.applicableMaterialVat], ["Seller total", sub.subOrderTotal, true]]} />
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-4 text-sm" aria-label="Delivery and payout">
          <h2 className="font-heading text-lg font-bold text-foreground">Delivery & payout</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Purchased" value={formatDateTime(sub.purchasedAtUtc)} />
            <Field label="Confirmed by you" value={formatDateTime(sub.sellerConfirmedAtUtc)} />
            {sub.sellerRejectedAtUtc && <Field label="Rejected" value={`${formatDateTime(sub.sellerRejectedAtUtc)}${sub.sellerRejectionReason ? ` · ${sub.sellerRejectionReason}` : ""}`} />}
            <Field label="Delivered" value={formatDateTime(sub.deliveredAtUtc)} />
            <Field
              label="Delivery proof"
              value={sub.isDeliveryProofVerified ? `Verified ${formatDateTime(sub.deliveryProofVerifiedAtUtc)}${sub.deliveryProofReference ? ` · ref ${sub.deliveryProofReference}` : ""}` : "Not verified yet"}
            />
            <Field
              label="Holding period"
              value={
                sub.holdingPeriodStartDateUtc && sub.holdingPeriodEndDateUtc
                  ? `${formatDate(sub.holdingPeriodStartDateUtc)} – ${formatDate(sub.holdingPeriodEndDateUtc)}`
                  : sub.missingHoldingCalculationDependency
                    ? `Waiting for: ${sub.missingHoldingCalculationDependency}`
                    : "Starts after verified delivery"
              }
            />
            <div>
              <dt className="text-muted-foreground">Payout</dt>
              <dd className="mt-0.5">
                <StatusBadge entry={payoutStatus(sub.payoutEligibility)} />
              </dd>
            </div>
          </dl>
        </section>
        {children}
        <History history={sub.statusHistory} who="seller" />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}
