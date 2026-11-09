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
  Authorized: { label: "Payment authorised", tone: "info" },
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
