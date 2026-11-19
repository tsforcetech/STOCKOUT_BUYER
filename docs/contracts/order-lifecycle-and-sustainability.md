# Order fulfilment, buyer acceptance and sustainability reports (frontend contract)

Source: "STOCKOUT Consolidated Frontend Handoff — Stripe, Sustainability, Green Points" (19 Nov 2026) and the C# source at
`tsforcetech/STOCKOUT` main @ `f7b3869`. Both features are **built but switched off** (build settings, default off):

| Setting | Turns on | Blocked today by (POST-DEPLOY-UAT-02, 19 Nov) |
|---|---|---|
| `VITE_ORDER_LIFECYCLE=on` | seller fulfilment actions, delivery records/claims, buyer accept / report a problem | migration 015 missing on the operational DB; no orders (order placement off) |
| `VITE_SUSTAINABILITY_REPORTS=on` | impact report on buyer order and seller sub-order pages; "Impact reports" lists (account tab, seller nav) | Wave A public activation policy-gated; migration 014 missing; list/download gateway routes not published |

With both off the production bundle contains none of this code.

## 1. Seller fulfilment — `SellerOrdersController`

| Action | Call | Notes |
|---|---|---|
| Start preparing | `POST /api/v1/seller/orders/{subOrderId}/prepare?sellerId=` + `If-Match: "<rowVersion>"` | status CONFIRMED |
| Ready for pickup | `POST …/{subOrderId}/ready-for-pickup?sellerId=` + If-Match | BUYER_PICKUP only (`INVALID_FULFILLMENT_METHOD`) |
| Confirm buyer collected | `POST …/{subOrderId}/confirm-collection?sellerId=` `{status:"COLLECTED", proofReference?, remarks?, expectedRowVersion}` | starts the buyer's 5-day window |
| Delivery records / claims | `GET …/{subOrderId}/evidence?sellerId=`, `GET …/{subOrderId}/claims?sellerId=` | read only |

The handoff table lists `/api/v1/seller/orders/suborders/{id}/…`; the controller maps `/api/v1/seller/orders/{id}/…` (used here).
StockOut-delivered orders are advanced by StockOut operations (`/api/v1/admin/orders/suborders/{id}/fulfillment`), not the seller.
Next step logic: `nextSellerStep()` in `src/features/orders/seller-fulfilment.tsx`.

## 2. Buyer acceptance and claims — `BuyerOrdersController`

| Action | Call |
|---|---|
| Accept goods | `POST /api/v1/buyer/orders/{orderId}/suborders/{subOrderId}/accept` `{idempotencyKey, expectedRowVersion}` (all lines; partial issues go through a claim) |
| Report a problem | `POST …/suborders/{subOrderId}/claims` `{reason, orderLineId?, affectedQuantity?, expectedRowVersion}` |
| Delivery records / claims | `GET …/suborders/{subOrderId}/evidence`, `GET …/suborders/{subOrderId}/claims` |

Nested routes are used because the un-nested `/api/v1/buyer/suborders/{id}/…` has no gateway route (UAT-04 FAIL).
Shown for DELIVERED sub-orders (deadline = deliveredAtUtc + 5 days), paused while a claim is open, "You accepted this order"
once ACCEPTED. The accept key is fixed per dialog so a retry after a timeout cannot create a second acceptance.
Error wording: `MESSAGES` in `buyer-acceptance.tsx`, `LIFECYCLE_MESSAGES` in `seller-fulfilment.tsx`.

## 3. Sustainability impact reports (SUS-03)

| View | Call |
|---|---|
| Buyer order report | `GET /api/v1/buyer/orders/{orderId}/sustainability-report` |
| Buyer list / PDF | `GET /api/v1/buyer/sustainability/reports?page&pageSize`, `GET …/reports/{reportId}/download` (Blob) |
| Seller sub-order report | `GET /api/v1/seller/suborders/{subOrderId}/sustainability-report?sellerId=` |
| Seller list / PDF | `GET /api/v1/seller/sustainability/reports?sellerId=&page&pageSize`, `GET …/reports/{reportId}/download?sellerId=` |

The seller contract mentions `X-Organization-Id`; the gateway strips it, and the controller accepts `?sellerId=`, so the
query is used. Display rules (`src/features/sustainability/impact-report.tsx`):

- Totals, line values and adjustments exactly as returned; no client calculation except summing `passengerCarKmEquivalent`.
- `environmentalDisclaimer` shown verbatim under the metrics.
- `EvidenceBackedEstimate` → "Evidence-backed"; anything else → "Model estimate". Never "certified" or "audited".
- No report (404) → "Not available yet", never zeros.
- Green Points: "not yet available" while `approvedEarnablePoints` is null; `illustrativeGreenPoints` is never shown.
- Physical returns reduce embodied carbon; refunds without return leave it unchanged (as the adjustment states).

## 4. Green Points

No Green Points API is integrated. The header popover says "Coming soon" with no balance, earned badge or redeem action.

## 5. Still to confirm with the backend

1. Seller action paths: handoff `/seller/orders/suborders/{id}/…` vs controller `/seller/orders/{id}/…`.
2. Gateway routes for `/api/v1/buyer/suborders/*`, `/api/v1/buyer/sustainability/*`, `/api/v1/seller/sustainability/*`,
   `/api/v1/seller/suborders/*` (UAT-04, 09, 10 FAIL).
3. Whether the 5-day deemed acceptance is active (worker disabled until #33/#34), so the buyer copy says "may be accepted automatically".
