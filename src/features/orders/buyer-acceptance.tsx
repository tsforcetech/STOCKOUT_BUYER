import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { isApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/utils/format";
import { newId } from "@/lib/utils/id";
import { orderKeys } from "@/services/orders.service";
import { buyerAcceptanceService, lifecycleKeys } from "@/services/order-lifecycle.service";
import type { SellerSubOrderDto } from "@/api/types/orders";
import { statusIs } from "./order-status";
import { EvidenceAndClaims } from "./seller-fulfilment";

/** BD-ORDER-LIFECYCLE-01 buyer codes (OrderLifecycleService) → buyer wording. */
const MESSAGES: Record<string, string> = {
  OPEN_CLAIM_BLOCKS_ACCEPTANCE: "You have an open claim on this order, so it can't be accepted until the claim is resolved.",
  SUB_ORDER_NOT_DELIVERED: "This order hasn't been delivered or collected yet.",
  SUB_ORDER_ALREADY_ACCEPTED: "This order has already been accepted.",
  SUB_ORDER_CANCELLED_OR_REJECTED: "This order was cancelled or rejected.",
  MANDATORY_CLAIM_REASON: "Tell us what's wrong with the goods.",
  INVALID_AFFECTED_QUANTITY: "Enter a quantity between 1 and the quantity you ordered.",
  INVALID_ACCEPTED_QUANTITY: "One of the quantities isn't valid. Reload the order and try again.",
  INVALID_ORDER_LINE: "Choose an item from this order.",
  FIVE_DAY_TIMER_ELAPSED: "The 5-day inspection period for this order has ended.",
  IDEMPOTENCY_CONFLICT: "That request was already used for something else. Reload the order and try again.",
  CONCURRENCY_CONFLICT: "This order changed since you opened it. We've reloaded it; check it and try again.",
  INVALID_ROW_VERSION: "This order needs reloading. We've refreshed it; try again.",
  FORBIDDEN: "Your account can't act on this order.",
};
const RELOAD = new Set(["CONCURRENCY_CONFLICT", "INVALID_ROW_VERSION", "SUB_ORDER_ALREADY_ACCEPTED", "SUB_ORDER_NOT_DELIVERED", "OPEN_CLAIM_BLOCKS_ACCEPTANCE", "FIVE_DAY_TIMER_ELAPSED"]);
const INSPECTION_DAYS = 5;

/**
 * Buyer acceptance and claims for one delivered/collected sub-order (BD-ORDER-LIFECYCLE-01, STK-POL-BSP-001 §10.1),
 * shown only when ORDER_API.buyerAcceptance is on. Accepting sends a fixed Idempotency key per attempt and the
 * sub-order rowVersion; the server timestamps it. Acceptance never implies payment, payout or Green Points.
 */
export function BuyerAcceptance({ orderId, sub }: { orderId: string; sub: SellerSubOrderDto }) {
  const qc = useQueryClient();
  const [dialog, setDialog] = React.useState<"accept" | "claim" | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [key, setKey] = React.useState(newId);
  const [reason, setReason] = React.useState("");
  const [lineId, setLineId] = React.useState("");
  const [qty, setQty] = React.useState("");
  const delivered = statusIs(sub.status, "DELIVERED");
  const accepted = statusIs(sub.status, "ACCEPTED");
  const claimOpen = !!sub.claimStatus && !statusIs(sub.claimStatus, "NONE") && !statusIs(sub.claimStatus, "APPROVED") && !statusIs(sub.claimStatus, "REJECTED");
  const evidence = useQuery({ queryKey: lifecycleKeys.buyerEvidence(sub.subOrderId), queryFn: ({ signal }) => buyerAcceptanceService.evidence(orderId, sub.subOrderId, signal), enabled: delivered || accepted || claimOpen, retry: false });
  const claims = useQuery({ queryKey: lifecycleKeys.buyerClaims(sub.subOrderId), queryFn: ({ signal }) => buyerAcceptanceService.claims(orderId, sub.subOrderId, signal), enabled: delivered || accepted || claimOpen, retry: false });

  if (!delivered && !accepted && !claimOpen) return null;
  const deadline = sub.deliveredAtUtc ? new Date(Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(sub.deliveredAtUtc) ? sub.deliveredAtUtc : `${sub.deliveredAtUtc}Z`) + INSPECTION_DAYS * 86_400_000) : null;
  const line = sub.items.find((i) => i.orderLineId === lineId);

  const done = () => {
    void qc.invalidateQueries({ queryKey: orderKeys.buyerDetail(orderId) });
    void qc.invalidateQueries({ queryKey: orderKeys.buyerList });
    void qc.invalidateQueries({ queryKey: lifecycleKeys.buyerClaims(sub.subOrderId) });
  };
  const fail = (e: unknown) => {
    const code = isApiError(e) ? e.code : undefined;
    setError((code && MESSAGES[code]) || "We couldn't send that. Try again.");
    if (code && RELOAD.has(code)) {
      setDialog(null);
      done();
    }
  };

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Same key on a retry after a timeout: the server returns the first acceptance instead of a second one.
      await buyerAcceptanceService.accept(orderId, sub.subOrderId, { idempotencyKey: key, expectedRowVersion: sub.rowVersion });
      setDialog(null);
      done();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    if (busy) return;
    if (!reason.trim()) return setError(MESSAGES.MANDATORY_CLAIM_REASON);
    const n = qty.trim() ? Number(qty) : null;
    if (n != null && (!Number.isFinite(n) || n <= 0 || (line && n > line.quantity))) return setError(MESSAGES.INVALID_AFFECTED_QUANTITY);
    setBusy(true);
    setError(null);
    try {
      await buyerAcceptanceService.lodgeClaim(orderId, sub.subOrderId, { reason: reason.trim(), orderLineId: lineId || null, affectedQuantity: n, expectedRowVersion: sub.rowVersion });
      setDialog(null);
      setReason("");
      setQty("");
      setLineId("");
      done();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-border px-4 py-3">
      {accepted ? (
        <p role="status" className="flex items-center gap-2 text-sm text-success-soft-foreground">
          <CheckCircleIcon className="size-4" weight="fill" aria-hidden /> You accepted this order.
        </p>
      ) : claimOpen ? (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> Your claim is with StockOut. Acceptance is paused until it's resolved.
        </p>
      ) : (
        <>
          <p className="text-sm text-body">
            Check the goods, then accept them or report a problem
            {deadline ? (
              <>
                {" "}
                by <span className="font-medium text-foreground">{formatDateTime(deadline)}</span>. If you don&apos;t respond by then, the order may be accepted automatically under StockOut&apos;s terms.
              </>
            ) : (
              "."
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => (setError(null), setKey(newId()), setDialog("accept"))} disabled={busy}>
              <CheckCircleIcon /> Accept goods
            </Button>
            <Button size="sm" variant="secondary" onClick={() => (setError(null), setDialog("claim"))} disabled={busy}>
              <WarningCircleIcon /> Report a problem
            </Button>
          </div>
        </>
      )}
      {error && !dialog && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-xs text-danger-soft-foreground">
          {error}
        </p>
      )}
      <EvidenceAndClaims evidence={evidence} claims={claims} />

      <ConfirmDialog
        open={dialog === "accept"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Accept these goods?"
        description={`You confirm the goods in ${sub.subOrderNumber} arrived as described. After accepting you can no longer report a problem through StockOut for this order.`}
        confirmLabel="Accept goods"
        tone="primary"
        loading={busy}
        onConfirm={() => void accept()}
      >
        {error && dialog === "accept" && (
          <p role="alert" className="text-xs text-danger-soft-foreground">
            {error}
          </p>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === "claim"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Report a problem"
        description="Tell StockOut what's wrong. Acceptance is paused while the claim is reviewed."
        confirmLabel="Send claim"
        loading={busy}
        onConfirm={() => void claim()}
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="claim-line" className="text-sm font-medium text-foreground">
              Item <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <select id="claim-line" className="mt-1.5 h-10 w-full rounded-md border border-input bg-surface px-3 text-sm" value={lineId} onChange={(e) => setLineId(e.target.value)}>
              <option value="">Whole order</option>
              {sub.items.map((i) => (
                <option key={i.orderLineId} value={i.orderLineId}>
                  {i.titleSnapshot}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="claim-qty" className="text-sm font-medium text-foreground">
              Quantity affected <span className="font-normal text-muted-foreground">(optional{line ? `, up to ${line.quantity}` : ""})</span>
            </label>
            <Input id="claim-qty" className="mt-1.5" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <label htmlFor="claim-reason" className="text-sm font-medium text-foreground">
              What&apos;s wrong <span className="text-danger">*</span>
            </label>
            <Textarea id="claim-reason" className="mt-1.5" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="For example: 3 of the 10 pipes arrived cracked." />
          </div>
          {error && dialog === "claim" && (
            <p role="alert" className="text-xs text-danger-soft-foreground">
              {error}
            </p>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}
