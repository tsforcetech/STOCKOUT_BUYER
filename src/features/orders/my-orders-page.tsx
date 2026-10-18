import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";
import { OrdersComingSoon } from "./orders-coming-soon";

export default function MyOrdersPage() {
  const cart = useCart();
  return (
    <OrdersComingSoon
      title="My orders"
      intro="Online ordering isn't live on StockOut yet. When it is, every purchase you make will appear here with its status."
      features={["Order status from confirmation to delivery", "Invoices and payment receipts", "Inspection reports for your purchases", "Messages with the seller about each order"]}
      action={
        <Button variant="secondary" onClick={() => cart.setOpen(true)}>
          Open cart
        </Button>
      }
    />
  );
}
