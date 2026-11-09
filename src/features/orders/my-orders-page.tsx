import { Link } from "react-router";
import { ReceiptIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { orderKeys, ordersService } from "@/services/orders.service";
import { BuyerOrderList } from "./components/order-views";
import { useOrderPages } from "./use-order-pages";

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
            description="Placing orders opens at launch. Once it does, every purchase you make will appear here with its status."
            action={
              <Button asChild variant="secondary">
                <Link to="/search">Browse marketplace</Link>
              </Button>
            }
            className="rounded-2xl border border-border bg-surface"
          />
        ) : (
          <>
            <BuyerOrderList orders={q.rows} />
            <LoadMore q={q} />
          </>
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
