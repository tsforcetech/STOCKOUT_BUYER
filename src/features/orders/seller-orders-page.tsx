import { Link } from "react-router";
import { CheckCircleIcon, ListNumbersIcon, ReceiptIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { EmptyState } from "@/components/feedback/states";

const COMING = ["New orders and buyer details", "Accept, prepare and mark orders as dispatched", "Payouts and invoices", "Stock reserved automatically for open orders"];

/**
 * The backend has no order/deal/payment API yet, so the seller orders screen explains what is coming
 * instead of showing data (same truth as the buyer screen, laid out in the seller-portal style).
 */
export default function SellerOrdersPage() {
  return (
    <>
      <PageHeader eyebrow="Seller portal" title="Orders" description="Orders for your listings will appear here once online ordering is live." />
      <div className="space-y-4">
        <SectionCard>
          <EmptyState
            icon={<ReceiptIcon />}
            title="No orders yet"
            description="Buyers can't place orders on StockOut yet. Once online ordering is live, orders for your listings will appear here for you to accept and fulfil."
            action={
              <Button asChild variant="secondary">
                <Link to="/seller/listings">
                  <ListNumbersIcon /> Manage listings
                </Link>
              </Button>
            }
          />
        </SectionCard>
        <SectionCard>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-lg font-bold text-foreground">Coming with online ordering</h2>
            <Badge tone="primary">Coming soon</Badge>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {COMING.map((f) => (
              <li key={f} className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-sm text-body">
                <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
