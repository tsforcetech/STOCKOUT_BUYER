import * as React from "react";
import { Link } from "react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArchiveIcon, CaretRightIcon, IdentificationCardIcon, PackageIcon, ListNumbersIcon, NotePencilIcon, PauseCircleIcon, PlusIcon, RocketLaunchIcon, StackIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatCards, type StatItem } from "@/components/common/stat-cards";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Skeleton } from "@/components/ui/misc";
import { StatusBadge } from "@/components/common/status-badge";
import { formatNumber, timeAgo } from "@/lib/utils/format";
import { sellerListingsService } from "@/services/seller-listings.service";
import type { ListingStatus, SellerListingListItemResponse, SellerListingListQuery } from "@/api/types/seller-listings";
import { LISTING_STATUS_LABELS } from "./lib/listing";
import { ListingAccessNotice, canManageListings } from "./components/listing-access-notice";
import { VerificationCard } from "./components/verification-card";
import { sellerErrorMessage } from "./lib/errors";
import { sellerKeys, useActiveSeller, useCategoryIndex, useSellerAccount } from "./lib/queries";

const COUNTS: Array<{ status: ListingStatus | undefined; label: string; hint: string; icon: React.ReactNode }> = [
  { status: undefined, label: "All listings", hint: "Every listing you've created", icon: <StackIcon /> },
  { status: "DRAFT", label: "Drafts", hint: "Being prepared or in review", icon: <NotePencilIcon /> },
  { status: "PUBLISHED", label: "Live", hint: "Visible to buyers", icon: <RocketLaunchIcon /> },
  { status: "SUSPENDED", label: "Paused / suspended", hint: "Hidden from buyers", icon: <PauseCircleIcon /> },
];

export default function SellerDashboardPage() {
  const seller = useActiveSeller();
  const sellerId = seller.sellerId;
  const enabled = canManageListings(seller);
  const account = useSellerAccount(sellerId);
  const { index: categories } = useCategoryIndex();

  // Totals by listing status: the list endpoint returns totalCount per status filter (pageSize 1 keeps it cheap).
  const counts = useQueries({
    queries: COUNTS.map((c) => {
      const query: SellerListingListQuery = { page: 1, pageSize: 1, status: c.status };
      return { queryKey: sellerKeys.listingList(sellerId, query), queryFn: ({ signal }: { signal: AbortSignal }) => sellerListingsService.list(sellerId, query, signal), enabled };
    }),
  });

  const recentQuery: SellerListingListQuery = { page: 1, pageSize: 5, sort: "CreatedAtUtcDesc" };
  const recent = useQuery({ queryKey: sellerKeys.listingList(sellerId, recentQuery), queryFn: ({ signal }) => sellerListingsService.list(sellerId, recentQuery, signal), enabled });

  const stats: StatItem[] = COUNTS.map((c, i) => {
    const q = counts[i];
    return {
      label: c.label,
      value: formatNumber(q.data?.totalCount),
      hint: c.hint,
      icon: c.icon,
      loading: enabled && q.isLoading,
      unavailable: !enabled ? "Not available for this account" : q.error ? sellerErrorMessage(q.error) : undefined,
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="Seller portal"
        title={`Welcome${seller.displayName ? `, ${seller.displayName}` : ""}`}
        description="Your verification status, listings at a glance and quick actions."
        actions={
          enabled && (
            <Button asChild variant="action">
              <Link to="/seller/listings/quick">
                <PlusIcon /> New listing
              </Link>
            </Button>
          )
        }
      />
      <div className="space-y-4">
        <VerificationCard seller={account.data} isLoading={account.isLoading} error={account.error} onRetry={() => void account.refetch()} />
        <ListingAccessNotice seller={seller} />
        <StatCards items={stats} className="grid-cols-2" />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <SectionCard>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-bold text-foreground">Recent listings</h2>
              <Button asChild variant="secondary" size="sm">
                <Link to="/seller/listings">View all</Link>
              </Button>
            </div>
            <RecentListings
              items={enabled ? recent.data?.items : []}
              isLoading={enabled && recent.isLoading}
              error={recent.error}
              onRetry={() => void recent.refetch()}
              categoryPath={(id) => categories.get(id)?.path.join(" › ")}
              empty={
                <EmptyState
                  className="rounded-lg border border-dashed border-border-strong py-10"
                  title="No listings yet"
                  description={enabled ? "Create your first listing — you can prepare drafts while verification is in progress." : "Listings are unavailable for this account."}
                  action={
                    enabled && (
                      <Button asChild variant="action">
                        <Link to="/seller/listings/quick">
                          <PlusIcon /> New listing
                        </Link>
                      </Button>
                    )
                  }
                />
              }
            />
          </SectionCard>

          <SectionCard>
            <h2 className="mb-3 font-heading text-lg font-bold text-foreground">Quick actions</h2>
            <nav aria-label="Quick actions" className="flex flex-col gap-2">
              {enabled && (
                <Button asChild variant="action" className="justify-start">
                  <Link to="/seller/listings/quick">
                    <PlusIcon /> Create a listing
                  </Link>
                </Button>
              )}
              <Button asChild variant="secondary" className="justify-start">
                <Link to="/seller/listings">
                  <ListNumbersIcon /> Manage listings
                </Link>
              </Button>
              <Button asChild variant="secondary" className="justify-start">
                <Link to="/seller/listings?status=ARCHIVED">
                  <ArchiveIcon /> Archived listings
                </Link>
              </Button>
              <Button asChild variant="secondary" className="justify-start">
                <Link to="/seller/business">
                  <IdentificationCardIcon /> Business & verification
                </Link>
              </Button>
            </nav>
          </SectionCard>
        </div>
      </div>
    </>
  );
}

function RecentListings({
  items,
  isLoading,
  error,
  onRetry,
  categoryPath,
  empty,
}: {
  items: SellerListingListItemResponse[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  categoryPath: (categoryId: string) => string | undefined;
  empty: React.ReactNode;
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} title="Couldn't load your listings" />;
  if (isLoading) {
    return (
      <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Loading recent listings">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-3 py-3 sm:px-4">
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  const list = items ?? [];
  if (!list.length) return <>{empty}</>;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border" aria-label="Recent listings">
      {list.map((l) => {
        const updated = timeAgo(l.updatedAtUtc ?? l.createdAtUtc);
        return (
          <li key={l.listingId}>
            <Link to={`/seller/listings/${l.listingId}`} className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-surface-muted sm:px-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-foreground ring-1 ring-border [&_svg]:size-[18px]" aria-hidden>
                <PackageIcon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{l.title || "Untitled listing"}</span>
                <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <span className="shrink-0 sm:hidden">
                    <StatusBadge value={l.status} label={LISTING_STATUS_LABELS[l.status]} />
                  </span>
                  <span className="truncate">{categoryPath(l.categoryId) ?? "—"}</span>
                </span>
              </span>
              <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                <StatusBadge value={l.status} label={LISTING_STATUS_LABELS[l.status]} />
                {updated && <span className="text-xs text-muted-foreground">Updated {updated}</span>}
              </span>
              <CaretRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
