import { Outlet } from "react-router";
import { CookieConsentProvider } from "@/features/privacy/cookie-consent";
import { PolicyGateProvider } from "@/features/legal/policy-gate";

/** Wraps every route: cookie consent banner/settings and the pending-policy gate need router links on all pages. */
export function RootLayout() {
  return (
    <CookieConsentProvider>
      <PolicyGateProvider>
        <Outlet />
      </PolicyGateProvider>
    </CookieConsentProvider>
  );
}
