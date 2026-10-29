import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { CaretRightIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/misc";
import { useUrlState } from "@/hooks/use-url-state";
import { formatDateTime } from "@/lib/utils/format";
import { sellerListingsService } from "@/services/seller-listings.service";
import type { CorrectionStatus } from "@/api/types/listing-corrections";
import { ListingAccessNotice, canManageListings } from "./components/listing-access-notice";
import { sellerErrorMessage } from "./lib/errors";
import { sellerKeys, useActiveSeller } from "./lib/queries";
import { CorrectionStatusBadge, FIELD_LABEL, correctionKeys } from "./lib/corrections";

/** Titles for the listing ids on this page (shares the seller list query used for version statuses). */
function useListingTitles(sellerId: string) {
  return useQuery({
    queryKey: [...sellerKeys.listings(sellerId), "version-status"],
    queryFn: ({ signal }) => sellerListingsService.list(sellerId, { page: 1, pageSize: 1000 }, signal),
    select: (r) => new Map(r.items.map((i) => [i.listingId, i.title])),
    staleTime: 30_000,
  });
}

export default function SellerCorrectionsPage() {
  const seller = useActiveSeller();
  const sellerId = seller.sellerId;
  const [state, setState] = useUrlState({ view: "pending" });
  const status: CorrectionStatus | undefined = state.view === "pending" ? "AWAITING_SELLER_DECISION" : undefined;
  const titles = useListingTitles(sellerId).data;
  const q = useQuery({
    queryKey: correctionKeys.list(sellerId, state.view),
    queryFn: ({ signal }) => sellerListingsService.corrections(sellerId, { status, page: 1, pageSize: 100 }, signal),
    enabled: canManageListings(seller),
  });

  if (!canManageListings(seller))
    return (
      <>
        <PageHeader eyebrow="Seller portal" title="Inspector proposals" />
        <ListingAccessNotice seller={seller} />
      </>
    );

  const items = [...(q.data?.items ?? [])].sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc));
  return (
    <>
      <PageHeader
        eyebrow="Seller portal"
        title="Inspector proposals"
        description="After an inspection, StockOut may propose corrections to a listing. Price, grade and quantity changes need your OK. Your live listing doesn't change until a correction is approved and published."
      />
      <SectionCard>
        <Tabs value={state.view} onValueChange={(v) => setState({ view: v })}>
          <TabsList aria-label="Which proposals">
            <TabsTrigger value="pending">Needs your decision</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="pt-4">
          {q.isLoading ? (
            <PageSkeleton />
          ) : q.error ? (
            <ErrorState error={q.error} title={sellerErrorMessage(q.error)} onRetry={() => void q.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState title={state.view === "pending" ? "Nothing needs your decision" : "No proposals yet"} description="Proposals appear here when an inspector suggests changes to one of your listings." />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {items.map((c) => (
                <li key={c.correctionId}>
                  <Link to={`/seller/listings/${c.listingId}/corrections/${c.correctionId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-foreground">{titles?.get(c.listingId) ?? `Listing LST-${c.listingId.slice(0, 8).toUpperCase()}`}</span>
                        <CorrectionStatusBadge status={c.status} />
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{c.sellerVisibleSummary}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.correctionNo} · {c.changes.map((x) => FIELD_LABEL[x.field] ?? x.field).join(", ")} · {formatDateTime(c.createdAtUtc.endsWith("Z") ? c.createdAtUtc : `${c.createdAtUtc}Z`)}
                      </p>
                    </div>
                    <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>
    </>
  );
}
