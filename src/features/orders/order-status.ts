/** Display labels and badge tones for the order enums (src/api/types/orders.ts). Unknown values are shown humanised, never guessed. */
type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary" | "outline";
type Entry = { label: string; tone: Tone };

const ORDER: Record<string, Entry> = {
  Draft: { label: "Draft", tone: "neutral" },
  PendingConfirmation: { label: "Awaiting seller confirmation", tone: "warning" },
  Confirmed: { label: "Confirmed", tone: "info" },
  InFulfillment: { label: "Being fulfilled", tone: "info" },
  Completed: { label: "Completed", tone: "success" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

const SUBORDER: Record<string, Entry> = {
  PendingConfirmation: { label: "Awaiting confirmation", tone: "warning" },
  Confirmed: { label: "Confirmed", tone: "info" },
  Rejected: { label: "Rejected by seller", tone: "danger" },
  Expired: { label: "Expired", tone: "danger" },
  InFulfillment: { label: "Being fulfilled", tone: "info" },
  Delivered: { label: "Delivered", tone: "success" },
  Accepted: { label: "Accepted", tone: "success" },
  ClaimDisputed: { label: "Claim open", tone: "danger" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

const PAYMENT: Record<string, Entry> = {
  PendingAuthorization: { label: "Payment pending", tone: "warning" },
  Authorized: { label: "Card authorised, not charged yet", tone: "info" },
  CapturePending: { label: "Payment being taken", tone: "info" },
  Captured: { label: "Paid", tone: "success" },
  AuthorizationExpired: { label: "Payment authorisation expired", tone: "danger" },
  Voided: { label: "Payment cancelled", tone: "neutral" },
  RefundPending: { label: "Refund pending", tone: "warning" },
  Refunded: { label: "Refunded", tone: "neutral" },
  Failed: { label: "Payment failed", tone: "danger" },
};

const FULFILMENT: Record<string, Entry> = {
  NotStarted: { label: "Not started", tone: "neutral" },
  Preparing: { label: "Preparing", tone: "info" },
  ReadyForCollection: { label: "Ready for collection", tone: "info" },
  InTransit: { label: "In transit", tone: "info" },
  Delivered: { label: "Delivered", tone: "success" },
  Collected: { label: "Collected", tone: "success" },
};

const CLAIM: Record<string, Entry> = {
  None: { label: "No claim", tone: "neutral" },
  Filed: { label: "Claim filed", tone: "warning" },
  UnderReview: { label: "Claim under review", tone: "warning" },
  Approved: { label: "Claim approved", tone: "success" },
  Rejected: { label: "Claim rejected", tone: "danger" },
  Escalated: { label: "Claim escalated", tone: "danger" },
};

const PAYOUT: Record<string, Entry> = {
  NotEligible: { label: "Not yet eligible", tone: "neutral" },
  HoldingPeriodPendingProof: { label: "Waiting for delivery proof", tone: "warning" },
  HoldingPeriodActive: { label: "In holding period", tone: "info" },
  EligibleForSettlement: { label: "Eligible for payout", tone: "success" },
  HoldPendingDispute: { label: "On hold (dispute)", tone: "danger" },
  Settled: { label: "Paid out", tone: "success" },
};

/** The API sends enum names upper-cased ("PENDINGCONFIRMATION"); history rows use the DB form ("PENDING_CONFIRMATION"). */
const norm = (v: string) => v.replace(/[^a-z0-9]/gi, "").toUpperCase();
const humanizeStatus = (v: string) => v.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const lookup = (map: Record<string, Entry>) => {
  const byKey = new Map(Object.entries(map).map(([k, e]) => [norm(k), e]));
  return (value: string | null | undefined): Entry => (value && byKey.get(norm(value))) || { label: value ? humanizeStatus(value) : "Unknown", tone: "neutral" };
};

export const orderStatus = lookup(ORDER);
export const subOrderStatus = lookup(SUBORDER);
export const paymentStatus = lookup(PAYMENT);
export const fulfilmentStatus = lookup(FULFILMENT);
export const claimStatus = lookup(CLAIM);
export const payoutStatus = lookup(PAYOUT);

/** Any status string (e.g. history from/to): first matching label across the order maps, else humanised. */
export const anyStatusLabel = (value: string | null | undefined): string => {
  if (!value) return "—";
  for (const f of [subOrderStatus, orderStatus, paymentStatus, fulfilmentStatus, claimStatus, payoutStatus]) {
    const e = f(value);
    if (e.label !== humanizeStatus(value)) return e.label;
  }
  return humanizeStatus(value);
};

/** True when an API status string ("READY_FOR_COLLECTION", "ReadyForCollection", …) is the given enum name. */
export const statusIs = (value: string | null | undefined, name: string) => !!value && norm(value) === norm(name);

/**
 * Buyer-facing step of one seller's part of an order, from the sub-order status and its fulfilment status together,
 * so the buyer sees one status instead of "Confirmed" + "Not started" side by side.
 */
export type BuyerStep = Entry & { key: string; next: string };
export function buyerStep(s: { status: string; fulfillmentStatus?: string | null; fulfillmentMethod?: string | null }): BuyerStep {
  const st = norm(s.status ?? "");
  const f = norm(s.fulfillmentStatus ?? "");
  const pickup = !s.fulfillmentMethod || /PICKUP|COLLECT/.test(norm(s.fulfillmentMethod));
  if (st === "PENDINGCONFIRMATION") return { key: "waiting", label: "Waiting for seller to confirm", tone: "warning", next: "The seller has 24 hours to confirm. Your card is only authorised, not charged." };
  if (st === "REJECTED") return { key: "rejected", label: "Rejected by seller", tone: "danger", next: "This seller couldn't fulfil your order. You won't be charged for it." };
  if (st === "EXPIRED") return { key: "expired", label: "Not confirmed in time", tone: "danger", next: "The seller didn't confirm within 24 hours. You won't be charged for it." };
  if (st === "CANCELLED") return { key: "cancelled", label: "Cancelled", tone: "danger", next: "This part of the order was cancelled. You won't be charged for it." };
  if (st === "CLAIMDISPUTED") return { key: "claim", label: "Problem reported", tone: "danger", next: "StockOut is reviewing the problem you reported." };
  if (st === "ACCEPTED") return { key: "done", label: "Completed", tone: "success", next: "You accepted the goods. This part of the order is complete." };
  if (st === "DELIVERED" || f === "COLLECTED" || f === "DELIVERED")
    return { key: "received", label: pickup ? "Collected" : "Delivered", tone: "success", next: "Check the goods, then accept them or report a problem." };
  if (f === "READYFORCOLLECTION") return { key: "ready", label: "Ready for collection", tone: "info", next: "Your order is ready. Collect it from the seller." };
  if (f === "INTRANSIT") return { key: "transit", label: "On the way", tone: "info", next: "Your order is on its way." };
  // Neutral wording here: the recorded fulfilment method isn't reliable yet (BE-30: collection orders saved as delivery).
  if (f === "PREPARING" || st === "INFULFILLMENT") return { key: "preparing", label: "Seller is preparing", tone: "info", next: "We'll let you know when your order is ready." };
  if (st === "CONFIRMED") return { key: "confirmed", label: "Confirmed by seller", tone: "info", next: "The seller is preparing your order. We'll let you know when it's ready." };
  const e = subOrderStatus(s.status);
  return { key: st.toLowerCase(), ...e, next: "" };
}

/** One headline for the whole order: the common step of all sellers, or how many sellers have confirmed. */
export function buyerOrderHeadline(subOrders: Array<{ status: string; fulfillmentStatus?: string | null; fulfillmentMethod?: string | null }>, fallbackStatus: string): BuyerStep {
  if (!subOrders.length) return { key: "order", ...orderStatus(fallbackStatus), next: "" };
  const steps = subOrders.map(buyerStep);
  if (steps.every((x) => x.key === steps[0].key)) return steps[0];
  const confirmed = steps.filter((x) => !["waiting", "rejected", "expired", "cancelled"].includes(x.key)).length;
  const waiting = steps.filter((x) => x.key === "waiting").length;
  if (waiting) return { key: "partial", label: `${confirmed} of ${steps.length} sellers confirmed`, tone: "warning", next: "Each seller confirms their part separately. See each seller below." };
  return { key: "mixed", label: "In progress", tone: "info", next: "Each seller handles their part separately. See each seller below." };
}

/** Plain-language history line for a status change (no backend codes). */
export function historyLine(toStatus: string, fromStatus?: string | null): string {
  const t = norm(toStatus ?? "");
  const map: Record<string, string> = {
    PENDINGCONFIRMATION: "Order placed and sent to the seller to confirm",
    CONFIRMED: "Seller confirmed the order",
    REJECTED: "Seller rejected the order",
    EXPIRED: "Seller didn't confirm in time",
    INFULFILLMENT: "Seller started preparing the order",
    PREPARING: "Seller started preparing the order",
    READYFORCOLLECTION: "Ready for collection",
    INTRANSIT: "On the way",
    DELIVERED: "Delivered / collected",
    COLLECTED: "Collected",
    ACCEPTED: "You accepted the goods",
    CLAIMDISPUTED: "Problem reported",
    COMPLETED: "Order completed",
    CANCELLED: "Order cancelled",
  };
  return map[t] ?? `${fromStatus ? `${anyStatusLabel(fromStatus)} → ` : ""}${anyStatusLabel(toStatus)}`;
}

/** Buyer progress tracker (freight delivery). Index of the step reached; -1 for an ended order (rejected / cancelled). */
export const ORDER_STEPS = ["Placed", "Confirmed", "Preparing", "Delivered", "Completed"] as const;
export function stepIndex(key: string): number {
  switch (key) {
    case "waiting":
    case "partial":
      return 0;
    case "confirmed":
    case "mixed":
      return 1;
    case "preparing":
    case "ready":
    case "transit":
      return 2;
    case "received":
    case "claim":
      return 3;
    case "done":
      return 4;
    default:
      return -1;
  }
}
/** Tab bucket for the order list. */
export function orderBucket(key: string): "active" | "completed" | "cancelled" {
  if (key === "done") return "completed";
  if (["rejected", "expired", "cancelled"].includes(key)) return "cancelled";
  return "active";
}
