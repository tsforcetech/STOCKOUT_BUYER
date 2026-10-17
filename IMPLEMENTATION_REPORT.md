# StockOut Marketplace — Implementation report

**Status:** buyer website and seller portal are implemented against contracts extracted from the current
backend source (2026-10-17, incl. Stage 6E/6F). Type-checked, linted, built, and covered by automated tests
with mocked HTTP. **Not yet verified against the live gateway** (not reachable from the build environment).

## Screens

| Screen | UI | API connected | Tested | Notes |
|---|---|---|---|---|
| Home | Yes | Yes (search rails, category tree) | Playwright | Figma promo sections without data sources (green points, impact stats, testimonials, FAQ) omitted |
| Search (facets, sort, paging, save) | Yes | Yes | Vitest + Playwright | Distance radius not supported by API → emirate filter |
| Listing detail | Yes | Yes | Playwright | Ordering/checkout/messaging have no API → "coming soon" note |
| Categories, Sell landing, 404 | Yes | Yes / static | Playwright (404) | |
| Login (+ OTP), register (+ emailed code), forgot/reset | Yes | Yes | Vitest + Playwright | Registration confirm signs the user in |
| Account: profile, security, saved searches | Yes | Yes | — | |
| Seller onboarding (create seller) | Yes | Yes | Vitest + Playwright | |
| Seller dashboard, business & KYC documents, submit for review | Yes | Yes | — | UI requires ≥1 document before submitting (backend doesn't) |
| Seller listings, new listing, workspace (details, attributes, media, inventory, review/inspections) | Yes | Yes | — | Idempotency keys on create/submit; row-version handling |
| Cart, checkout, payments, orders, green points | No | **No backend API** | — | Figma frames exist; blocked on backend |

## Tests

* `npm test`: **50 passed** (10 files) — HTTP client, errors, envelopes, tokens, auth/session, login + MFA,
  registration + code confirmation, search URL state + results + filters + currency rule, seller onboarding redirect
  and seller creation through the real route table.
* `npm run test:e2e`: **10 passed** (Chromium desktop + Pixel 7) — anonymous browse → search → detail, seller
  login → onboarding redirect, register link, 404, no horizontal overflow.

## Backend defects affecting the website (details in docs/contracts)

1. **Listing images cannot be shown to buyers**: `cdnUrl` = `/api/v1/files/{id}/download`, which no service implements; the gateway also requires auth on `/api/v1/files/*`. The site shows a placeholder and will display images automatically once the endpoint exists.
2. Published listings can't be edited (no new-version call wired); moderation-status always reports DRAFT while a draft exists.
3. Publish/resume primary-image ownership check likely fails (file owner ≠ seller id).
4. Edits allowed while a version is under review; submit only checks price > 0 and ≥1 media.
5. Seller document DELETE returns 404 after deleting.
6. Mobile verification never sends an SMS; no server-side email/mobile format validation.
7. Saved-search `alertEnabled` ignored; `lastMatchedAtUtc` always null.
8. Search items are post-filtered, so a page may hold fewer than `pageSize` items.

## Hosting

`.github/workflows/deploy-pages.yml` deploys to GitHub Pages on every push to `feature/marketplace-web`.
Pages must be enabled (Settings → Pages → Source: GitHub Actions) and the repository must be public (or on a paid plan).
