import * as React from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { searchService } from "@/services/search.service";
import type { ListingSearchCard, SearchListingsQuery } from "@/api/types/search";
import { getErrorMessage } from "@/lib/api/errors";
import { ListingCard, ListingCardSkeleton } from "./listing-card";

/** Figma home carousel ("Recommended for you", "Newly Added", "Available Near You"). Driven by a real search query. */
export function ListingRail({
  title,
  subtitle,
  query,
  viewAllHref,
  action,
  select,
}: {
  title: string;
  subtitle?: string;
  query: SearchListingsQuery;
  viewAllHref: string;
  action?: React.ReactNode;
  /** Narrows / reorders the fetched page (e.g. drop the listing being viewed). A rail with nothing left is hidden. */
  select?: (items: ListingSearchCard[]) => ListingSearchCard[];
}) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const q = useQuery({ queryKey: ["search", "rail", query], queryFn: ({ signal }) => searchService.listings({ pageSize: select ? 24 : 12, ...query }, signal) });
  const fetched = q.data?.items;
  const items = React.useMemo(() => (select ? select(fetched ?? []) : (fetched ?? [])), [fetched, select]);
  const scroll = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * (scroller.current.clientWidth * 0.8), behavior: "smooth" });

  if (!q.isLoading && !q.error && items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1336px] px-4 py-6 sm:px-6" aria-label={title}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-bold text-foreground sm:text-[28px] sm:leading-9">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {action}
          <Link to={viewAllHref} className="text-sm text-foreground underline underline-offset-4">
            View all
          </Link>
          <div className="hidden gap-1 sm:flex">
            <button type="button" onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`} className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-border hover:bg-surface-muted">
              <ArrowLeftIcon className="size-4" />
            </button>
            <button type="button" onClick={() => scroll(1)} aria-label={`Scroll ${title} right`} className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-border hover:bg-surface-muted">
              <ArrowRightIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>
      {q.error ? (
        <p className="rounded-lg border border-border bg-surface-muted px-4 py-6 text-sm text-muted-foreground">
          Listings couldn't be loaded: {getErrorMessage(q.error)}{" "}
          <button type="button" className="underline" onClick={() => q.refetch()}>
            Try again
          </button>
        </p>
      ) : (
        <div ref={scroller} className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
          {(q.isLoading ? Array.from({ length: 4 }) : items).map((item, i) => (
            <div key={q.isLoading ? i : (item as (typeof items)[number]).listingId} className="w-[250px] shrink-0 snap-start sm:w-[272px]">
              {q.isLoading ? <ListingCardSkeleton /> : <ListingCard item={item as (typeof items)[number]} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
