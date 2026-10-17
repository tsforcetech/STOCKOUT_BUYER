import * as React from "react";
import { Link, useNavigate } from "react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArchiveIcon, IdentificationCardIcon, ListNumbersIcon, NotePencilIcon, PauseCircleIcon, PlusIcon, RocketLaunchIcon, StackIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatCards, type StatItem } from "@/components/common/stat-cards";
import { DataTable } from "@/components/tables/data-table";
import { formatNumber } from "@/lib/utils/format";
import { sellerListingsService } from "@/services/seller-listings.service";
import type { ListingStatus, SellerListingListQuery } from "@/api/types/seller-listings";
import { baseListingColumns } from "./components/listing-columns";
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
  const navigate = useNavigate();
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

  const columns = React.useMemo(() => baseListingColumns(categories), [categories]);

  return (
    <>
      <PageHeader
        eyebrow="Seller portal"
        title={`Welcome${seller.displayName ? `, ${seller.displayName}` : ""}`}
        description="Your verification status, listings at a glance and quick actions."
        actions={
          enabled && (
            <Button asChild variant="action">
              <Link to="/seller/listings/new">
                <PlusIcon /> New listing
              </Link>
            </Button>
          )
        }
      />
      <div className="space-y-4">
        <VerificationCard seller={account.data} isLoading={account.isLoading} error={account.error} onRetry={() => void account.refetch()} />
        <ListingAccessNotice seller={seller} />
        <StatCards items={stats} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <SectionCard>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-bold text-foreground">Recent listings</h2>
              <Button asChild variant="secondary" size="sm">
                <Link to="/seller/listings">View all</Link>
              </Button>
            </div>
            <DataTable
              caption="Recent listings"
              columns={columns}
              data={enabled ? recent.data?.items : []}
              getRowId={(l) => l.listingId}
              isLoading={enabled && recent.isLoading}
              error={recent.error}
              onRetry={() => void recent.refetch()}
              onRowClick={(l) => navigate(`/seller/listings/${l.listingId}`)}
              emptyTitle="No listings yet"
              emptyDescription={enabled ? "Create your first listing — you can prepare drafts while verification is in progress." : "Listings are unavailable for this account."}
              emptyAction={
                enabled && (
                  <Button asChild variant="action">
                    <Link to="/seller/listings/new">
                      <PlusIcon /> New listing
                    </Link>
                  </Button>
                )
              }
              pageSizeOptions={[5, 10]}
            />
          </SectionCard>

          <SectionCard>
            <h2 className="mb-3 font-heading text-lg font-bold text-foreground">Quick actions</h2>
            <nav aria-label="Quick actions" className="flex flex-col gap-2">
              {enabled && (
                <Button asChild variant="action" className="justify-start">
                  <Link to="/seller/listings/new">
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
