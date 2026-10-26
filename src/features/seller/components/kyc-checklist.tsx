import { CheckCircleIcon, CircleIcon, ClockIcon, UploadSimpleIcon, WarningCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import type { MarketplaceSellerDto, SellerDocumentResponse } from "@/api/types/user-organization";
import { kycChecklist, licenceProblem, type CategoryStatus } from "../lib/kyc";
import type { UploadCategory } from "./add-document-dialog";

/**
 * The submission requirements (PA-1B.1): business profile with a valid licence expiry, plus the four document
 * categories — signatory shown as its two required parts. "Missing" comes from the server's missingDocumentCategories.
 */
export function KycChecklist({
  seller,
  docs,
  canEdit,
  onUpload,
  onEditProfile,
}: {
  seller: MarketplaceSellerDto;
  docs: SellerDocumentResponse[];
  canEdit: boolean;
  onUpload: (category: UploadCategory) => void;
  onEditProfile: () => void;
}) {
  const rows = kycChecklist(seller, docs);
  const licence = licenceProblem(seller);
  return (
    <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Verification checklist">
      <li className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:p-4">
        <StatusIcon state={licence ? "missing" : "done"} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Business profile</p>
          <p className="text-xs text-muted-foreground">{licence ?? "Licence dates, VAT status and contact details saved."}</p>
        </div>
        {canEdit && (
          <Button variant={licence ? "action" : "secondary"} size="sm" onClick={onEditProfile}>
            {licence ? "Complete profile" : "Edit"}
          </Button>
        )}
      </li>
      {rows.map((r) => {
        const state = rowState(r);
        return (
          <li key={r.key} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:p-4">
            <StatusIcon state={state} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">{r.title}</p>
                <StateBadge state={state} />
                {r.needsClassification && <Badge tone="warning">Needs classification</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{r.hint}</p>
            </div>
            {canEdit && state !== "verified" && (
              <Button variant={state === "missing" || state === "rejected" ? "action" : "secondary"} size="sm" onClick={() => onUpload(r.key.startsWith("SIGNATORY") ? "SIGNATORY" : (r.key as UploadCategory))}>
                <UploadSimpleIcon /> Upload
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

type RowState = "missing" | "rejected" | "uploaded" | "verified" | "done";

function rowState(r: CategoryStatus): RowState {
  if (r.verified) return "verified";
  if (r.rejected) return "rejected";
  if (r.missing) return "missing";
  return "uploaded";
}

function StatusIcon({ state }: { state: RowState }) {
  const cls = "size-6 shrink-0";
  if (state === "verified" || state === "done") return <CheckCircleIcon className={`${cls} text-success`} weight="fill" aria-hidden />;
  if (state === "rejected") return <XCircleIcon className={`${cls} text-danger`} weight="fill" aria-hidden />;
  if (state === "uploaded") return <ClockIcon className={`${cls} text-warning`} aria-hidden />;
  if (state === "missing") return <WarningCircleIcon className={`${cls} text-muted-foreground`} aria-hidden />;
  return <CircleIcon className={cls} aria-hidden />;
}

function StateBadge({ state }: { state: RowState }) {
  switch (state) {
    case "verified":
      return <Badge tone="success">Verified</Badge>;
    case "rejected":
      return <Badge tone="danger">Rejected — upload again</Badge>;
    case "uploaded":
      return <Badge tone="warning">Uploaded</Badge>;
    case "missing":
      return <Badge tone="neutral">Missing</Badge>;
    default:
      return null;
  }
}
