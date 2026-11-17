/**
 * COM-ORD-01 order placement outcomes (handoff 17 Nov 2026). Placement is still off (ORDER_API.placeOrder = false);
 * this is the agreed handling, ready for when the POST is approved:
 * - ORDER_COMMIT_UNCERTAIN / ORDER_COMMIT_UNCERTAIN_RECOVERY_ENQUEUE_FAILED: the order may or may not exist. Never
 *   retry automatically and never show success or failure; show a neutral "confirming" state and re-read the buyer's
 *   orders (same idempotency key if the buyer retries).
 * - ORDER_PLACEMENT_DISABLED (503): ordering is closed; keep the order button disabled.
 * Fence / reconciliation states are internal recovery data, never shown as order or payment status.
 */
import { isApiError } from "@/lib/api/errors";

export type PlacementOutcome = "uncertain" | "disabled" | "failed";

export const UNCERTAIN_CODES = new Set(["ORDER_COMMIT_UNCERTAIN", "ORDER_COMMIT_UNCERTAIN_RECOVERY_ENQUEUE_FAILED"]);

export function placementOutcome(error: unknown): PlacementOutcome {
  if (!isApiError(error)) return "failed";
  if (error.code && UNCERTAIN_CODES.has(error.code)) return "uncertain";
  if (error.code === "ORDER_PLACEMENT_DISABLED") return "disabled";
  return "failed";
}

export const PLACEMENT_TEXT: Record<Exclude<PlacementOutcome, "failed">, string> = {
  uncertain: "We're confirming your order status. Please don't place the order again. Check My orders in a few minutes, or contact StockOut support if it doesn't appear.",
  disabled: "Ordering isn't open yet. Your cart is saved.",
};
