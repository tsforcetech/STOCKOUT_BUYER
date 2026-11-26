import { describe, expect, it } from "vitest";
import { notificationHref } from "../notification-target";

describe("order notifications (handoff 26 Nov §5)", () => {
  const ID = "0d000000-0000-4000-8000-000000000001";
  it("maps the server's canonical targets to this site's routes", () => {
    expect(notificationHref({ navigationTarget: `/buyer/orders/${ID}`, relatedEntityType: "ORDER" })).toBe(`/account/orders/${ID}`);
    expect(notificationHref({ navigationTarget: "/buyer/verification", relatedEntityType: "BUYER_VERIFICATION" })).toBe("/account/verification");
    expect(notificationHref({ navigationTarget: "/buyer/saved-searches", relatedEntityType: "SAVED_SEARCH" })).toBe("/account/saved-searches");
  });
  it("falls back to the related entity: buyer order or seller part", () => {
    expect(notificationHref({ navigationTarget: null, relatedEntityType: "ORDER", relatedEntityId: ID })).toBe(`/account/orders/${ID}`);
    expect(notificationHref({ navigationTarget: null, relatedEntityType: "SUB_ORDER", relatedEntityId: ID })).toBe(`/seller/orders/${ID}`);
  });
  it("never follows admin or unsafe targets on the buyer site", () => {
    expect(notificationHref({ navigationTarget: `/admin/orders/${ID}`, relatedEntityType: "ORDER", relatedEntityId: ID })).toBe(`/account/orders/${ID}`);
    expect(notificationHref({ navigationTarget: "javascript:alert(1)", relatedEntityType: null })).toBeNull();
    expect(notificationHref({ navigationTarget: "//evil.example", relatedEntityType: "ORDER", relatedEntityId: "not-a-guid" })).toBeNull();
  });
});
