import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircleIcon, HandshakeIcon, PackageIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { isApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/utils/format";
import { orderKeys } from "@/services/orders.service";
import { lifecycleKeys, sellerFulfilmentService } from "@/services/order-lifecycle.service";
import type { SellerSubOrderDto } from "@/api/types/orders";
import type { BuyerOrderClaimDto, OrderDeliveryEvidenceDto } from "@/api/types/order-lifecycle";
import { claimStatus, statusIs } from "./order-status";

/** BD-ORDER-LIFECYCLE-01 error codes (OrderLifecycleService) → seller wording. */
export const LIFECYCLE_MESSAGES: Record<string, string> = {
  CONCURRENCY_CONFLICT: "This order changed since you opened it. We've reloaded it; check it and try again.",
  INVALID_ROW_VERSION: "This order needs reloading. We've refreshed it; try again.",
  INVALID_SUB_ORDER_STATE: "This order can't move to that step from its current status. We've reloaded it.",
  INVALID_FULFILLMENT_METHOD: "This step only applies to orders the buyer collects themselves.",
  SUB_ORDER_NOT_FOUND: "This order no longer exists.",
  FORBIDDEN: "Your role in this seller account can't update this order.",
  MARKETPLACE_SELLER_ACCESS_DENIED: "Your role in this seller account can't update this order.",
  SUB_ORDER_CANCELLED_OR_REJECTED: "This order was cancelled or rejected.",
  LIFECYCLE_ERROR: "We couldn't update this order. Try again.",
};
const RELOAD = new Set(["CONCURRENCY_CONFLICT", "INVALID_ROW_VERSION", "INVALID_SUB_ORDER_STATE"]);
const isPickup = (sub: SellerSubOrderDto) => statusIs(sub.fulfillmentMethod, "BUYER_PICKUP");
const inFulfilment = (sub: SellerSubOrderDto) => statusIs(sub.status, "CONFIRMED") || statusIs(sub.status, "IN_FULFILLMENT");

type Step = "prepare" | "ready" | "collected";

/** The next seller step for this sub-order, or null. Delivery by StockOut is advanced by StockOut operations, not the seller. */
export function nextSellerStep(sub: SellerSubOrderDto): Step | null {
  if (!inFulfilment(sub)) return null;
  const f = sub.fulfillmentStatus;
  if (statusIs(f, "NOT_STARTED") || !f) return "prepare";
  if (!isPickup(sub)) return null;
  if (statusIs(f, "PREPARING")) return "ready";
  if (statusIs(f, "READY_FOR_COLLECTION")) return "collected";
  return null;
}

const STEP: Record<Step, { label: string; title: string; text: string; icon: React.ReactNode }> = {
  prepare: { label: "Start preparing", title: "Start preparing this order?", text: "The buyer sees that you're packing and preparing their order.", icon: <PackageIcon /> },
  ready: { label: "Ready for pickup", title: "Mark ready for pickup?", text: "The buyer is told the goods are ready to collect from you.", icon: <CheckCircleIcon /> },
  collected: { label: "Confirm buyer collected", title: "Confirm the buyer collected the goods?", text: "This records the collection time. The buyer then has 5 days to accept the goods or report a problem.", icon: <HandshakeIcon /> },
};

/**
 * Seller fulfilment actions (BD-ORDER-LIFECYCLE-01), shown only when ORDER_API.sellerFulfilmentActions is on:
 * prepare → (buyer pickup) ready for pickup → confirm collection. Each call sends the sub-order rowVersion; a stale
 * version reloads the order. Buttons lock while a request runs so it is never sent twice.
 */
export function SellerFulfilment({ sellerId, sub }: { sellerId: string; sub: SellerSubOrderDto }) {
  const qc = useQueryClient();
  const step = nextSellerStep(sub);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [proof, setProof] = React.useState("");
  const [remarks, setRemarks] = React.useState("");

  if (!inFulfilment(sub)) return null;
  if (!step)
    return (
      <p className="text-sm text-muted-foreground">
        {isPickup(sub) ? "No fulfilment step is waiting for you." : "StockOut delivers this order. Delivery updates appear here as they happen."}
      </p>
    );

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated =
        step === "prepare"
          ? await sellerFulfilmentService.prepare(sellerId, sub.subOrderId, sub.rowVersion)
          : step === "ready"
            ? await sellerFulfilmentService.readyForPickup(sellerId, sub.subOrderId, sub.rowVersion)
            : await sellerFulfilmentService.confirmCollection(sellerId, sub.subOrderId, sub.rowVersion, proof.trim(), remarks.trim());
      qc.setQueryData(orderKeys.sellerDetail(sellerId, sub.subOrderId), updated);
      void qc.invalidateQueries({ queryKey: orderKeys.sellerList(sellerId) });
      void qc.invalidateQueries({ queryKey: lifecycleKeys.sellerEvidence(sellerId, sub.subOrderId) });
      setOpen(false);
      setProof("");
      setRemarks("");
    } catch (e) {
      const code = isApiError(e) ? e.code : undefined;
      setError((code && LIFECYCLE_MESSAGES[code]) || "We couldn't update this order. Try again.");
      if (code && RELOAD.has(code)) {
        setOpen(false);
        void qc.invalidateQueries({ queryKey: orderKeys.sellerDetail(sellerId, sub.subOrderId) });
      }
    } finally {
      setBusy(false);
    }
  };

  const s = STEP[step];
  return (
    <>
      <Button className="w-full" onClick={() => (setError(null), setOpen(true))} disabled={busy}>
        {s.icon} {s.label}
      </Button>
      {error && !open && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-xs leading-5 text-danger-soft-foreground">
          {error}
        </p>
      )}
      <ConfirmDialog open={open} onOpenChange={(o) => !o && setOpen(false)} title={s.title} description={s.text} confirmLabel={s.label} tone="primary" loading={busy} onConfirm={() => void run()}>
        {step === "collected" && (
          <div className="space-y-3">
            <div>
              <label htmlFor="collect-proof" className="text-sm font-medium text-foreground">
                Collection reference <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input id="collect-proof" className="mt-1.5" value={proof} onChange={(e) => setProof(e.target.value)} maxLength={200} placeholder="Gate pass or delivery note number" />
            </div>
            <div>
              <label htmlFor="collect-remarks" className="text-sm font-medium text-foreground">
                Notes <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Textarea id="collect-remarks" className="mt-1.5" value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} />
            </div>
          </div>
        )}
        {error && open && (
          <p role="alert" className="mt-2 text-xs text-danger-soft-foreground">
            {error}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

const EVIDENCE_LABEL: Record<string, string> = { STOCKOUT_DELIVERY_PROOF: "Delivery proof", BUYER_PICKUP_PROOF: "Collection record", INSPECTION_CHECKLIST: "Inspection checklist" };

/** Read-only delivery evidence and buyer claims for one sub-order (seller or buyer source). */
export function EvidenceAndClaims({ evidence, claims }: { evidence: { data?: OrderDeliveryEvidenceDto[]; isLoading: boolean; error: unknown }; claims: { data?: BuyerOrderClaimDto[]; isLoading: boolean; error: unknown } }) {
  const ev = evidence.data ?? [];
  const cl = claims.data ?? [];
  if (evidence.isLoading || claims.isLoading || (!ev.length && !cl.length)) return null;
  return (
    <div className="space-y-3 text-sm">
      {ev.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Delivery records</h3>
          <ul className="mt-1.5 space-y-1.5">
            {ev.map((e) => (
              <li key={e.evidenceId} className="text-body">
                {EVIDENCE_LABEL[e.evidenceType] ?? e.evidenceType.replace(/_/g, " ").toLowerCase()} · {formatDateTime(e.recordedAtUtc)}
                {e.documentReference && <span className="text-muted-foreground"> · ref {e.documentReference}</span>}
                {e.verificationStatus && <span className="text-muted-foreground"> · {e.verificationStatus.replace(/_/g, " ").toLowerCase()}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {cl.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Claims</h3>
          <ul className="mt-1.5 space-y-2">
            {cl.map((c) => (
              <li key={c.claimId} className="rounded-lg border border-border p-3">
                <p className="font-medium text-foreground">
                  {claimStatus(c.status).label} · {formatDateTime(c.createdAtUtc)}
                </p>
                <p className="mt-0.5 text-body">{c.claimReason}</p>
                {c.resolutionNotes && <p className="mt-1 text-xs text-muted-foreground">Resolution: {c.resolutionNotes}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Seller view of delivery records and buyer claims for a sub-order. */
export function SellerEvidenceAndClaims({ sellerId, subOrderId }: { sellerId: string; subOrderId: string }) {
  const evidence = useQuery({ queryKey: lifecycleKeys.sellerEvidence(sellerId, subOrderId), queryFn: ({ signal }) => sellerFulfilmentService.evidence(sellerId, subOrderId, signal), retry: false });
  const claims = useQuery({ queryKey: lifecycleKeys.sellerClaims(sellerId, subOrderId), queryFn: ({ signal }) => sellerFulfilmentService.claims(sellerId, subOrderId, signal), retry: false });
  const content = <EvidenceAndClaims evidence={evidence} claims={claims} />;
  return (evidence.data?.length || claims.data?.length) ? (
    <section className="rounded-2xl border border-border bg-surface p-4" aria-label="Delivery records and claims">
      {content}
    </section>
  ) : null;
}
