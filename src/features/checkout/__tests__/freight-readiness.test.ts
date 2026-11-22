import { describe, expect, it } from "vitest";
import { mockFetch } from "@/test/http";
import { ordersService } from "@/services/orders.service";
import { blockerText } from "@/features/cart/blockers";

describe("freight readiness (handoff 22 Nov)", () => {
  it("asks readiness with the delivery mode and address so the server adds freight", async () => {
    const { calls } = mockFetch([{ method: "GET", path: "/api/v1/buyer/checkout/readiness", respond: () => ({ body: { canProceed: true, estimatedPayableTotal: 1060, deliveryMode: "PLATFORM_ARRANGED_DELIVERY", deliveryFeeSubtotal: 9.52, deliveryVatAmount: 0.48, blockers: [], sellerSubOrders: [] } }) }]);
    const r = await ordersService.checkoutReadiness("AAAAAAAAB9Q=", undefined, { deliveryMode: "PLATFORM_ARRANGED_DELIVERY", deliveryAddressId: "ad-1" });
    const url = calls[0].url;
    expect(url.searchParams.get("deliveryMode")).toBe("PLATFORM_ARRANGED_DELIVERY");
    expect(url.searchParams.get("deliveryAddressId")).toBe("ad-1");
    expect(calls[0].headers.get("If-Match")).toBe('"AAAAAAAAB9Q="');
    expect((r.deliveryFeeSubtotal ?? 0) + (r.deliveryVatAmount ?? 0)).toBeCloseTo(10);
  });
  it("without an address it stays the plain readiness call", async () => {
    const { calls } = mockFetch([{ method: "GET", path: "/api/v1/buyer/checkout/readiness", respond: () => ({ body: { canProceed: true, blockers: [], sellerSubOrders: [] } }) }]);
    await ordersService.checkoutReadiness("AAAAAAAAB9Q=");
    expect(calls[0].url.search).toBe("");
  });
  it("freight blockers have buyer wording, including the missing map pin", () => {
    expect(blockerText({ code: "BUYER_ADDRESS_LOCATION_REQUIRED", message: "" })).toMatch(/drop a pin/);
    expect(blockerText({ code: "COM_DEL_MODE_POLICY_GATED", message: "" })).toMatch(/aren't open yet/);
    expect(blockerText({ code: "FREIGHT_VAT_OR_TAX_ISSUER_UNAPPROVED", message: "" })).toMatch(/aren't open yet/);
  });
});
