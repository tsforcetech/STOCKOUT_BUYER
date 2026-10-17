# StockOut Marketplace (buyer + seller website)

One public website for the STOCKOUT surplus-materials marketplace:

* **Buyers** browse and search anonymously, register/log in, save searches with alerts.
* **Sellers** use the same account: "Start selling" adds a seller account (business or individual),
  KYC documents and review submission, then a **seller portal** for listings, media, inventory and
  inspections.

Built on the same foundation as Stockout Admin (React 19 + TypeScript + Vite + Tailwind 4 + TanStack
Query/Table + react-hook-form/zod), styled from the StockOut Figma file ("Buyer Screens" for the public
site; the console design system for the seller portal). All data comes from the STOCKOUT API gateway.

## Quick start

```bash
npm ci
npm run dev          # http://localhost:5173 — /api is proxied to https://stockout.flowb.io
```

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `preview` | develop / production build / serve build |
| `npm run typecheck`, `npm run lint` | static checks |
| `npm test` | Vitest unit + integration tests (mocked HTTP) |
| `npm run test:e2e` | Playwright smoke tests |

Configuration (`.env.example`): `VITE_API_BASE_URL` (gateway origin for the built app),
`VITE_DEV_PROXY_TARGET`, `VITE_BASE_PATH` (`/<repo>/` on GitHub Pages), `VITE_REFRESH_TOKEN_STORAGE`.

## Routes

| Route | Screen | Auth |
|---|---|---|
| `/` | Home (hero search, live listing rails, categories, seller CTA) | public |
| `/search` | Search with facet filters, sort, pagination, save search | public (save needs login) |
| `/categories` | All categories | public |
| `/listings/:id` | Listing detail | public |
| `/sell` | How selling works | public |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Auth (register → emailed 6-digit code → signed in) | public |
| `/account`, `/account/security`, `/account/saved-searches` | Profile, security, saved searches | signed in |
| `/seller/onboarding` | Create seller account | signed in |
| `/seller`, `/seller/business`, `/seller/listings`, `/seller/listings/new`, `/seller/listings/:id` | Seller portal | signed in + seller |

## Docs

* `docs/contracts/*` — backend contracts extracted from the C# source (with file:line citations and known defects)
* `IMPLEMENTATION_REPORT.md` — status, tests, backend blockers

## Deployment

GitHub Actions (`.github/workflows/deploy-pages.yml`) type-checks, lints, tests and builds on every push,
then deploys to GitHub Pages with an SPA `404.html` fallback.
