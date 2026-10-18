import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { OrdersComingSoon } from "./orders-coming-soon";

export default function SellerOrdersPage() {
  return (
    <div>
      <OrdersComingSoon
        title="Orders"
        intro="Buyers can't place orders on StockOut yet. Once online ordering is live, orders for your listings will appear here for you to accept and fulfil."
        features={["New orders and buyer details", "Accept, prepare and mark orders as dispatched", "Payouts and invoices", "Stock reserved automatically for open orders"]}
        action={
          <Button asChild variant="secondary">
            <Link to="/seller/listings">Manage listings</Link>
          </Button>
        }
      />
    </div>
  );
}
