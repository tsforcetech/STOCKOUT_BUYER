import { describe, expect, it } from "vitest";
import type { SellerSubOrderDto } from "@/api/types/orders";
import { dayLabel, matchesSearch, periodStart, sellerView, sortOrders, toCsv } from "../seller-order-filters";

const so = (over: Partial<SellerSubOrderDto>) =>
  ({ subOrderId: "x", subOrderNumber: "SO-10000005-S1", status: "CONFIRMED", fulfillmentStatus: "NOT_STARTED", subOrderTotal: 100, materialSubtotal: 95.24, applicableMaterialVat: 4.76, createdAtUtc: "2026-11-25T10:00:00Z", purchasedAtUtc: null, confirmationDeadlineUtc: null, items: [{ titleSnapshot: "Split AC 2 TR", quantity: 2, currency: "AED" }], ...over }) as unknown as SellerSubOrderDto;

describe("seller order views", () => {
  it("puts each order in one view from status + fulfilment", () => {
    expect(sellerView(so({ status: "PENDING_CONFIRMATION" }))).toBe("confirm");
    expect(sellerView(so({ status: "CONFIRMED" }))).toBe("prepare");
    expect(sellerView(so({ status: "IN_FULFILLMENT", fulfillmentStatus: "PREPARING" }))).toBe("prepare");
    expect(sellerView(so({ status: "IN_FULFILLMENT", fulfillmentStatus: "IN_TRANSIT" }))).toBe("transit");
    expect(sellerView(so({ status: "DELIVERED", fulfillmentStatus: "DELIVERED" }))).toBe("delivered");
    expect(sellerView(so({ status: "ACCEPTED", fulfillmentStatus: "DELIVERED" }))).toBe("completed");
    expect(sellerView(so({ status: "REJECTED" }))).toBe("closed");
    expect(sellerView(so({ status: "CANCELLED" }))).toBe("closed");
  });

  it("filters by period, search and sorts by value or confirm deadline", () => {
    const now = new Date(2026, 10, 27, 15, 0);
    expect(periodStart("today", now)).toBe(new Date(2026, 10, 27).getTime());
    expect(periodStart("month", now)).toBe(new Date(2026, 10, 1).getTime());
    expect(periodStart("all", now)).toBeNull();
    expect(matchesSearch(so({}), "split ac")).toBe(true);
    expect(matchesSearch(so({}), "10000005")).toBe(true);
    expect(matchesSearch(so({}), "pipe")).toBe(false);
    const a = so({ subOrderId: "a", subOrderTotal: 50, status: "PENDING_CONFIRMATION", confirmationDeadlineUtc: "2026-11-28T10:00:00Z" });
    const b = so({ subOrderId: "b", subOrderTotal: 500, status: "PENDING_CONFIRMATION", confirmationDeadlineUtc: "2026-11-27T20:00:00Z" });
    const c = so({ subOrderId: "c", subOrderTotal: 200, createdAtUtc: "2026-11-26T10:00:00Z" });
    expect(sortOrders([a, b, c], "value").map((r) => r.subOrderId)).toEqual(["b", "c", "a"]);
    expect(sortOrders([a, b, c], "deadline").map((r) => r.subOrderId)).toEqual(["b", "a", "c"]);
    expect(sortOrders([a, c], "newest").map((r) => r.subOrderId)).toEqual(["c", "a"]);
  });

  it("labels date groups and exports CSV with the buyer order number", () => {
    const now = new Date(2026, 10, 27, 15, 0);
    expect(dayLabel(new Date(2026, 10, 27, 9).getTime(), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 10, 26, 9).getTime(), now)).toBe("Yesterday");
    const csv = toCsv([so({})]).split("\r\n");
    expect(csv[0]).toBe("Order,Buyer order,Date,Status,Items,Quantity,Materials,VAT,Total,Currency");
    expect(csv[1]).toBe("SO-10000005-S1,SO-10000005,2026-11-25,To prepare,Split AC 2 TR,2,95.24,4.76,100.00,AED");
  });
});
