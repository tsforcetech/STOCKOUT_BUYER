import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { ErrorState, PageSkeleton } from "@/components/feedback/states";
import { useUrlState } from "@/hooks/use-url-state";
import { sellerListingsService } from "@/services/seller-listings.service";
import { ListingAccessNotice, canManageListings } from "./components/listing-access-notice";
import { sellerErrorMessage } from "./lib/errors";
import { sellerKeys, useActiveSeller, useListingDetail } from "./lib/queries";
import { AttributesTab } from "./workspace/attributes-tab";
import { DetailsTab } from "./workspace/details-tab";
import { InventoryTab } from "./workspace/inventory-tab";
import { MediaTab } from "./workspace/media-tab";
import { ReviewTab } from "./workspace/review-tab";
import { WorkspaceHeader } from "./workspace/workspace-header";
import { ListingCorrectionsBanner } from "./lib/corrections";

const TABS = [
  { value: "details", label: "Details" },
  { value: "attributes", label: "Attributes" },
  { value: "media", label: "Media" },
  { value: "inventory", label: "Inventory" },
  { value: "review", label: "Review" },
] as const;

export default function SellerListingEditPage() {
  const { listingId = "" } = useParams();
  const seller = useActiveSeller();
  const sellerId = seller.sellerId;
  const enabled = canManageListings(seller);
  const [state, setState] = useUrlState({ tab: "details" });
  const detail = useListingDetail(sellerId, listingId);
  const moderation = useQuery({
    queryKey: sellerKeys.moderation(sellerId, listingId),
    queryFn: ({ signal }) => sellerListingsService.moderationStatus(sellerId, listingId, signal),
    enabled: !!detail.data,
  });

  if (!enabled) {
    return (
      <>
        <PageHeader eyebrow="Seller portal" title="Listing" />
        <ListingAccessNotice seller={seller} />
      </>
    );
  }
  if (detail.isLoading) return <PageSkeleton />;
  if (detail.error || !detail.data) {
    return (
      <SectionCard>
        <ErrorState
          error={detail.error}
          title={detail.error ? sellerErrorMessage(detail.error) : "Listing not found"}
          onRetry={() => void detail.refetch()}
        />
        <div className="flex justify-center">
          <Button asChild variant="secondary">
            <Link to="/seller/listings">Back to listings</Link>
          </Button>
        </div>
      </SectionCard>
    );
  }

  const listing = detail.data;
  const tab = TABS.some((t) => t.value === state.tab) ? state.tab : "details";

  return (
    <>
      <WorkspaceHeader sellerId={sellerId} listing={listing} moderation={moderation.data} />
      <ListingCorrectionsBanner sellerId={sellerId} listingId={listing.listingId} />
      <SectionCard>
        <Tabs value={tab} onValueChange={(v) => setState({ tab: v })}>
          <TabsList aria-label="Listing sections" className="-mx-4 px-4 sm:mx-0 sm:px-0">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {/* Details and attributes stay mounted so unsaved edits survive tab switches. */}
          <TabsContent value="details" forceMount className="data-[state=inactive]:hidden">
            <DetailsTab sellerId={sellerId} listing={listing} />
          </TabsContent>
          <TabsContent value="attributes" forceMount className="data-[state=inactive]:hidden">
            <AttributesTab sellerId={sellerId} listing={listing} />
          </TabsContent>
          <TabsContent value="media">
            <MediaTab sellerId={sellerId} listing={listing} />
          </TabsContent>
          <TabsContent value="inventory">
            <InventoryTab sellerId={sellerId} listing={listing} />
          </TabsContent>
          <TabsContent value="review">
            <ReviewTab sellerId={sellerId} listing={listing} moderation={moderation} />
          </TabsContent>
        </Tabs>
      </SectionCard>
    </>
  );
}
