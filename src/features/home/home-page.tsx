import * as React from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon } from "@phosphor-icons/react";
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
  const { actor, status } = useAuth();
  const tree = useQuery({ queryKey: ["catalog", "tree"], queryFn: ({ signal }) => catalogService.categoryTree(signal), staleTime: 10 * 60_000 });
  const isSeller = (actor?.sellerContexts.length ?? 0) > 0;

  return (
    <>
      {/* Figma "Buyer Home" hero (photo asset pending export; dark treatment keeps contrast for the headline) */}
      <section className="relative overflow-hidden bg-[radial-gradient(120%_120%_at_80%_0%,#7a4a12_0%,#2a1a0a_45%,#0f0d0a_100%)] text-white">
        <div className="mx-auto max-w-[1336px] px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
          <h1 className="max-w-2xl font-heading text-[40px] font-bold leading-[44px] text-white sm:text-[64px] sm:leading-[68px]">
            Find Surplus Stock
            <br />
            Verified for Reuse
          </h1>
          <p className="mt-4 max-w-xl text-sm text-white/80 sm:text-base">Search inspected industrial materials from trusted UAE sellers.</p>
          <div className="mt-8 flex max-w-3xl flex-col gap-2 rounded-2xl bg-surface p-2 text-foreground shadow-raised sm:flex-row sm:items-center sm:rounded-full">
            <div className="min-w-0 flex-1">
              <SearchBox variant="hero" emirate={emirate} />
            </div>
            <LocationPicker value={emirate} onChange={setEmirate} className="h-12 rounded-full border border-border sm:border-0 sm:border-l sm:pl-4" />
          </div>
        </div>
      </section>

      <div className="relative -mt-6 rounded-t-3xl bg-surface">
        <ListingRail title="Recommended for you" query={{ sort: "relevance" }} viewAllHref="/search" />

        {(tree.data?.length ?? 0) > 0 && (
          <section className="mx-auto max-w-[1336px] px-4 py-6 sm:px-6" aria-label="Shop by category">
            <h2 className="mb-5 font-heading text-xl text-foreground sm:text-2xl">Shop by category</h2>
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
          <div className="rounded-xl bg-cream px-6 py-14 text-center">
            <h2 className="font-heading text-[32px] leading-10 text-foreground sm:text-[40px] sm:leading-[48px]">
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
