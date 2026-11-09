import { ReceiptIcon } from "@phosphor-icons/react";

/** Same message for an order that doesn't exist and one that belongs to someone else (no ownership leak). */
export function OrderNotFound() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center sm:p-12">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-cream">
        <ReceiptIcon className="size-7 text-foreground" />
      </span>
      <p className="mt-4 font-heading text-lg font-bold text-foreground">Order not found</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-body">We couldn&apos;t find this order in your account. Check the link, or go back to your orders.</p>
    </div>
  );
}
