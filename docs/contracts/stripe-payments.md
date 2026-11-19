# Stripe sandbox — seller payouts and buyer payment authorisation (frontend contract)

Source: "STOCKOUT Frontend Consolidated Handoff — Stripe Sandbox UAT" (18 Nov 2026, baseline `9e726ac`), checked against
`tsforcetech/STOCKOUT` main @ `17c05d3`. The handoff supersedes older examples (route-style seller ids, TitleCase
statuses, `/api/v1/buyer/orders/pre-auth/status`).

## 1. Seller payout account (Stripe Connect Express)

Controller: `services/bidding-deal/src/Emcore.BiddingDeal.Api/Controllers/SellerStripeConnectController.cs`.
No envelope; errors are ProblemDetails with `code`.

| Action | Call (gateway) | Source |
|---|---|---|
| Status | `GET /api/v1/seller/stripe/status?sellerId={sellerOrganizationId}` | `:25` |
| Start onboarding | `POST /api/v1/seller/stripe/onboarding-link?sellerId=…` `{ returnUrl, refreshUrl }` | `:45` |
| Expired link | `POST /api/v1/seller/stripe/refresh-link?sellerId=…` (same body) | `:83` |
| Sync from Stripe | `POST /api/v1/seller/stripe/sync?sellerId=…` (no body) → `{ success, message, status }` | `:121` |

- `sellerId` is the seller **organisation** id, always in the query. The gateway strips `X-Organization-Id`; the route-style
  variants (`/{sellerId}/status` …) still exist but are not used.
- Return page `/seller/stripe/return` always calls `sync` and shows the nested `status`; the redirect proves nothing.
  A failed sync shows "Unable to verify Stripe status" with Try again, never a completed state.
- Refresh page `/seller/stripe/refresh` asks for a new link; `404 SELLER_STRIPE_ACCOUNT_NOT_FOUND` falls back to
  `onboarding-link`.
- "Payout account active" only when `onboardingStatus = COMPLETED` **and** `chargesEnabled` **and** `payoutsEnabled`
  (`isPayoutReady`). COMPLETED without both shows "Payouts not enabled yet".

| Status | Badge | Main action |
|---|---|---|
| NOT_STARTED | No payout account connected | Set up payouts |
| IN_PROGRESS | Onboarding incomplete | Continue setup |
| PENDING_VERIFICATION | Verification pending | Review requirements (Stripe link) when items are due, otherwise Check verification status (sync) |
| RESTRICTED | Payouts restricted (+ `disabledReason`, due items, support contact) | Resolve restrictions |
| COMPLETED + both capabilities | Payout account active | Update account details / Refresh status |

Error wording: `src/features/seller/payouts/payout-shared.tsx` (`MESSAGES`). Handoff 19 Nov 2026 (Accounts v2, backend `8fa2909`):
`400 SELLER_CONTACT_EMAIL_MISSING` (`StripeConnectService.cs:126`) asks the seller to add a business contact email and links to
`/seller/business`; the frontend never sends an email itself. `UNAUTHORIZED_SELLER_ACCESS` and
`SELLER_NOT_VERIFIED` are named by the handoff but not found in the current backend source; they are mapped anyway.

## 2. Buyer payment authorisation (Stage 8C.10, manual capture)

Controller: `services/bidding-deal/src/Emcore.BiddingDeal.Api/Controllers/BuyerPaymentAuthorizationsController.cs`;
DTOs `Emcore.BiddingDeal.Contracts/Payments/PaymentPreAuthDtos.cs`. No envelope.

| Action | Call | Source |
|---|---|---|
| Initiate | `POST /api/v1/buyer/checkout/payment-authorizations`, headers `If-Match: "<cart rowVersion>"`, `Idempotency-Key` | `:34` |
| Status (authoritative) | `GET …/payment-authorizations/{attemptId}?includeClientSecret=false` | `:86` |
| Cancel | `POST …/payment-authorizations/{attemptId}/cancel` `{ reason }` | `:118` |

Body: `{ cartId, cartVersion, purchasingOrganizationId (cart's company, null for individuals), checkoutCorrelationId,
expectedTotalAmount (the readiness total the buyer saw), currency: "AED", idempotencyKey (= header) }`.

Frontend behaviour (`src/features/checkout/payment-step.tsx`, `src/lib/orders/payment-preauth.ts`):

- Off unless `VITE_PAYMENT_PREAUTH=on` and `VITE_STRIPE_PUBLISHABLE_KEY` is a `pk_test_` key (`ORDER_API.paymentPreAuth`).
  Only for approved Tier B sandbox testing: each start creates a Stripe test PaymentIntent.
- Starts only when readiness `canProceed` and currency is AED. Card data goes to the Stripe Payment Element
  (`@stripe/stripe-js`, loaded on demand); `confirmPayment` uses `redirect: "if_required"` and
  `return_url = /checkout?payment_attempt={attemptId}`. Stripe's return parameters (including the client secret) are
  removed from the address bar.
- The client secret is kept in memory only. After a reload the status is read once with `includeClientSecret=true`;
  the server only returns it for `REQUIRES_PAYMENT_METHOD` / `REQUIRES_ACTION` (`PaymentPreAuthService.cs:2019`).
- `sessionStorage` keeps `{ attemptId, idempotencyKey, checkoutCorrelationId, cartVersion, expectedTotalAmount }` per
  cart. A timeout / network / 5xx initiation is retried with the same key and body; a definite refusal or an ended
  attempt gets a new key.
- Polling follows `recommendedPollIntervalSeconds`, `shouldContinueActivePolling` and the 120 s window; afterwards
  "Verification delayed" with Check again (`canManualRefresh`), never a second attempt.
- "Payment authorised" only for `AUTHORIZED && isProviderVerified` (`isProviderAuthorized`): "held on your card, not
  charged. Your order isn't placed yet." Never "paid", "captured" or "order placed".
- `AUTHORIZATION_FAILED` shows `failureMessage` (+ `failureCode` as reference) and Try again; `AUTHORIZATION_EXPIRED`
  re-checks the cart first; `RECONCILIATION_REQUIRED` → Verification delayed.
- `PAYMENT_PREAUTH_AMOUNT_MISMATCH` / `INSUFFICIENT_STOCK` re-check readiness; `CART_CONCURRENCY_CONFLICT`,
  `COMMERCE_IF_MATCH_REQUIRED`, `COMMERCE_INVALID_IF_MATCH`, `PAYMENT_PREAUTH_CART_MISMATCH` show the "cart was updated"
  reload notice. `PAYMENT_PREAUTH_ACTIVE_ATTEMPT_CONFLICT` (BE-05, `PaymentPreAuthService.cs:261-288`): for the same buyer and
  checkout the ProblemDetails carries `activeAttemptId`, `activeAttemptStatus`, `activeCheckoutCorrelationId`; the step resumes
  that attempt (status read with `includeClientSecret=true` when card entry is still needed). Without them it shows the message only.
- Cancel is offered for card-entry states and AUTHORIZED; `409 PAYMENT_PREAUTH_ALREADY_AUTHORIZED_PROTECTED` (`:523`) is
  explained, not forced.
- **Place order** stays disabled (`ORDER_API.placeOrder = false`; backend `OrderPlacement:Enabled=false` → 503).

## 3. Delivery address map pin (BE-13)

- New addresses require coordinates (≤ 6 decimals); legacy addresses show "Map pin missing" with an **Add delivery pin**
  action (address book and checkout picker) that opens the address for editing (PUT with `If-Match`).
- `BUYER_ADDRESS_LOCATION_REQUIRED` (`Contracts/Orders/OrderPlacementContracts.cs:46`) is only returned when the
  coordinate-enforcement policy is on; it is mapped in `address-messages.ts` and `cart/blockers.ts`, not assumed.

## 4. Open points for the backend

1. Sandbox E2E evidence (Stripe account, PaymentIntent, webhook inbox) is still 0/22 per RUNTIME-06; frontend testing
   needs the approved Tier A / Tier B identities and a `pk_test_` key from the same Stripe account as the backend.
2. Fixed in backend `8fa2909` (BE-05): the conflict returns the active attempt for the same buyer (handled above).
3. Fixed in backend `8fa2909` (BE-06): the 120 s window now starts at card confirmation; no frontend change needed.
4. Accounts v2 seller creation is still refused by Stripe for the platform test account (POST-DEPLOY-UAT-02, 19 Nov):
   platform Connect settings must be fixed before onboarding can be tested.
