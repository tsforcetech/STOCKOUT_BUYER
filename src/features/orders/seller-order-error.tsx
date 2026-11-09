import { ShieldWarningIcon } from "@phosphor-icons/react";
import { ErrorState } from "@/components/feedback/states";
import { isApiError } from "@/lib/api/errors";

/** 403 MARKETPLACE_SELLER_ACCESS_DENIED / SUB_ORDER_ACCESS_DENIED: say so plainly; never retry with another seller. */
export function SellerOrderError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (isApiError(error) && error.status === 403)
    return (
      <div role="alert" className="rounded-2xl border border-border bg-surface p-8 text-center">
        <ShieldWarningIcon className="mx-auto size-8 text-warning-soft-foreground" aria-hidden />
        <p className="mt-3 font-heading text-lg font-bold text-foreground">You can&apos;t view these orders</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-body">Your account doesn&apos;t have access to this seller&apos;s orders. Ask the business owner to check your role.</p>
      </div>
    );
  return <ErrorState error={error} onRetry={onRetry} />;
}
