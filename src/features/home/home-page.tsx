import * as React from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  SealCheckIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { homeHeroUrl } from "@/assets/brand";
import { SearchBox } from "@/features/search/components/search-box";
import { searchHref } from "@/features/search/lib/search-params";
import { LocationPicker } from "@/app/layouts/site-header";
import { ListingRail } from "@/features/listings/components/listing-rail";
import { SnapshotCard } from "@/features/favorites/snapshot-card";
import { useFavorites } from "@/lib/favorites/favorites-context";
import {
  CubeIcon,
  DropIcon,
  FireIcon,
  GearSixIcon,
  HardHatIcon,
  LightningIcon,
  PackageIcon,
  PipeIcon,
  PlugIcon,
  StackIcon,
  type Icon,
} from "@phosphor-icons/react";

/** Picks a category icon from its name (the category API has no icon field). */
const CATEGORY_ICONS: Array<[RegExp, Icon]> = [
  [/electr|cable|switch|wire/i, LightningIcon],
  [/plug|socket|contactor/i, PlugIcon],
  [/pipe|plumb|ppr|hdpe|upvc|drain/i, PipeIcon],
  [/valve|water|fluid/i, DropIcon],
  [/fitting|flange|coupling|steel|metal/i, GearSixIcon],
  [/safety|ppe|helmet/i, HardHatIcon],
  [/fire/i, FireIcon],
  [/tile|brick|block|stone|board|panel/i, StackIcon],
  [/box|enclosure|pack/i, PackageIcon],
];
function categoryIcon(name: string): Icon {
  return CATEGORY_ICONS.find(([re]) => re.test(name))?.[1] ?? CubeIcon;
}

function RecentlyViewed() {
  const { recent } = useFavorites();
  if (recent.length === 0) return null;
  return (
    <section
      className="mx-auto max-w-[1336px] px-4 py-6 sm:px-6"
      aria-label="Recently viewed"
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="font-heading text-xl font-bold text-foreground sm:text-[28px] sm:leading-9">
          Recently viewed
        </h2>
        <Link
          to="/saved"
          className="text-sm text-foreground underline underline-offset-4"
        >
          See all
        </Link>
      </div>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
        {recent.slice(0, 10).map((r) => (
          <li
            key={r.listingId}
            className="w-[200px] shrink-0 snap-start sm:w-[220px]"
          >
            <SnapshotCard listing={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}
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
  const tree = useQuery({
    queryKey: ["catalog", "tree"],
    queryFn: ({ signal }) => catalogService.categoryTree(signal),
    staleTime: 10 * 60_000,
  });
  const isSeller = (actor?.sellerContexts.length ?? 0) > 0;

  return (
    <>
      {/* Hero (reference design): photo card, lime eyebrow, two-tone headline, full search bar, popular chips */}
      <section className="mx-auto max-w-[1336px] px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="relative overflow-hidden rounded-2xl bg-[#141413] text-white">
          {homeHeroUrl ? (
            <img
              src={homeHeroUrl}
              alt=""
              className="absolute inset-0 size-full object-cover opacity-55"
            />
          ) : (
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(90%_120%_at_85%_10%,#3d3d36_0%,#1d1d1b_45%,#111110_100%)]"
            >
              <div className="absolute inset-y-0 right-0 hidden w-[45%] bg-[repeating-linear-gradient(180deg,#2a2a27_0_46px,#1c1c1a_46px_52px)] opacity-70 [mask-image:linear-gradient(to_left,black,transparent)] lg:block" />
            </div>
          )}
          <div className="relative px-5 pb-6 pt-8 sm:px-10 sm:pb-8 sm:pt-10">
            <p className="flex items-center gap-2 text-eyebrow font-bold tracking-[0.18em] text-action">
              <SparkleIcon className="size-5" weight="bold" /> Smarter material
              sourcing
            </p>
            <h1 className="mt-3 font-heading text-[36px] font-bold leading-[40px] tracking-tight text-white sm:text-[56px] sm:leading-[60px]">
              Find surplus stock.
              <br />
              <span className="text-action">Verified for reuse.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-white/85 sm:text-base">
              Search inspected industrial materials from trusted UAE sellers.
            </p>

            <div className="mt-6 max-w-[1100px] rounded-2xl bg-white/10 p-1.5 ring-1 ring-white/15 backdrop-blur">
              <SearchBox
                variant="hero"
                emirate={emirate}
                categoryId={categoryId}
                addons={
                  <div className="grid grid-cols-2 border-t border-border lg:flex lg:border-t-0">
                    <label className="flex items-center border-r border-border px-4 text-foreground lg:w-[220px] lg:border-l">
                      <span className="sr-only">Category</span>
                      <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="h-14 w-full cursor-pointer bg-transparent font-medium outline-none lg:h-full"
                      >
                        <option value="">All categories</option>
                        {(tree.data ?? []).map((c) => (
                          <option key={c.categoryId} value={c.categoryId}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-center gap-1 px-3 lg:w-[220px]">
                      <span className="hidden text-[11px] text-muted-foreground lg:block">
                        Location
                      </span>
                      <LocationPicker
                        value={emirate}
                        onChange={setEmirate}
                        className="h-14 min-w-0 flex-1 font-medium lg:h-full"
                      />
                    </div>
                  </div>
                }
              />
            </div>

            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {(tree.data?.length ?? 0) > 0 ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-white/75">Popular:</span>
                  {tree.data!.slice(0, 4).map((c) => (
                    <Link
                      key={c.categoryId}
                      to={searchHref({ categoryId: c.categoryId })}
                      className="max-w-[220px] truncate rounded-full border border-white/30 px-3 py-1 text-white/90 hover:border-white hover:text-white"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              ) : (
                <span />
              )}
              <div className="flex max-w-xs shrink-0 items-center gap-3 rounded-xl bg-black/55 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-action text-action-foreground">
                  <SealCheckIcon className="size-5" />
                </span>
                <span>
                  <span className="block font-heading text-sm font-bold">
                    Verified inventory
                  </span>
                  <span className="block text-xs text-white/75">
                    Inspection-backed stock from trusted sellers
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-surface">
        <ListingRail
          title="Recommended for you"
          query={{ sort: "relevance" }}
          viewAllHref="/search"
        />

        {(tree.data?.length ?? 0) > 0 && (
          <section
            className="mx-auto max-w-[1336px] px-4 py-6 sm:px-6"
            aria-label="Shop by category"
          >
            <h2 className="mb-4 font-heading text-xl font-bold text-foreground sm:text-[28px] sm:leading-9">
              Shop by category
            </h2>
            {tree.data!.length < 6 ? (
              /* Few top-level categories: larger cards that fill the row instead of a sparse icon grid. */
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {tree.data!.map((c) => {
                  const CatIcon = categoryIcon(c.name);
                  const n = c.children?.length ?? 0;
                  return (
                    <Link
                      key={c.categoryId}
                      to={searchHref({ categoryId: c.categoryId })}
                      className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-foreground hover:shadow-raised"
                    >
                      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-cream ring-1 ring-border transition-colors group-hover:bg-action group-hover:ring-action-border">
                        <CatIcon className="size-7 text-foreground group-hover:text-action-foreground" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 font-heading text-base font-bold leading-5 text-foreground">
                          {c.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {n
                            ? `${n} subcategor${n === 1 ? "y" : "ies"}`
                            : "Browse stock"}
                        </span>
                      </span>
                      <ArrowRightIcon className="size-5 shrink-0 text-foreground transition-transform group-hover:translate-x-1" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {tree.data!.slice(0, 16).map((c) => {
                  const CatIcon = categoryIcon(c.name);
                  return (
                    <Link
                      key={c.categoryId}
                      to={searchHref({ categoryId: c.categoryId })}
                      className="group flex flex-col items-center gap-2 rounded-xl p-2 text-center transition-colors hover:bg-cream"
                    >
                      <span className="flex size-16 items-center justify-center rounded-full bg-cream ring-1 ring-border transition-all group-hover:bg-action group-hover:text-action-foreground group-hover:ring-action-border sm:size-[72px]">
                        <CatIcon className="size-7 text-foreground group-hover:text-action-foreground sm:size-8" />
                      </span>
                      <span className="line-clamp-2 text-xs font-medium leading-4 text-foreground sm:text-sm sm:leading-5">
                        {c.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <RecentlyViewed />

        <ListingRail
          title="Newly Added"
          query={{ sort: "date_desc" }}
          viewAllHref={searchHref({ sort: "date_desc" })}
        />
        <ListingRail
          title={
            emirate ? `Available Near You · ${emirate}` : "Available Near You"
          }
          query={{ stateOrEmirate: emirate || undefined, inStockOnly: true }}
          viewAllHref={searchHref({
            stateOrEmirate: emirate,
            inStockOnly: true,
          })}
        />

        {/* Figma "Someone needs what you don't." seller call-to-action */}
        <section className="mx-auto max-w-[1336px] px-4 pb-12 pt-6 sm:px-6">
          <div className="rounded-2xl bg-cream px-6 py-10 text-center">
            <h2 className="font-heading text-[28px] font-bold leading-9 text-foreground sm:text-[40px] sm:leading-[44px]">
              Someone needs
              <br />
              what you don't.
            </h2>
            <p className="mt-3 text-sm text-body">
              List in minutes. Get verified, and reach buyers looking for
              exactly what you have.
            </p>
            <Link
              to={
                status === "authenticated" && isSeller
                  ? "/seller"
                  : "/seller/onboarding"
              }
              className="mt-6 inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              {status === "authenticated" && isSeller
                ? "Go to seller portal"
                : "Create seller account"}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
