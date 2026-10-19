import * as React from "react";
import { Outlet, useLocation } from "react-router";
import { ErrorBoundary } from "@/components/feedback/error-boundary";
import { PageSkeleton } from "@/components/feedback/states";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { CartDrawer } from "@/features/cart/cart-drawer";
import { MobileTabBar } from "./mobile-tab-bar";

/** Public marketplace layout (Figma Buyer Screens): cream header with mega menus, dark footer. */
export function SiteLayout() {
  const location = useLocation();
  React.useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [location.pathname]);
  return (
    <div className="flex min-h-dvh flex-col bg-surface pb-16 md:pb-0">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-action focus:px-3 focus:py-2 focus:text-action-foreground"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <ErrorBoundary resetKey={location.pathname}>
          <React.Suspense
            fallback={
              <div className="mx-auto max-w-[1336px] px-6 py-10">
                <PageSkeleton />
              </div>
            }
          >
            <Outlet />
          </React.Suspense>
        </ErrorBoundary>
      </main>
      <SiteFooter />
      <CartDrawer />
      <MobileTabBar />
    </div>
  );
}
