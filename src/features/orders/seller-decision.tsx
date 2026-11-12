import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { isApiError } from "@/lib/api/errors";
import { orderKeys, sellerOrderActions } from "@/services/orders.service";
import type { SellerSubOrderDto } from "@/api/types/orders";
import { isPendingConfirmation } from "./components/seller-sla";

const MESSAGES: Record<string, string> = {
  SUB_ORDER_FINALIZED_BY_ADMIN: "StockOut has already decided this order, so it can no longer be confirmed or rejected.",
  SUB_ORDER_CONCURRENCY_CONFLICT: "This order changed since you opened it. We've reloaded it; check it and try again.",
  CONCURRENCY_CONFLICT: "This order changed since you opened it. We've reloaded it; check it and try again.",
  INVALID_ROW_VERSION: "This order needs reloading. We've refreshed it; try again.",
  MANDATORY_REJECTION_REASON: "Tell the buyer why you're rejecting this order.",
  SUB_ORDER_NOT_FOUND: "This order no longer exists.",
};
const RELOAD = new Set(["SUB_ORDER_FINALIZED_BY_ADMIN", "SUB_ORDER_CONCURRENCY_CONFLICT", "CONCURRENCY_CONFLICT", "INVALID_ROW_VERSION"]);

/**
 * Stage 8C.9 seller decision: confirm, or reject with a mandatory reason. Allowed while the suborder awaits
 * confirmation, including after escalation, until StockOut finalises it (409 SUB_ORDER_FINALIZED_BY_ADMIN).
 * Sends the suborder's rowVersion; buttons lock while a request runs so it is never sent twice.
 */
export function SellerDecision({ sellerId, sub }: { sellerId: string; sub: SellerSubOrderDto }) {
  const qc = useQueryClient();
  const [dialog, setDialog] = React.useState<"confirm" | "reject" | null>(null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!isPendingConfirmation(sub.status)) return <p className="text-sm text-muted-foreground">No decision needed for this order.</p>;

  const run = async (kind: "confirm" | "reject") => {
    if (busy) return;
    if (kind === "reject" && !reason.trim()) return setError(MESSAGES.MANDATORY_REJECTION_REASON);
    setBusy(true);
    setError(null);
    try {
      const updated = kind === "confirm" ? await sellerOrderActions.confirm(sellerId, sub.subOrderId, sub.rowVersion) : await sellerOrderActions.reject(sellerId, sub.subOrderId, reason.trim(), sub.rowVersion);
      qc.setQueryData(orderKeys.sellerDetail(sellerId, sub.subOrderId), updated);
      void qc.invalidateQueries({ queryKey: orderKeys.sellerList(sellerId) });
      setDialog(null);
      setReason("");
    } catch (e) {
      const code = isApiError(e) ? e.code : undefined;
      setError((code && MESSAGES[code]) || "We couldn't send your decision. Try again.");
      if (code && RELOAD.has(code)) {
        setDialog(null);
        void qc.invalidateQueries({ queryKey: orderKeys.sellerDetail(sellerId, sub.subOrderId) });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button className="w-full" onClick={() => (setError(null), setDialog("confirm"))} disabled={busy}>
        <CheckCircleIcon /> Confirm order
      </Button>
      <Button variant="secondary" className="w-full" onClick={() => (setError(null), setDialog("reject"))} disabled={busy}>
        <XCircleIcon /> Reject order
      </Button>
      {error && !dialog && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-xs leading-5 text-danger-soft-foreground">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={dialog === "confirm"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Confirm this order?"
        description={`You confirm you can supply order ${sub.subOrderNumber} as listed. The buyer is told it's confirmed.`}
        confirmLabel="Confirm order"
        tone="primary"
        loading={busy}
        onConfirm={() => void run("confirm")}
      >
        {error && dialog === "confirm" && <p role="alert" className="text-xs text-danger-soft-foreground">{error}</p>}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === "reject"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Reject this order?"
        description={`Order ${sub.subOrderNumber} will be rejected and the buyer told why. This can't be undone.`}
        confirmLabel="Reject order"
        loading={busy}
        onConfirm={() => void run("reject")}
      >
        <label htmlFor="reject-reason" className="text-sm font-medium text-foreground">
          Reason for the buyer <span className="text-danger">*</span>
        </label>
        <Textarea id="reject-reason" className="mt-1.5" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="For example: material sold out at our Jebel Ali warehouse." />
        {error && dialog === "reject" && <p role="alert" className="mt-1 text-xs text-danger-soft-foreground">{error}</p>}
      </ConfirmDialog>
    </>
  );
}
