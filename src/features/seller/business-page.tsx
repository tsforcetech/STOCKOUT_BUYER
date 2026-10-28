import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PaperPlaneTiltIcon, PencilSimpleIcon, PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import { DetailList, PageHeader } from "@/components/common/page-header";
import { RefreshButton, SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState } from "@/components/feedback/states";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDate, humanize } from "@/lib/utils/format";
import { isApiError } from "@/lib/api/errors";
import { usePolicyGate } from "@/features/legal/policy-gate";
import { marketplaceService } from "@/services/marketplace.service";
import { AddDocumentDialog, type UploadCategory } from "./components/add-document-dialog";
import { BusinessProfileDialog } from "./components/business-profile-dialog";
import { KycChecklist } from "./components/kyc-checklist";
import { ListingEligibilityNotice } from "./components/listing-access-notice";
import { kycBlockerHints, kycChecklist, licenceProblem } from "./lib/kyc";
import { DocumentsTable, useSellerDocuments } from "./components/documents-table";
import { Notice } from "./components/notice";
import { OnboardingSteps, onboardingStepIndex } from "./components/onboarding-steps";
import { SellerTimeline } from "./components/seller-timeline";
import { VerificationCard } from "./components/verification-card";
import { sellerAccountErrorMessage } from "./lib/errors";
import { sellerKeys, useActiveSeller, useSellerAccount } from "./lib/queries";

function countryName(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase());
    return name && name !== code.toUpperCase() ? `${name} (${code.toUpperCase()})` : code;
  } catch {
    return code;
  }
}

export default function SellerBusinessPage() {
  const context = useActiveSeller();
  const sellerId = context.sellerId;
  const qc = useQueryClient();
  const { reloadActor } = useAuth();
  const account = useSellerAccount(sellerId);
  const docs = useSellerDocuments(sellerId);
  const [adding, setAdding] = React.useState<UploadCategory | null>(null);
  const [editingProfile, setEditingProfile] = React.useState(false);
  const { recheck } = usePolicyGate();
  const [confirmSubmit, setConfirmSubmit] = React.useState(false);

  const seller = account.data;
  const ownerActive = context.isOwner && context.status === "ACTIVE";
  const docCount = docs.data?.length ?? 0;
  const canSubmit = !!seller && (seller.onboardingStatus === "DRAFT" || seller.verificationStatus === "REJECTED") && seller.status === "ACTIVE";
  const licence = seller ? licenceProblem(seller) : null;
  // Older deployments don't report completeness; then at least one document is required, as before.
  const docsComplete = seller?.mandatoryDocumentsComplete ?? docCount > 0;
  // Name the real reason when files are uploaded but the server still counts a category as missing.
  const hints = seller && !docsComplete ? kycBlockerHints(seller, docs.data ?? []) : [];
  const emptyCategory = seller && !docsComplete ? kycChecklist(seller, docs.data ?? []).some((c) => c.missing && c.docs.length === 0) : false;
  const blockers = seller
    ? [licence, ...hints, emptyCategory || (!docsComplete && !hints.length) ? "Upload a document for every item in the checklist." : null].filter((b): b is string => !!b)
    : [];

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
    <Button variant="action" onClick={() => setAdding("TRADE_LICENSE")}>
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
        {seller?.rejectionReason && seller.verificationStatus === "REJECTED" && (
          <Notice tone="danger" title="Reviewer's reason">
            {seller.rejectionReason}
          </Notice>
        )}
        {ownerActive && <ListingEligibilityNotice sellerId={sellerId} />}
        {seller && seller.verificationStatus !== "VERIFIED" && (
          <SectionCard>
            <OnboardingSteps current={onboardingStepIndex(seller, docCount)} orientation="horizontal" />
          </SectionCard>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            {seller && seller.verificationStatus !== "VERIFIED" && (
              <SectionCard>
                <div className="mb-4">
                  <h2 className="font-heading text-lg font-bold text-foreground">Verification checklist</h2>
                  <p className="text-sm text-muted-foreground">Everything our reviewers need. Each item must be uploaded before you can submit.</p>
                </div>
                <KycChecklist seller={seller} docs={docs.data ?? []} canEdit={ownerActive} onUpload={setAdding} onEditProfile={() => setEditingProfile(true)} />
              </SectionCard>
            )}

            <SectionCard>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-heading text-lg font-bold text-foreground">Verification documents</h2>
                  <p className="text-sm text-muted-foreground">Reviewers check each document. Expired documents can't be uploaded.</p>
                </div>
                {(docCount > 0 || docs.isError) && addButton}
              </div>
              {!ownerActive && (
                <Notice tone="warning" className="mb-4">
                  Only the owner of an active seller account can view or change documents.
                </Notice>
              )}
              <DocumentsTable sellerId={sellerId} canDelete={ownerActive} emptyAction={addButton} />
            </SectionCard>

            {seller && seller.verificationStatus !== "VERIFIED" && (
              <SectionCard>
                <h2 className="font-heading text-lg font-bold text-foreground">Submit for review</h2>
                {canSubmit ? (
                  <>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {seller.verificationStatus === "REJECTED"
                        ? "Your previous submission wasn't approved. Fix the items marked in the checklist, then submit again."
                        : "When your profile and documents are ready, send them to our team for review."}
                    </p>
                    {blockers.length > 0 && !docs.isLoading && (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {blockers.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-4">
                      <Button variant="primary" onClick={() => setConfirmSubmit(true)} disabled={blockers.length > 0 || docs.isLoading || !ownerActive}>
                        <PaperPlaneTiltIcon /> Submit for review
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {seller.status !== "ACTIVE"
                      ? "Suspended accounts can't be submitted for review."
                      : "Your submission is with our team. You can't withdraw it, but you can still add documents if asked."}
                  </p>
                )}
              </SectionCard>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <SectionCard>
              <div className="mb-4 flex items-start justify-between gap-3">
                <h2 className="font-heading text-lg font-bold text-foreground">Business profile</h2>
                {seller && ownerActive && (
                  <Button variant="secondary" size="sm" onClick={() => setEditingProfile(true)}>
                    <PencilSimpleIcon /> Edit
                  </Button>
                )}
              </div>
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
                  <DetailList
                    columns={1}
                    items={[
                      { label: "Display name", value: seller.displayName },
                      { label: "Legal name", value: seller.legalName },
                      { label: "Seller type", value: humanize(seller.organizationType) },
                      { label: "Trade licence", value: [seller.tradeLicenseNumber ?? seller.registrationNo, seller.issuingAuthority].filter(Boolean).join(" · ") || null },
                      {
                        label: "Licence expiry",
                        value: seller.tradeLicenseExpiresAtUtc ? formatDate(seller.tradeLicenseExpiresAtUtc) : <span className="text-danger">Not set</span>,
                      },
                      {
                        label: "VAT",
                        value: seller.isVatRegistered ? `Registered · TRN ${seller.taxRegistrationNumber ?? "—"}` : seller.hasVatDeclaration ? "Not registered (declaration)" : "Not set",
                      },
                      { label: "Signatory", value: [seller.signatoryName, seller.signatoryAuthorityRole].filter(Boolean).join(" · ") || null },
                      { label: "Bank", value: [seller.bankName, seller.bankIban].filter(Boolean).join(" · ") || null },
                      { label: "Country", value: countryName(seller.countryCode) },
                      { label: "Default currency", value: seller.defaultCurrency },
                      { label: "Account status", value: <StatusBadge value={seller.status} /> },
                      { label: "Your role", value: context.isOwner ? "Owner" : "Member" },
                    ]}
                  />
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

      <AddDocumentDialog
        sellerId={sellerId}
        open={adding !== null}
        initialCategory={adding ?? "TRADE_LICENSE"}
        vatRegistered={!!seller?.isVatRegistered}
        onOpenChange={(o) => !o && setAdding(null)}
      />
      {seller && <BusinessProfileDialog seller={seller} open={editingProfile} onOpenChange={setEditingProfile} />}
      <ConfirmDialog
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        tone="primary"
        title="Submit for review?"
        description={`You're submitting your business profile and ${docCount} document${docCount === 1 ? "" : "s"}. You can't withdraw a submission once it's sent.`}
        confirmLabel="Submit"
        loading={submit.isPending}
        onConfirm={() =>
          submit.mutate(undefined, {
            onError: (e) => {
              void account.refetch();
              if (isApiError(e) && e.code === "POLICY_ACCEPTANCE_REQUIRED") {
                setConfirmSubmit(false);
                void recheck();
              }
              toast.error(sellerAccountErrorMessage(e, "This account was already submitted or changed since you loaded it. We refreshed the status."));
            },
          })
        }
      />
    </>
  );
}
