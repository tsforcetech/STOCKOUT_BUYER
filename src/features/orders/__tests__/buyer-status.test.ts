import { describe, expect, it } from "vitest";
import { buyerOrderHeadline, buyerStep, historyLine } from "../order-status";

describe("one clear buyer status", () => {
  it("seller confirmed + fulfilment not started reads as one step, not two badges", () => {
    expect(buyerStep({ status: "CONFIRMED", fulfillmentStatus: "NOTSTARTED", fulfillmentMethod: "BUYER_PICKUP" }).label).toBe("Confirmed by seller");
    expect(buyerStep({ status: "IN_FULFILLMENT", fulfillmentStatus: "READY_FOR_COLLECTION" }).label).toBe("Ready for collection");
    expect(buyerStep({ status: "PENDINGCONFIRMATION" }).label).toBe("Waiting for seller to confirm");
  });

  it("the order headline follows the sellers even when the parent status still says awaiting (SO-10000001)", () => {
    expect(buyerOrderHeadline([{ status: "CONFIRMED", fulfillmentStatus: "NOTSTARTED" }], "PENDINGCONFIRMATION").label).toBe("Confirmed by seller");
    expect(buyerOrderHeadline([{ status: "CONFIRMED" }, { status: "PENDING_CONFIRMATION" }], "PENDINGCONFIRMATION").label).toBe("1 of 2 sellers confirmed");
  });

  it("history uses plain sentences", () => {
    expect(historyLine("PENDING_CONFIRMATION", "DRAFT")).toBe("Order placed and sent to the seller to confirm");
    expect(historyLine("CONFIRMED", "PENDING_CONFIRMATION")).toBe("Seller confirmed the order");
  });
});
