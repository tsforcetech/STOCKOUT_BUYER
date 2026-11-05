import { Link } from "react-router";
import { ArrowLeftIcon, ReceiptIcon } from "@phosphor-icons/react";

/**
 * Shown on order detail routes while the order read API doesn't exist (ORDER_API flags are false). Nothing is
 * fetched and no order data is invented.
 */
export function OrderUnavailable({ back, backLabel }: { back: string; backLabel: string }) {
  return (
    <div>
      <Link to={back} className="inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> {backLabel}
      </Link>
      <div className="mt-3 rounded-2xl border border-border bg-surface p-8 text-center sm:p-12">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-cream">
          <ReceiptIcon className="size-7 text-foreground" />
        </span>
        <p className="mt-4 font-heading text-lg font-bold text-foreground">Order details aren&apos;t available yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-body">Orders can&apos;t be placed on StockOut yet, so there are no orders to show. This page will show the order once online ordering opens.</p>
      </div>
    </div>
  );
}
