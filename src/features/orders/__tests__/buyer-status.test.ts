import { describe, expect, it } from "vitest";
import { buyerOrderHeadline, buyerStep, historyLine } from "../order-status";

describe("one clear buyer status", () => {
  it("seller confirmed + fulfilment not started reads as one step, not two badges", () => {
    expect(buyerStep({ status: "CONFIRMED", fulfillmentStatus: "NOTSTARTED", fulfillmentMethod: "BUYER_PICKUP" }).label).toBe("Confirmed by seller");
    // Freight-only: ready means ready for dispatch, unless the order is explicitly a pickup.
    expect(buyerStep({ status: "IN_FULFILLMENT", fulfillmentStatus: "READY_FOR_COLLECTION" }).label).toBe("Ready for dispatch");
    expect(buyerStep({ status: "IN_FULFILLMENT", fulfillmentStatus: "READY_FOR_COLLECTION", fulfillmentMethod: "BUYER_PICKUP" }).label).toBe("Ready for collection");
    expect(buyerStep({ status: "DELIVERED", fulfillmentStatus: "DELIVERED" }).label).toBe("Delivered");
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

describe("seller wording and freight steps", () => {
  it("history speaks to the seller in their own words", async () => {
    const { historyLine: h } = await import("../order-status");
    expect(h("CONFIRMED", "PENDING_CONFIRMATION", "seller")).toBe("You confirmed the order");
    expect(h("INTRANSIT", null, "seller")).toBe("On the way to the buyer (StockOut freight)");
    expect(h("DELIVERED", null, "buyer")).toBe("Delivered to your site");
  });
  it("tracker has an On the way step; seller parts show the buyer's order number", async () => {
    const { ORDER_STEPS, stepIndex } = await import("../order-status");
    const { parentOrderNumber } = await import("../components/order-views");
    expect(ORDER_STEPS[stepIndex("transit")]).toBe("On the way");
    expect(ORDER_STEPS[stepIndex("received")]).toBe("Delivered");
    expect(parentOrderNumber("SO-10000002-S2")).toBe("SO-10000002");
  });
});
