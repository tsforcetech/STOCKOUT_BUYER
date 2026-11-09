import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { isApiError } from "@/lib/api/errors";
import { useActiveSeller } from "@/features/seller/lib/queries";
import { orderKeys, ordersService } from "@/services/orders.service";
import { SellerSubOrderDetail } from "./components/order-views";
import { DetailSkeleton } from "./order-detail-page";
import { OrderNotFound } from "./order-unavailable";
import { SellerOrderError } from "./seller-order-error";

/** /seller/orders/:subOrderId: GET /api/v1/seller/orders/{subOrderId} for the active seller. Read only. */
export default function SellerOrderDetailPage() {
  const { subOrderId = "" } = useParams();
  const seller = useActiveSeller();
  const q = useQuery({
    queryKey: orderKeys.sellerDetail(seller.sellerId, subOrderId),
    queryFn: ({ signal }) => ordersService.sellerOrder(seller.sellerId, subOrderId, signal),
    retry: (n, e) => !(isApiError(e) && [400, 403, 404].includes(e.status)) && n < 1,
  });
  return (
    <div>
      <Link to="/seller/orders" className="inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> Orders
      </Link>
      <div className="mt-3">
        {q.isLoading ? (
          <DetailSkeleton />
        ) : isApiError(q.error) && (q.error.status === 404 || q.error.status === 400) ? (
          <OrderNotFound />
        ) : q.error || !q.data ? (
          <SellerOrderError error={q.error} onRetry={() => void q.refetch()} />
        ) : (
          <SellerSubOrderDetail sub={q.data} />
        )}
      </div>
    </div>
  );
}
