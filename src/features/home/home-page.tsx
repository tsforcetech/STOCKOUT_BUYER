import * as React from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon, MapPinIcon, RecycleIcon, SealCheckIcon, SparkleIcon, StorefrontIcon } from "@phosphor-icons/react";
import { homeHeroUrl } from "@/assets/brand";
import { NativeSelect } from "@/components/ui/input";
import { SearchBox } from "@/features/search/components/search-box";
import { EMIRATES, searchHref } from "@/features/search/lib/search-params";
import { ListingRail } from "@/features/listings/components/listing-rail";
import { SnapshotCard } from "@/features/favorites/snapshot-card";
import { categoryIcon } from "@/features/categories/category-icon";
import { useFavorites } from "@/lib/favorites/favorites-context";
import { catalogService } from "@/services/catalog.service";
import { useAuth } from "@/lib/auth/auth-context";
import { RfqBanner } from "@/features/rfq/rfq-banner";

const LOCATION_KEY = "stockout.market.emirate";

function useStoredEmirate(): [string, (v: string) => void] {
  const [value, setValue] = React.useState(() => {
    try {
      return localStorage.getItem(LOCATION_KEY) ?? "Dubai";
    } catch {
      return "Dubai";
    }
  });
  const set = (v: string) => {
    setValue(v);
    try {
      localStorage.setItem(LOCATION_KEY, v);
    } catch {
      /* ignore */
    }
  };
  return [value, set];
}

const SECTION = "mx-auto max-w-[1336px] px-4 sm:px-6";
const H2 = "font-heading text-xl font-bold text-foreground sm:text-[28px] sm:leading-9";

/** Borderless field for the hero search bar: small caps label over a styled dropdown. */
function HeroField({ label, children }: { label: string; children: (labelId: string) => React.ReactNode }) {
  const id = React.useId();
  return (
    <div className="flex min-w-0 flex-col justify-center px-4 py-2 lg:w-[230px] lg:py-0">
      <span id={id} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children(id)}
    </div>
  );
}

const heroSelect = "h-8 rounded-md border-0 bg-transparent px-0 text-[15px] font-medium hover:border-0";

/** Hero search card: one clean white surface with a soft shadow; a lime outline appears only while it has focus. */
function SearchFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl shadow-[0_20px_50px_-18px_rgba(0,0,0,0.65)] ring-1 ring-white/15 transition-shadow focus-within:ring-2 focus-within:ring-action">
      {children}
    </div>
  );
}

function RecentlyViewed() {
  const { recent } = useFavorites();
  if (recent.length === 0) return null;
  return (
    <section className={`${SECTION} py-6`} aria-label="Recently viewed">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className={H2}>Recently viewed</h2>
        <Link to="/saved" className="text-sm font-medium text-foreground underline underline-offset-4">
          View all
        </Link>
      </div>
      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
        {recent.slice(0, 10).map((r) => (
          <li key={r.listingId} className="w-[200px] shrink-0 snap-start sm:w-[232px]">
            <SnapshotCard listing={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const PROMISES = [
  { icon: SealCheckIcon, title: "Verified sellers", body: "Sellers are KYC-checked before their listings go live." },
  { icon: MapPinIcon, title: "Across all 7 emirates", body: "Filter by emirate and area to find stock you can collect nearby." },
  { icon: RecycleIcon, title: "Surplus, not landfill", body: "Unused and reusable materials from finished projects and overstock." },
] as const;

export default function HomePage() {
  const [emirate, setEmirate] = useStoredEmirate();
  const [categoryId, setCategoryId] = React.useState("");
  const { actor, status } = useAuth();
  const tree = useQuery({
    queryKey: ["catalog", "tree"],
    queryFn: ({ signal }) => catalogService.categoryTree(signal),
    staleTime: 10 * 60_000,
  });
  const roots = tree.data ?? [];
  const isSeller = status === "authenticated" && (actor?.sellerContexts.length ?? 0) > 0;

  return (
    <>
      {/* Hero: dark card, lime eyebrow, two-tone headline, search with category + location, popular chips. */}
      <section className={`${SECTION} pt-4 sm:pt-6`}>
        <div className="relative isolate overflow-hidden rounded-[28px] bg-[#141413] text-white">
          {homeHeroUrl ? (
            <img src={homeHeroUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-55" />
          ) : (
            <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(90%_120%_at_85%_10%,#3d3d36_0%,#1d1d1b_45%,#111110_100%)]">
              <div className="absolute -right-24 -top-24 size-[420px] rounded-full bg-[#f8ff2c]/10 blur-3xl" />
              <div className="absolute inset-y-0 right-0 hidden w-[45%] bg-[repeating-linear-gradient(180deg,#2a2a27_0_46px,#1c1c1a_46px_52px)] opacity-60 [mask-image:linear-gradient(to_left,black,transparent)] lg:block" />
            </div>
          )}
          <div className="px-5 pb-6 pt-8 sm:px-10 sm:pb-9 sm:pt-12">
            <p className="flex items-center gap-2 text-eyebrow font-bold tracking-[0.18em] text-action">
              <SparkleIcon className="size-5" weight="bold" /> Smarter material sourcing
            </p>
            <h1 className="mt-3 font-heading text-[36px] font-bold leading-[40px] tracking-tight text-white sm:text-[56px] sm:leading-[60px]">
              Find surplus stock.
              <br />
              <span className="text-action">Verified for reuse.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">Search inspected construction and industrial materials from trusted UAE sellers.</p>

            <div className="mt-7 max-w-[1100px]">
              <SearchFrame>
                <SearchBox
                  variant="hero"
                  animatedPlaceholder
                  emirate={emirate}
                  categoryId={categoryId}
                  addons={
                    <div className="grid grid-cols-2 divide-x divide-border border-t border-border lg:flex lg:border-l lg:border-t-0">
                      <HeroField label="Category">
                        {(labelId) => (
                          <NativeSelect aria-labelledby={labelId} className={heroSelect} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                            <option value="">All categories</option>
                            {roots.map((c) => (
                              <option key={c.categoryId} value={c.categoryId}>
                                {c.name}
                              </option>
                            ))}
                          </NativeSelect>
                        )}
                      </HeroField>
                      <HeroField label="Location">
                        {(labelId) => (
                          <NativeSelect aria-labelledby={labelId} className={heroSelect} value={emirate} onChange={(e) => setEmirate(e.target.value)}>
                            <option value="">All UAE</option>
                            {EMIRATES.map((e) => (
                              <option key={e} value={e}>
                                {e}
                              </option>
                            ))}
                          </NativeSelect>
                        )}
                      </HeroField>
                    </div>
                  }
                />
              </SearchFrame>
            </div>

            {roots.length > 0 && (
              <div className="-mx-5 mt-5 flex items-center gap-2 overflow-x-auto px-5 pb-1 text-sm [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                <span className="mr-1 shrink-0 text-white/70">Popular:</span>
                {roots.slice(0, 5).map((c) => (
                  <Link
                    key={c.categoryId}
                    to={searchHref({ categoryId: c.categoryId })}
                    className="max-w-[220px] shrink-0 truncate rounded-full border border-white/25 bg-white/5 px-3 py-1 text-white/90 transition-colors hover:border-white hover:bg-white/10 hover:text-white"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* What buyers can count on: statements the product backs (KYC-verified sellers, emirate filters). */}
      <section className={`${SECTION} pt-4`} aria-label="Why StockOut">
        <ul className="grid gap-3 sm:grid-cols-3">
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-action-soft text-foreground">
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block font-heading text-[15px] font-bold text-foreground">{title}</span>
                <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <ListingRail title="Recommended for you" query={{ sort: "relevance" }} viewAllHref="/search" />

      {roots.length > 0 && (
        <section className={`${SECTION} py-6`} aria-label="Shop by category">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className={H2}>Shop by category</h2>
            <Link to="/categories" className="text-sm font-medium text-foreground underline underline-offset-4">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {roots.slice(0, 20).map((c) => {
              const CatIcon = categoryIcon(c.name);
              const n = c.children?.length ?? 0;
              return (
                <Link
                  key={c.categoryId}
                  to={searchHref({ categoryId: c.categoryId })}
                  className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-raised sm:p-4"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cream-strong text-foreground transition-colors group-hover:bg-action group-hover:text-action-foreground sm:size-12">
                    <CatIcon className="size-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[13px] font-semibold leading-[18px] text-foreground sm:text-sm sm:leading-5">{c.name}</span>
                    {n > 0 && <span className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{n} subcategories</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* RFQ: right after the category grid, where a buyer who didn't spot their item decides what to do next. */}
      <section className={`${SECTION} py-4`}>
        <RfqBanner
          variant="wide"
          options={{ source: "home", tab: "upload" }}
          title="Have a BOQ or material list?"
          body="Upload it or type what you need. We'll ask verified sellers across the UAE to quote you."
          cta="Upload your RFQ"
        />
      </section>

      <RecentlyViewed />

      <ListingRail title="Newly added" query={{ sort: "date_desc" }} viewAllHref={searchHref({ sort: "date_desc" })} />
      <ListingRail
        title={emirate ? `Available near you · ${emirate}` : "Available near you"}
        query={{ stateOrEmirate: emirate || undefined, inStockOnly: true }}
        viewAllHref={searchHref({ stateOrEmirate: emirate, inStockOnly: true })}
      />

      {/* Seller call to action */}
      <section className={`${SECTION} pb-14 pt-6`}>
        <div className="grid items-center gap-8 overflow-hidden rounded-[28px] border border-border bg-cream px-6 py-10 sm:px-10 lg:grid-cols-[1.1fr_1fr] lg:py-12">
          <div>
            <p className="flex items-center gap-2 text-eyebrow font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <StorefrontIcon className="size-4" /> For businesses
            </p>
            <h2 className="mt-3 font-heading text-[30px] font-bold leading-9 text-foreground sm:text-[40px] sm:leading-[46px]">Someone needs what you don’t.</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-body sm:text-base">List surplus in minutes, get verified, and reach buyers across the UAE who are looking for exactly what you have.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to={isSeller ? "/seller" : "/seller/onboarding"}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-sm font-medium text-ink-foreground transition-colors hover:bg-ink-hover"
              >
                {isSeller ? "Go to seller portal" : "Create seller account"} <ArrowRightIcon className="size-4" />
              </Link>
              <Link to="/sell" className="text-sm font-medium text-foreground underline underline-offset-4">
                How selling works
              </Link>
            </div>
          </div>
          <ol className="grid gap-3">
            {[
              ["Open a seller account", "Register as a business or an individual."],
              ["Get verified", "Upload your documents; our team reviews them."],
              ["List your surplus", "Photos, specs, quantity and price, or bulk upload."],
            ].map(([title, body], i) => (
              <li key={title} className="flex items-start gap-4 rounded-2xl bg-surface p-4 shadow-raised">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink font-heading text-sm font-bold text-ink-foreground">{i + 1}</span>
                <span>
                  <span className="block font-heading text-[15px] font-bold text-foreground">{title}</span>
                  <span className="block text-sm text-muted-foreground">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
