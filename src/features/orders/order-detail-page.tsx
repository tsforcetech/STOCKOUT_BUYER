import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/misc";
import { ErrorState } from "@/components/feedback/states";
import { isApiError } from "@/lib/api/errors";
import { orderKeys, ordersService } from "@/services/orders.service";
import { BuyerOrderDetail } from "./components/order-views";
import { OrderNotFound } from "./order-unavailable";

/** /account/orders/:orderId: GET /api/v1/buyer/orders/{orderId}. 404 covers both "missing" and "someone else's". */
export default function OrderDetailPage() {
  const { orderId = "" } = useParams();
  const q = useQuery({
    queryKey: orderKeys.buyerDetail(orderId),
    queryFn: ({ signal }) => ordersService.buyerOrder(orderId, signal),
    retry: (n, e) => !(isApiError(e) && (e.status === 404 || e.status === 400 || e.status === 403)) && n < 1,
  });
  return (
    <div>
      <Link to="/account/orders" className="inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> My orders
      </Link>
      <div className="mt-3">
        {q.isLoading ? (
          <DetailSkeleton />
        ) : isApiError(q.error) && (q.error.status === 404 || q.error.status === 400) ? (
          <OrderNotFound />
        ) : q.error || !q.data ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : (
          <BuyerOrderDetail order={q.data} />
        )}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]" aria-busy="true" aria-label="Loading order">
      <div className="space-y-4">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
