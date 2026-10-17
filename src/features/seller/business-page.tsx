import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PaperPlaneTiltIcon, PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import { DetailList, PageHeader } from "@/components/common/page-header";
import { RefreshButton, SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState } from "@/components/feedback/states";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useAuth } from "@/lib/auth/auth-context";
import { humanize } from "@/lib/utils/format";
import { marketplaceService } from "@/services/marketplace.service";
import { AddDocumentDialog } from "./components/add-document-dialog";
import { DocumentsTable, useSellerDocuments } from "./components/documents-table";
import { Notice } from "./components/notice";
import { OnboardingSteps, onboardingStepIndex } from "./components/onboarding-steps";
import { SellerTimeline } from "./components/seller-timeline";
import { VerificationCard } from "./components/verification-card";
import { sellerAccountErrorMessage } from "./lib/errors";
import { sellerKeys, useActiveSeller, useSellerAccount } from "./lib/queries";

export default function SellerBusinessPage() {
  const context = useActiveSeller();
  const sellerId = context.sellerId;
  const qc = useQueryClient();
  const { reloadActor } = useAuth();
  const account = useSellerAccount(sellerId);
  const docs = useSellerDocuments(sellerId);
  const [adding, setAdding] = React.useState(false);
  const [confirmSubmit, setConfirmSubmit] = React.useState(false);

  const seller = account.data;
  const ownerActive = context.isOwner && context.status === "ACTIVE";
  const docCount = docs.data?.length ?? 0;
  const canSubmit = !!seller && seller.onboardingStatus === "DRAFT" && seller.status === "ACTIVE";

  const submit = useApiMutation({
    toastOnError: false,
    mutationFn: async () => {
      // expectedRowVersion must come from a fresh GET seller (409 is returned for stale versions and wrong state alike).
      const fresh = await qc.fetchQuery({ queryKey: sellerKeys.seller(sellerId), queryFn: ({ signal }) => marketplaceService.seller(sellerId, signal), staleTime: 0 });
      return marketplaceService.submitSeller(sellerId, fresh.rowVersion);
    },
    onSuccess: async (updated) => {
      qc.setQueryData(sellerKeys.seller(sellerId), updated);
      setConfirmSubmit(false);
      toast.success("Submitted for review. We'll let you know once it's checked.");
      await reloadActor();
    },
  });

  const addButton = ownerActive && (
    <Button variant="action" onClick={() => setAdding(true)}>
      <PlusIcon /> Add document
    </Button>
  );

  return (
    <>
      <PageHeader
        eyebrow="Seller portal"
        title="Business & verification"
        description="Your seller details, verification documents and review status."
        actions={<RefreshButton onClick={() => void Promise.all([account.refetch(), docs.refetch()])} spinning={account.isFetching || docs.isFetching} />}
      />
      <div className="space-y-4">
        <VerificationCard seller={seller} isLoading={account.isLoading} error={account.error} onRetry={() => void account.refetch()} showLink={false} />
        {seller && seller.verificationStatus !== "VERIFIED" && (
          <SectionCard>
            <OnboardingSteps current={onboardingStepIndex(seller, docCount)} orientation="horizontal" />
          </SectionCard>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <SectionCard>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-heading text-lg font-bold text-foreground">Verification documents</h2>
                  <p className="text-sm text-muted-foreground">Reviewers use these to verify your account. Expired documents may delay verification.</p>
                </div>
                {addButton}
              </div>
              {!ownerActive && (
                <Notice tone="warning" className="mb-4">
                  Only the owner of an active seller account can view or change documents.
                </Notice>
              )}
              <DocumentsTable sellerId={sellerId} canDelete={ownerActive} emptyAction={addButton} />
            </SectionCard>

            {seller && (
              <SectionCard>
                <h2 className="font-heading text-lg font-bold text-foreground">Submit for review</h2>
                {canSubmit ? (
                  <>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {seller.verificationStatus === "REJECTED"
                        ? "Your previous submission wasn't approved. Update your documents, then submit again."
                        : "When your documents are ready, send them to our team for review."}
                    </p>
                    <Notice className="mt-3">
                      The marketplace doesn't technically require documents to submit, but reviewers can't verify you without them — so we ask for at least one.
                    </Notice>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button variant="primary" onClick={() => setConfirmSubmit(true)} disabled={docCount === 0 || docs.isLoading}>
                        <PaperPlaneTiltIcon /> Submit for review
                      </Button>
                      {docCount === 0 && !docs.isLoading && <span className="text-sm text-muted-foreground">Add at least one document first.</span>}
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {seller.status !== "ACTIVE"
                      ? "Suspended accounts can't be submitted for review."
                      : seller.verificationStatus === "VERIFIED"
                        ? "Your account is verified. Nothing to submit."
                        : "Your submission is with our team. You can't withdraw it, but you can still add documents if asked."}
                  </p>
                )}
              </SectionCard>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <SectionCard>
              <h2 className="mb-4 font-heading text-lg font-bold text-foreground">Seller details</h2>
              {account.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : account.error ? (
                <ErrorState error={account.error} onRetry={() => void account.refetch()} />
              ) : (
                seller && (
                  <>
                    <DetailList
                      columns={1}
                      items={[
                        { label: "Display name", value: seller.displayName },
                        { label: "Legal name", value: seller.legalName },
                        { label: "Seller type", value: humanize(seller.organizationType) },
                        { label: "Registration no.", value: seller.registrationNo },
                        { label: "Country", value: seller.countryCode },
                        { label: "Default currency", value: seller.defaultCurrency },
                        { label: "Account status", value: <StatusBadge value={seller.status} /> },
                        { label: "Your role", value: context.isOwner ? "Owner" : "Member" },
                      ]}
                    />
                    <p className="mt-4 text-xs text-muted-foreground">These details can't be edited online yet. Contact support if something is wrong.</p>
                  </>
                )
              )}
            </SectionCard>
            {seller && (
              <SectionCard>
                <h2 className="mb-4 font-heading text-lg font-bold text-foreground">Status history</h2>
                <SellerTimeline seller={seller} />
              </SectionCard>
            )}
          </div>
        </div>
      </div>

      <AddDocumentDialog sellerId={sellerId} open={adding} onOpenChange={setAdding} />
      <ConfirmDialog
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        tone="primary"
        title="Submit for review?"
        description={`You're submitting ${docCount} document${docCount === 1 ? "" : "s"}. You can't withdraw a submission once it's sent.`}
        confirmLabel="Submit"
        loading={submit.isPending}
        onConfirm={() =>
          submit.mutate(undefined, {
            onError: (e) => {
              void account.refetch();
              toast.error(sellerAccountErrorMessage(e, "This account was already submitted or changed since you loaded it. We refreshed the status."));
            },
          })
        }
      />
    </>
  );
}
