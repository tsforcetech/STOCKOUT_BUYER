import * as React from "react";
import { useNavigate } from "react-router";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { PageSkeleton } from "@/components/feedback/states";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useUrlState } from "@/hooks/use-url-state";
import { newId } from "@/lib/utils/id";
import { sellerListingsService } from "@/services/seller-listings.service";
import type { CreateListingDraftRequest } from "@/api/types/seller-listings";
import { CategoryPicker } from "./components/category-picker";
import { ListingAccessNotice, canManageListings } from "./components/listing-access-notice";
import { ListingDetailsForm } from "./components/listing-details-form";
import { Notice } from "./components/notice";
import { Stepper } from "./components/stepper";
import { BackLink } from "./components/back-link";
import { emptyListingForm } from "./lib/listing-form";
import { sellerKeys, useActiveSeller, useCategoryIndex, useSellerAccount } from "./lib/queries";

const STEPS = ["Choose category", "Core details"] as const;

export default function SellerListingNewPage() {
  const seller = useActiveSeller();
  const sellerId = seller.sellerId;
  const navigate = useNavigate();
  const [state, setState] = useUrlState({ category: "", step: 1 });
  const [picked, setPicked] = React.useState<string>(state.category);
  const { index } = useCategoryIndex();
  const account = useSellerAccount(sellerId);
  // Idempotency: one key per create attempt; reused while retrying the identical body, renewed when the body changes.
  const attempt = React.useRef<{ body: string; key: string } | null>(null);

  const create = useApiMutation({
    toastOnError: false,
    mutationFn: (body: CreateListingDraftRequest) => {
      const json = JSON.stringify(body);
      if (!attempt.current || attempt.current.body !== json) attempt.current = { body: json, key: newId() };
      return sellerListingsService.create(sellerId, body, attempt.current.key);
    },
    invalidate: [sellerKeys.listings(sellerId)],
    successMessage: "Draft created. Add photos, attributes and stock next.",
    onSuccess: (res) => navigate(`/seller/listings/${res.listingId}`, { replace: true }),
  });

  const categoryId = state.category;
  const step = categoryId && state.step === 2 ? 2 : 1;
  const category = categoryId ? index.get(categoryId) : undefined;

  if (!canManageListings(seller)) {
    return (
      <>
        <BackLink to="/seller/listings">All listings</BackLink>
        <PageHeader eyebrow="Seller portal" title="New listing" />
        <ListingAccessNotice seller={seller} />
      </>
    );
  }

  return (
    <>
      <BackLink to="/seller/listings">All listings</BackLink>
      <PageHeader
        eyebrow="Seller portal"
        title="New listing"
        description="Start with the category, then the core details. Photos, attributes and stock come next."
      />
      <Stepper steps={STEPS} current={step} />
      {step === 1 ? (
        <SectionCard>
          <h2 className="mb-4 font-heading text-lg font-bold text-foreground">Choose a category</h2>
          <CategoryPicker value={picked || null} onSelect={setPicked} />
          <div className="mt-4 flex justify-end">
            <Button variant="primary" disabled={!picked} onClick={() => setState({ category: picked, step: 2 })}>
              Continue <ArrowRightIcon />
            </Button>
          </div>
        </SectionCard>
      ) : account.isLoading ? (
        <PageSkeleton />
      ) : (
        <SectionCard>
          <h2 className="mb-4 font-heading text-lg font-bold text-foreground">Core details</h2>
          <ListingDetailsForm
            key={categoryId}
            categoryId={categoryId}
            categoryLabel={category ? category.path.join(" › ") : categoryId}
            onChangeCategory={() => {
              setPicked(categoryId);
              setState({ step: 1 });
            }}
            defaultValues={emptyListingForm(account.data?.defaultCurrency ?? "AED", null)}
            submitLabel="Create draft"
            onSubmit={async (payload) => {
              await create.mutateAsync(payload);
            }}
          >
            <Notice>
              Stock quantity isn't part of this step — set it in the listing's <strong>Inventory</strong> tab after the draft is created. The draft stays private until it's approved and published.
            </Notice>
          </ListingDetailsForm>
        </SectionCard>
      )}
    </>
  );
}
