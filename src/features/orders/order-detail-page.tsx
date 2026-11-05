import { OrderUnavailable } from "./order-unavailable";

/** /account/orders/:orderId. Becomes BuyerOrderDetail once GET /api/v1/orders/{orderId} exists (ORDER_API.buyerOrderDetail). */
export default function OrderDetailPage() {
  return <OrderUnavailable back="/account/orders" backLabel="My orders" />;
}
