import { Link } from "react-router";
import { ListNumbersIcon, ReceiptIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { EmptyState } from "@/components/feedback/states";
import { useActiveSeller } from "@/features/seller/lib/queries";
import { orderKeys, ordersService } from "@/services/orders.service";
import { SellerOrderList } from "./components/order-views";
import { LoadMore, OrderListSkeleton } from "./my-orders-page";
import { SellerOrderError } from "./seller-order-error";
import { useOrderPages } from "./use-order-pages";

/** /seller/orders: GET /api/v1/seller/orders for the active seller (read only, no status filter). */
export default function SellerOrdersPage() {
  const seller = useActiveSeller();
  const q = useOrderPages(orderKeys.sellerList(seller.sellerId), (page, signal) => ordersService.sellerOrders(seller.sellerId, page, signal), (s) => s.subOrderId);
  return (
    <>
      <PageHeader eyebrow="Seller portal" title="Orders" description={`Orders buyers have placed for ${seller.displayName}'s listings, newest first.`} />
      {q.isLoading ? (
        <OrderListSkeleton />
      ) : q.error && !q.rows.length ? (
        <SellerOrderError error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.rows.length ? (
        <SectionCard>
          <EmptyState
            icon={<ReceiptIcon />}
            title="No orders yet"
            description="Buyers can't place orders until ordering opens at launch. Orders for your listings will appear here."
            action={
              <Button asChild variant="secondary">
                <Link to="/seller/listings">
                  <ListNumbersIcon /> Manage listings
                </Link>
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <>
          <SellerOrderList subOrders={q.rows} />
          <LoadMore q={q} />
        </>
      )}
    </>
  );
}
