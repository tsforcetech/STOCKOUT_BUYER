# Stage 8B.2 / 8B.3 — Checkout review and order screens (frontend status)

Backend checked: `tsforcetech/STOCKOUT` main @ `689d3f8` (5 Nov 2026), live gateway `https://stockout.flowb.io`.

## Connected (live APIs)

| Screen | API | Notes |
|---|---|---|
| Cart → **Proceed to checkout** | `GET /api/v1/buyer/cart` → `checkoutReadiness.canProceed` | Button enabled only when `canProceed` is true. |
| Checkout review `/checkout` (signed in) | `GET /api/v1/buyer/cart` | Seller groups, lines, `groupSubtotal`, `totalSubtotal`, `estimatedVatRatePercent` / `estimatedVatAmount`, `estimatedTotal` shown as returned. Nothing is calculated in the browser. |
| Buyer eligibility | `GET /api/v1/marketplace/buyer/eligibility` (envelope) | `canPurchase && eligible`; never assumed on error. |
| Buyer business details | `GET /api/v1/marketplace/buyer/profile` (envelope, C# `BuyerProfileDto`) | Legal/trading name, trade licence, TRN badge (15 digits), registered address, signatory. `404 MARKETPLACE_BUYER_NOT_FOUND` → "No business details on file". |
| Readiness blockers | `checkoutReadiness.blockers[]` | Shared wording in `src/features/cart/blockers.ts`. `MULTIPLE_ORGANIZATIONS` blocks with a support message; no organisation picker and no switching header. |
| Cart changed elsewhere | cart `rowVersion` | The review keeps the rowVersion it loaded; when a refetch returns a different one it shows "Your cart was updated in another session…" and only reloads the figures when the buyer asks. |

## UI only (no requests)

- Delivery method cards (Freight / Parcel / Collection), "Calculated at checkout". Choice is not saved.
- Payment method tabs (Card / Bank transfer / Corporate cheque). No Stripe Elements, no card fields, no tokens.
- **Place order** is disabled (`ORDER_API.placeOrder = false`).

## Prepared, not connected

Types copied from C# (`Contracts/Orders/OrderDtos.cs`, `Domain/Orders/MarketplaceOrderStatus.cs`) in `src/api/types/orders.ts`.
Views in `src/features/orders/components/order-views.tsx` (buyer order list, buyer order detail with suborders and history,
seller suborder list and detail with Confirm/Reject disabled). Routes `/account/orders/:orderId` and
`/seller/orders/:subOrderId` show "Order details aren't available yet" and fetch nothing. Switches in
`src/lib/orders/order-api.ts` (all false).

## Blockers (backend)

| # | Missing | Evidence |
|---|---|---|
| 8B-B1 | `GET /api/v1/orders` (buyer order list) | No controller; live gateway `404 unmatched_gateway_route`. No C# list DTO either (only the handoff sample). |
| 8B-B2 | `GET /api/v1/orders/{orderId}` | No controller; live `404 unmatched_gateway_route`. `MarketplaceOrderDto` exists. |
| 8B-B3 | `GET /api/v1/seller/orders`, `GET /api/v1/seller/orders/{subOrderId}` | No controller; live `404 unmatched_gateway_route`. |
| 8B-B4 | `GET /api/v1/orders/{orderId}/history` | No controller. `OrderStatusHistoryDto` exists. |
| 8B-B5 | `GET /api/v1/cart/checkout-readiness` (listed "EXISTING ACTIVE" in the 8B.3 doc) | Not exposed: `CheckoutValidationService` (with per-seller VAT preview, `BUYER_ORGANIZATION_REQUIRED`) is registered but no controller calls it; live `404`. Readiness is only available inside `GET /buyer/cart`. |
| 8B-B6 | `OrderPlacementResponse` (8B.2 item 12) | Not defined anywhere in the backend. Confirmation screen can't be built against a contract. |
| 8B-B7 | Place order / payment / seller confirm / refunds | Policy blocked (CR-01, seller SLA). Stripe payment UI contract pending. |
| 8B-B8 | Buyer identity verification flow | Cart readiness returns `BUYER_IDENTITY_VERIFICATION_REQUIRED`, while `/buyer/eligibility` reports `NOT_REQUIRED` (BK-1). The buyer site has no buyer KYC upload screen; the expected verification route and rules need confirming. |
| 8B-B9 | Seller org claim for seller orders | 8B.3 says seller access is derived from a `SellerOrganizationId` JWT claim; current sign-in tokens/actor context need confirming before seller order lists can be scoped. |
| 8B-B10 | Enum JSON format | Handoff samples show enum names (`"Draft"`); confirm the API serializes names, not numbers. |
