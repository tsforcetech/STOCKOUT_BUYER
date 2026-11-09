import { Link } from "react-router";
import { CaretRightIcon, LockSimpleIcon, StorefrontIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ListingImage, assetUrl } from "@/components/common/listing-image";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/utils/format";
import type { MarketplaceOrderDto, OrderLineSnapshotDto, OrderStatusHistoryDto, SellerSubOrderDto } from "@/api/types/orders";
import { anyStatusLabel, claimStatus, fulfilmentStatus, orderStatus, payoutStatus, paymentStatus, subOrderStatus } from "../order-status";

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

export function BuyerOrderList({ orders }: { orders: MarketplaceOrderDto[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border" aria-label="Your orders">
      {orders.map((o) => (
        <li key={o.orderId}>
          <Link to={`/account/orders/${o.orderId}`} className="flex items-center gap-4 p-4 transition hover:bg-surface-muted">
            <div className="min-w-0 flex-1">
              <p className="font-heading font-bold text-foreground">{o.orderNumber}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatDate(o.orderDateUtc)} · {formatNumber(o.subOrders.length)} seller{o.subOrders.length === 1 ? "" : "s"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge entry={orderStatus(o.status)} />
                <StatusBadge entry={paymentStatus(o.paymentStatus)} />
              </div>
            </div>
            <p className="shrink-0 font-heading text-lg font-bold text-foreground">{formatMoney(o.totalPayableAmount, o.currency)}</p>
            <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------- Shared: order lines ---------------------------------- */

function Lines({ items }: { items: OrderLineSnapshotDto[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((l) => (
        <li key={l.orderLineId} className="flex gap-3 p-4">
          <ListingImage src={assetUrl(l.thumbnailUrlSnapshot)} alt={l.titleSnapshot} className="size-14 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-bold text-foreground">{l.titleSnapshot}</p>
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

export function BuyerOrderDetail({ order }: { order: MarketplaceOrderDto }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        <header>
          <p className="text-sm text-muted-foreground">Ordered {formatDateTime(order.orderDateUtc)}</p>
          <h1 className="font-heading text-2xl font-bold text-foreground">Order {order.orderNumber}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge entry={orderStatus(order.status)} />
            <StatusBadge entry={paymentStatus(order.paymentStatus)} />
          </div>
        </header>
        {order.subOrders.map((s) => (
          <section key={s.subOrderId} className="overflow-hidden rounded-2xl border border-border" aria-label={`From ${s.sellerTradingName || s.sellerLegalName || "seller"}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-surface-muted px-4 py-3">
              <p className="flex min-w-0 items-center gap-2 font-bold text-foreground">
                <StorefrontIcon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{s.sellerTradingName || s.sellerLegalName || "Seller"}</span>
              </p>
              <span className="text-xs text-muted-foreground">{s.subOrderNumber}</span>
              <span className="ml-auto flex flex-wrap gap-2">
                <StatusBadge entry={subOrderStatus(s.status)} />
                <StatusBadge entry={fulfilmentStatus(s.fulfillmentStatus)} />
              </span>
            </div>
            {(s.claimStatus && claimStatus(s.claimStatus).label !== "No claim") || s.deliveredAtUtc ? (
              <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
                {s.deliveredAtUtc && <>Delivered {formatDateTime(s.deliveredAtUtc)}</>}
                {s.deliveredAtUtc && claimStatus(s.claimStatus).label !== "No claim" && " · "}
                {claimStatus(s.claimStatus).label !== "No claim" && claimStatus(s.claimStatus).label}
              </p>
            ) : null}
            {s.sellerRejectionReason && <p className="border-b border-border bg-danger-soft px-4 py-2 text-sm text-danger-soft-foreground">Seller's reason: {s.sellerRejectionReason}</p>}
            <Lines items={s.items} />
            <div className="border-t border-border px-4 py-3">
              <Amounts currency={order.currency} rows={[["Materials", s.materialSubtotal], ["VAT", s.applicableMaterialVat], ["Seller total", s.subOrderTotal, true]]} />
            </div>
          </section>
        ))}
        <History history={order.statusHistory} />
      </div>
      <aside className="h-fit space-y-4 rounded-2xl border border-border p-5 lg:sticky lg:top-[176px]" aria-label="Order total">
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
        {order.paymentReference && <p className="break-all text-xs text-muted-foreground">Payment reference {order.paymentReference}</p>}
        <p className="rounded-lg bg-cream p-3 text-xs leading-5 text-body">Amounts are shown as recorded on the order. This page isn&apos;t a tax invoice.</p>
      </aside>
    </div>
  );
}

function History({ history, title = "History" }: { history: OrderStatusHistoryDto[] | null | undefined; title?: string }) {
  const rows = [...(history ?? [])].sort((a, b) => a.changedAtUtc.localeCompare(b.changedAtUtc));
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
                {h.fromStatus ? `${anyStatusLabel(h.fromStatus)} → ` : ""}
                {anyStatusLabel(h.toStatus)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(h.changedAtUtc)}
                {h.reasonOrNote && ` · ${h.reasonOrNote}`}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ---------------------------------- Seller: suborders ---------------------------------- */

export function SellerOrderList({ subOrders }: { subOrders: SellerSubOrderDto[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface" aria-label="Orders for your listings">
      {subOrders.map((s) => (
        <li key={s.subOrderId}>
          <Link to={`/seller/orders/${s.subOrderId}`} className="flex items-center gap-4 p-4 transition hover:bg-surface-muted">
            <div className="min-w-0 flex-1">
              <p className="font-heading font-bold text-foreground">{s.subOrderNumber}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatDate(s.createdAtUtc)} · {s.sellerTradingName || s.sellerLegalName || "Seller"} · {formatNumber(s.items.length)} item{s.items.length === 1 ? "" : "s"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge entry={subOrderStatus(s.status)} />
                <StatusBadge entry={fulfilmentStatus(s.fulfillmentStatus)} />
              </div>
            </div>
            <p className="shrink-0 font-heading text-lg font-bold text-foreground">{formatMoney(s.subOrderTotal, s.items[0]?.currency ?? "AED")}</p>
            <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SellerSubOrderDetail({ sub }: { sub: SellerSubOrderDto }) {
  const currency = sub.items[0]?.currency ?? "AED";
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <header>
          <p className="text-sm text-muted-foreground">
            Created {formatDateTime(sub.createdAtUtc)} · Part of order <span className="font-mono text-xs">{sub.parentOrderId.slice(0, 8).toUpperCase()}</span>
          </p>
          <h1 className="font-heading text-2xl font-bold text-foreground">Order {sub.subOrderNumber}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge entry={subOrderStatus(sub.status)} />
            <StatusBadge entry={fulfilmentStatus(sub.fulfillmentStatus)} />
            <StatusBadge entry={claimStatus(sub.claimStatus)} />
          </div>
        </header>
        <section className="overflow-hidden rounded-2xl border border-border bg-surface" aria-label="Items">
          <Lines items={sub.items} />
          <div className="border-t border-border px-4 py-3">
            <Amounts currency={currency} rows={[["Materials", sub.materialSubtotal], ["VAT", sub.applicableMaterialVat], ["Order total", sub.subOrderTotal, true]]} />
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
        <History history={sub.statusHistory} />
      </div>
      <aside className="h-fit space-y-3 rounded-2xl border border-border bg-surface p-5" aria-label="Order actions">
        <h2 className="font-heading text-lg font-bold text-foreground">Actions</h2>
        <Button className="w-full" disabled>
          <LockSimpleIcon /> Confirm order
        </Button>
        <Button variant="secondary" className="w-full" disabled>
          Reject order
        </Button>
        <p className="rounded-lg bg-cream p-3 text-xs leading-5 text-body">Confirming, rejecting, dispatching and delivery updates aren&apos;t available yet. They open once the seller order rules are approved.</p>
      </aside>
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
