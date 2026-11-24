import * as React from "react";
import { Outlet, useLocation } from "react-router";
import { applySeo } from "@/lib/seo/use-seo";
import { CookieConsentProvider } from "@/features/privacy/cookie-consent";
import { PolicyGateProvider } from "@/features/legal/policy-gate";
import { trackPageView } from "@/lib/analytics/consent-mode";

/** Wraps every route: cookie consent banner/settings and the pending-policy gate need router links on all pages. */
/** Signed-in, transactional and auth pages stay out of search results. */
const PRIVATE = /^\/(account|seller|cart|saved|login|register|forgot-password|reset-password|invitations|privacy)(\/|$)/;

export function RootLayout() {
  const { pathname } = useLocation();
  // Defaults for every route (layout effects run before the pages' own useSeo, which then refines them).
  React.useLayoutEffect(() => {
    applySeo({
      title: "StockOut – Surplus Stock Marketplace in UAE",
      description: "Buy and sell verified surplus stock, excess inventory and unused construction and industrial materials across the UAE.",
      path: pathname,
      noindex: PRIVATE.test(pathname),
    });
  }, [pathname]);
  // After the page has set its own title.
  React.useEffect(() => {
    const t = window.setTimeout(() => trackPageView(pathname, document.title), 0);
    return () => window.clearTimeout(t);
  }, [pathname]);
  return (
    <CookieConsentProvider>
      <PolicyGateProvider>
        <Outlet />
      </PolicyGateProvider>
    </CookieConsentProvider>
  );
}
