import { afterEach, describe, expect, it, vi } from "vitest";
import { trackPageView, updateConsent } from "../consent-mode";

afterEach(() => {
  delete window.gtag;
  delete window.dataLayer;
});

describe("Google Tag Manager consent mode", () => {
  it("grants analytics only when the visitor accepted analytics; marketing drives the ad signals", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    updateConsent({ functional: false, analytics: true, marketing: false });
    expect(gtag).toHaveBeenCalledWith("consent", "update", expect.objectContaining({ analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", functionality_storage: "denied" }));
    updateConsent(null);
    expect(gtag).toHaveBeenLastCalledWith("consent", "update", expect.objectContaining({ analytics_storage: "denied" }));
  });
  it("does nothing when GTM isn't loaded", () => {
    expect(() => updateConsent({ functional: true, analytics: true, marketing: true })).not.toThrow();
    expect(() => trackPageView("/x", "X")).not.toThrow();
  });
  it("page views carry the path only, never the query string", () => {
    window.dataLayer = [];
    trackPageView("/reset-password", "Reset");
    expect(window.dataLayer[0]).toMatchObject({ event: "virtual_page_view", page_path: "/reset-password" });
    expect(JSON.stringify(window.dataLayer[0])).not.toContain("?");
  });
});
