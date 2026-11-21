import { Link } from "react-router";
import { ReceiptIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { orderKeys, ordersService } from "@/services/orders.service";
import { BuyerOrderList } from "./components/order-views";
import { useOrderPages } from "./use-order-pages";
import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";
import { buyerOrderHeadline, orderBucket } from "./order-status";
import type { MarketplaceOrderDto } from "@/api/types/orders";

const TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

/** All / Active / Completed / Cancelled over the orders loaded so far (counts update as more pages load). */
function OrderTabs({ rows, more }: { rows: MarketplaceOrderDto[]; more: React.ReactNode }) {
  const [tab, setTab] = React.useState<(typeof TABS)[number]["id"]>("all");
  const bucketOf = (o: MarketplaceOrderDto) => orderBucket(buyerOrderHeadline(o.subOrders, o.status).key);
  const count = (id: string) => (id === "all" ? rows.length : rows.filter((o) => bucketOf(o) === id).length);
  const shown = tab === "all" ? rows : rows.filter((o) => bucketOf(o) === tab);
  return (
    <>
      <div role="tablist" aria-label="Filter orders" className="mb-4 flex gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1 [scrollbar-width:none] sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn("shrink-0 cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors", tab === t.id ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {t.label} <span className={cn("ml-1 text-xs", tab === t.id ? "text-action" : "text-muted-foreground")}>{formatNumber(count(t.id))}</span>
          </button>
        ))}
      </div>
      {shown.length ? <BuyerOrderList orders={shown} /> : <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">No {tab} orders.</p>}
      {more}
    </>
  );
}

/** /account/orders: GET /api/v1/buyer/orders (read only; buyer taken from the session). */
export default function MyOrdersPage() {
  const q = useOrderPages(orderKeys.buyerList, (page, signal) => ordersService.buyerOrders(page, signal), (o) => o.orderId);
  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">My orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">Orders you've placed on StockOut, newest first.</p>
      <div className="mt-5">
        {q.isLoading ? (
          <OrderListSkeleton />
        ) : q.error && !q.rows.length ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !q.rows.length ? (
          <EmptyState
            icon={<ReceiptIcon />}
            title="No orders yet"
            description="Every purchase you make will appear here with its status."
            action={
              <Button asChild variant="secondary">
                <Link to="/search">Browse marketplace</Link>
              </Button>
            }
            className="rounded-2xl border border-border bg-surface"
          />
        ) : (
          <OrderTabs rows={q.rows} more={<LoadMore q={q} />} />
        )}
      </div>
    </div>
  );
}

export function OrderListSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading orders">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function LoadMore({ q }: { q: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown; error: unknown } }) {
  if (!q.hasNextPage) return null;
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      {q.error ? <p className="text-sm text-danger-soft-foreground">The next page couldn't be loaded.</p> : null}
      <Button variant="secondary" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
        {q.error ? "Try again" : "Load more"}
      </Button>
    </div>
  );
}
