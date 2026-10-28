import { createBrowserRouter, type RouteObject } from "react-router";
import { SiteLayout } from "@/app/layouts/site-layout";
import { SellerLayout } from "@/app/layouts/seller-layout";
import { RootLayout } from "@/app/layouts/root-layout";
import { RedirectIfAuthenticated, RequireAuth } from "@/lib/auth/guards";
import { RouteError } from "./route-error";

const page = (loader: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await loader()).default });

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      // Auth screens (full-page, no site chrome)
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: "login", lazy: page(() => import("@/features/auth/login-page")) },
          { path: "register", lazy: page(() => import("@/features/auth/register-page")) },
          { path: "forgot-password", lazy: page(() => import("@/features/auth/forgot-password-page")) },
        ],
      },
      { path: "reset-password", lazy: page(() => import("@/features/auth/reset-password-page")) },

      // Public marketplace (anonymous browsing)
      {
        path: "/",
        element: <SiteLayout />,
        children: [
          { index: true, lazy: page(() => import("@/features/home/home-page")) },
          { path: "search", lazy: page(() => import("@/features/search/search-page")) },
          { path: "categories", lazy: page(() => import("@/features/categories/categories-page")) },
          { path: "listings/:listingId", lazy: page(() => import("@/features/listings/listing-detail-page")) },
          { path: "sell", lazy: page(() => import("@/features/sell/sell-page")) },
          { path: "cart", lazy: page(() => import("@/features/cart/cart-page")) },
          { path: "saved", lazy: page(() => import("@/features/favorites/saved-page")) },
          { path: "legal", lazy: page(() => import("@/features/legal/legal-hub-page")) },
          { path: "legal/:slug", lazy: page(() => import("@/features/legal/policy-page")) },
          { path: "invitations/:token", lazy: page(() => import("@/features/organization/invitation-page")) },
          {
            element: <RequireAuth />,
            children: [
              { path: "seller/onboarding", lazy: page(() => import("@/features/seller/onboarding-page")) },
              {
                path: "account",
                lazy: page(() => import("@/features/account/account-layout")),
                children: [
                  { index: true, lazy: page(() => import("@/features/account/profile-page")) },
                  { path: "security", lazy: page(() => import("@/features/account/security-page")) },
                  { path: "orders", lazy: page(() => import("@/features/orders/my-orders-page")) },
                  { path: "saved-searches", lazy: page(() => import("@/features/account/saved-searches-page")) },
                  { path: "privacy", lazy: page(() => import("@/features/account/privacy-page")) },
                ],
              },
            ],
          },
          { path: "*", lazy: page(() => import("@/features/errors/not-found-page")) },
        ],
      },

      // Seller portal (signed in + seller context)
      {
        element: <RequireAuth />,
        children: [
          {
            path: "seller",
            lazy: async () => ({ Component: (await import("@/features/seller/require-seller")).RequireSeller }),
            children: [
              {
                element: <SellerLayout />,
                children: [
                  { index: true, lazy: page(() => import("@/features/seller/dashboard-page")) },
                  { path: "orders", lazy: page(() => import("@/features/orders/seller-orders-page")) },
                  { path: "business", lazy: page(() => import("@/features/seller/business-page")) },
                  { path: "profile", lazy: page(() => import("@/features/account/profile-page")) },
                  { path: "security", lazy: page(() => import("@/features/account/security-page")) },
                  { path: "privacy", lazy: page(() => import("@/features/account/privacy-page")) },
                  { path: "team", lazy: page(() => import("@/features/organization/team-page")) },
                  { path: "business-changes", lazy: page(() => import("@/features/organization/business-changes-page")) },
                  { path: "listings", lazy: page(() => import("@/features/seller/listings-page")) },
                  { path: "listings/new", lazy: page(() => import("@/features/seller/listing-new-page")) },
                  { path: "listings/import", lazy: page(() => import("@/features/seller/import/import-page")) },
                  { path: "listings/import/:jobId", lazy: page(() => import("@/features/seller/import/import-job-page")) },
                  // Older client-side CSV uploader, kept reachable for sellers mid-way through it; new imports use E2 above.
                  { path: "listings/bulk", lazy: page(() => import("@/features/seller/bulk/bulk-upload-page")) },
                  { path: "listings/:listingId", lazy: page(() => import("@/features/seller/listing-edit-page")) },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes, { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" });
}
