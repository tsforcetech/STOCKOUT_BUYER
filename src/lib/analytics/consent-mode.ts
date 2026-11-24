/**
 * Google Tag Manager (GTM-TS5RJ63D, loaded in index.html) with Consent Mode v2. Defaults are all "denied" there; this
 * passes the visitor's saved cookie choice on, so analytics / marketing tags run only after an explicit OK.
 */
type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

const g = (): Gtag | null => (typeof window !== "undefined" && typeof window.gtag === "function" ? window.gtag : null);
const on = (v: boolean) => (v ? "granted" : "denied");

export function updateConsent(c: { functional: boolean; analytics: boolean; marketing: boolean } | null) {
  const gtag = g();
  if (!gtag) return;
  const choice = c ?? { functional: false, analytics: false, marketing: false };
  gtag("consent", "update", {
    analytics_storage: on(choice.analytics),
    ad_storage: on(choice.marketing),
    ad_user_data: on(choice.marketing),
    ad_personalization: on(choice.marketing),
    functionality_storage: on(choice.functional),
    personalization_storage: on(choice.functional),
  });
}

/**
 * Single-page app: one dataLayer event per route change ("virtual_page_view"), for a GTM page-view trigger. Path
 * only, never the query string (reset and invitation links carry tokens).
 */
export function trackPageView(path: string, title: string) {
  if (typeof window === "undefined" || !window.dataLayer) return;
  window.dataLayer.push({ event: "virtual_page_view", page_path: path, page_location: window.location.origin + path, page_title: title });
}
