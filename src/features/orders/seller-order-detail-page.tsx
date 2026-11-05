import { OrderUnavailable } from "./order-unavailable";

/** /seller/orders/:subOrderId. Becomes SellerSubOrderDetail once GET /api/v1/seller/orders/{subOrderId} exists (ORDER_API.sellerOrderDetail). */
export default function SellerOrderDetailPage() {
  return <OrderUnavailable back="/seller/orders" backLabel="Orders" />;
}
