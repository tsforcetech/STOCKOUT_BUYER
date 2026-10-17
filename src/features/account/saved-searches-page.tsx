import * as React from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { BellIcon, BookmarkSimpleIcon, MagnifyingGlassIcon, TrashIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { searchService } from "@/services/search.service";
import { formatDateTime, formatMoney, humanize } from "@/lib/utils/format";
import { searchHref } from "@/features/search/lib/search-params";
import type { SavedSearch } from "@/api/types/search";
import { AccountTabs } from "./account-tabs";

/** Maps a saved search's normalised filters back to the /search URL. */
function hrefFor(s: SavedSearch): string {
  const f = s.filters;
  return searchHref({
    q: s.queryText ?? "",
    categoryId: f.categoryId ?? "",
    brandId: f.brandIds,
    conditionId: f.conditionIds,
    gradeId: f.gradeIds,
    stateOrEmirate: f.stateOrEmirate ?? "",
    minPrice: f.minPrice !== null ? String(f.minPrice) : "",
    maxPrice: f.maxPrice !== null ? String(f.maxPrice) : "",
    currency: f.currency ?? "",
    inStockOnly: f.inStockOnly,
    sort: s.sort,
  });
}

function describe(s: SavedSearch): string[] {
  const f = s.filters;
  const parts: string[] = [];
  if (s.queryText) parts.push(`“${s.queryText}”`);
  if (f.stateOrEmirate) parts.push(f.stateOrEmirate);
  if (f.minPrice !== null || f.maxPrice !== null) parts.push(`${formatMoney(f.minPrice ?? 0, f.currency)} – ${f.maxPrice !== null ? formatMoney(f.maxPrice, f.currency) : "any"}`);
  const n = f.brandIds.length + f.conditionIds.length + f.gradeIds.length + (f.categoryId ? 1 : 0);
  if (n) parts.push(`${n} filter${n > 1 ? "s" : ""}`);
  if (f.inStockOnly) parts.push("In stock");
  return parts;
}

export default function SavedSearchesPage() {
  const q = useQuery({ queryKey: ["saved-searches"], queryFn: ({ signal }) => searchService.savedSearches(signal) });
  const [pending, setPending] = React.useState<SavedSearch | null>(null);
  const del = useApiMutation({
    mutationFn: (id: string) => searchService.deleteSavedSearch(id),
    invalidate: [["saved-searches"]],
    successMessage: "Saved search deleted.",
    onSuccess: () => setPending(null),
  });

  return (
    <>
      <PageHeader eyebrow="My account" title="Saved searches" description="Re-run searches you use often and choose how often we alert you about new matching stock." />
      <AccountTabs />
      <SectionCard>
        {q.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !q.data?.items.length ? (
          <EmptyState
            icon={<BookmarkSimpleIcon />}
            title="No saved searches yet"
            description="Run a search and choose “Save search” to keep it here."
            action={
              <Button asChild>
                <Link to="/search">Browse stock</Link>
              </Button>
            }
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {q.data.totalCount} of {q.data.maxAllowed} saved
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {q.data.items.map((s) => (
                <li key={s.savedSearchId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{s.searchName}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{describe(s).join(" · ") || "All listings"} · saved {formatDateTime(s.createdAtUtc)}</p>
                  </div>
                  {s.alert?.isEnabled ? (
                    <Badge tone="primary">
                      <BellIcon className="size-3.5" /> {humanize(s.alert.frequency)}
                    </Badge>
                  ) : (
                    <Badge>No alerts</Badge>
                  )}
                  <div className="flex gap-2">
                    <Button asChild variant="secondary" size="sm">
                      <Link to={hrefFor(s)}>
                        <MagnifyingGlassIcon /> Run search
                      </Link>
                    </Button>
                    <Button variant="danger-ghost" size="sm" onClick={() => setPending(s)} aria-label={`Delete ${s.searchName}`}>
                      <TrashIcon />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </SectionCard>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title="Delete saved search?"
        description={`“${pending?.searchName}” and its alerts will be removed.`}
        confirmLabel="Delete"
        loading={del.isPending}
        onConfirm={() => pending && del.mutate(pending.savedSearchId)}
      />
    </>
  );
}
