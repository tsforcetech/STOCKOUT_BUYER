import * as React from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon, SealCheckIcon, SparkleIcon } from "@phosphor-icons/react";
import { homeHeroUrl } from "@/assets/brand";
import { SearchBox } from "@/features/search/components/search-box";
import { searchHref } from "@/features/search/lib/search-params";
import { LocationPicker } from "@/app/layouts/site-header";
import { ListingRail } from "@/features/listings/components/listing-rail";
import { catalogService } from "@/services/catalog.service";
import { useAuth } from "@/lib/auth/auth-context";

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

export default function HomePage() {
  const [emirate, setEmirate] = useStoredEmirate();
  const [categoryId, setCategoryId] = React.useState("");
  const { actor, status } = useAuth();
  const tree = useQuery({ queryKey: ["catalog", "tree"], queryFn: ({ signal }) => catalogService.categoryTree(signal), staleTime: 10 * 60_000 });
  const isSeller = (actor?.sellerContexts.length ?? 0) > 0;

  return (
    <>
      {/* Hero (reference design): photo card, lime eyebrow, two-tone headline, full search bar, popular chips */}
      <section className="mx-auto max-w-[1336px] px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="relative overflow-hidden rounded-2xl bg-[#141413] text-white">
          {homeHeroUrl ? (
            <img src={homeHeroUrl} alt="" className="absolute inset-0 size-full object-cover opacity-55" />
          ) : (
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(90%_120%_at_85%_10%,#3d3d36_0%,#1d1d1b_45%,#111110_100%)]">
              <div className="absolute inset-y-0 right-0 hidden w-[45%] bg-[repeating-linear-gradient(180deg,#2a2a27_0_46px,#1c1c1a_46px_52px)] opacity-70 [mask-image:linear-gradient(to_left,black,transparent)] lg:block" />
            </div>
          )}
          <div className="relative px-6 pb-10 pt-12 sm:px-12 sm:pb-12 sm:pt-16">
            <p className="flex items-center gap-2 text-eyebrow font-bold tracking-[0.18em] text-action">
              <SparkleIcon className="size-5" weight="bold" /> Smarter material sourcing
            </p>
            <h1 className="mt-4 font-heading text-[44px] font-bold leading-[46px] tracking-tight text-white sm:text-[72px] sm:leading-[76px]">
              Find surplus stock.
              <br />
              <span className="text-action">Verified for reuse.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-white/85 sm:text-lg">Search inspected industrial materials from trusted UAE sellers.</p>

            <div className="mt-8 max-w-[1100px] rounded-2xl bg-white/10 p-1.5 ring-1 ring-white/15 backdrop-blur">
              <SearchBox
                variant="hero"
                emirate={emirate}
                categoryId={categoryId}
                addons={
                  <div className="grid grid-cols-2 border-t border-border lg:flex lg:border-t-0">
                    <label className="flex items-center border-r border-border px-4 text-foreground lg:w-[220px] lg:border-l">
                      <span className="sr-only">Category</span>
                      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-14 w-full cursor-pointer bg-transparent font-medium outline-none lg:h-full">
                        <option value="">All categories</option>
                        {(tree.data ?? []).map((c) => (
                          <option key={c.categoryId} value={c.categoryId}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-center gap-1 px-3 lg:w-[220px]">
                      <span className="hidden text-[11px] text-muted-foreground lg:block">Location</span>
                      <LocationPicker value={emirate} onChange={setEmirate} className="h-14 min-w-0 flex-1 font-medium lg:h-full" />
                    </div>
                  </div>
                }
              />
            </div>

            <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              {(tree.data?.length ?? 0) > 0 ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-white/75">Popular:</span>
                  {tree.data!.slice(0, 4).map((c) => (
                    <Link key={c.categoryId} to={searchHref({ categoryId: c.categoryId })} className="rounded-full border border-white/30 px-3 py-1 text-white/90 hover:border-white hover:text-white">
                      {c.name}
                    </Link>
                  ))}
                </div>
              ) : (
                <span />
              )}
              <div className="flex max-w-xs items-center gap-3 rounded-xl bg-black/55 p-4 ring-1 ring-white/10 backdrop-blur">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-action text-foreground">
                  <SealCheckIcon className="size-6" />
                </span>
                <span>
                  <span className="block font-heading text-base font-bold">Verified inventory</span>
                  <span className="block text-sm text-white/75">Inspection-backed stock from trusted sellers</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-surface">
        <ListingRail title="Recommended for you" query={{ sort: "relevance" }} viewAllHref="/search" />

        {(tree.data?.length ?? 0) > 0 && (
          <section className="mx-auto max-w-[1336px] px-4 py-6 sm:px-6" aria-label="Shop by category">
            <h2 className="mb-5 font-heading text-2xl font-bold text-foreground sm:text-[32px] sm:leading-10">Shop by category</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {tree.data!.slice(0, 12).map((c) => (
                <Link key={c.categoryId} to={searchHref({ categoryId: c.categoryId })} className="group flex h-24 flex-col justify-between rounded-lg bg-cream p-4 transition-colors hover:bg-action-soft">
                  <span className="text-sm font-medium text-foreground">{c.name}</span>
                  <ArrowRightIcon className="size-4 self-end text-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <ListingRail title="Newly Added" query={{ sort: "date_desc" }} viewAllHref={searchHref({ sort: "date_desc" })} />
        <ListingRail
          title={emirate ? `Available Near You · ${emirate}` : "Available Near You"}
          query={{ stateOrEmirate: emirate || undefined, inStockOnly: true }}
          viewAllHref={searchHref({ stateOrEmirate: emirate, inStockOnly: true })}
        />

        {/* Figma "Someone needs what you don't." seller call-to-action */}
        <section className="mx-auto max-w-[1336px] px-4 pb-16 pt-6 sm:px-6">
          <div className="rounded-2xl bg-cream px-6 py-16 text-center">
            <h2 className="font-heading text-[32px] font-bold leading-10 text-foreground sm:text-[48px] sm:leading-[52px]">
              Someone needs
              <br />
              what you don't.
            </h2>
            <p className="mt-3 text-sm text-body">List in minutes. Get verified, and reach buyers looking for exactly what you have.</p>
            <Link
              to={status === "authenticated" && isSeller ? "/seller" : "/seller/onboarding"}
              className="mt-6 inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              {status === "authenticated" && isSeller ? "Go to seller portal" : "Create seller account"}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
