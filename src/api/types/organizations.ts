/**
 * PA-1B.2 organization membership, invitations and business changes (services/user-organization).
 * Enveloped { success, data }. Errors: ProblemDetails with a top-level `code`.
 * Source of truth: Contracts/OrganizationMembershipContracts.cs, OrganizationInvitationContracts.cs,
 * OrganizationBusinessChangeContracts.cs and the controllers — the PA1B2 guide's routes/fields differ in places.
 */
import type { Guid, IsoDateTime } from "./user-organization";

/** Organization roles. Owner can't be granted by invitation (INVALID_ROLE). */
export type OrganizationRoleCode = "Owner" | "Admin" | "Manager" | "Staff";
export const INVITABLE_ROLES: OrganizationRoleCode[] = ["Admin", "Manager", "Staff"];

/** Company-scoped permission codes returned by GET …/my-permissions. */
export const ORG_PERMS = {
  MEMBERS_VIEW: "organization.members.view",
  MEMBERS_INVITE: "organization.members.invite",
  MEMBERS_MANAGE: "organization.members.manage",
  MEMBERS_REMOVE: "organization.members.remove",
  PROFILE_VIEW: "organization.profile.view",
  CHANGES_SUBMIT: "organization.business_changes.submit",
} as const;

/** C# OrganizationMemberResponse. membershipStatus is upper-case on the live API (ACTIVE / SUSPENDED / REMOVED). */
export interface OrganizationMemberResponse {
  memberId: Guid;
  organizationId: Guid;
  userId: Guid;
  email: string;
  displayName: string;
  roleCode: string;
  membershipStatus: string;
  isOwner: boolean;
  joinedAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime | null;
  rowVersion: string;
}

/** C# OrganizationUserPermissionsResponse — GET /organizations/{id}/my-permissions. */
export interface OrganizationUserPermissionsResponse {
  organizationId: Guid;
  roleCode: string;
  membershipStatus: string;
  isOwner: boolean;
  permissions: string[];
}

export interface BuyerCapabilitySummary {
  buyerId: Guid | null;
  verificationStatus: string;
  canPurchase: boolean;
  isEnabled: boolean;
}
export interface SellerCapabilitySummary {
  sellerId: Guid | null;
  verificationStatus: string;
  onboardingStatus: string;
  canSell: boolean;
  isEnabled: boolean;
}

/** C# OrganizationMembershipSummary — GET /organizations/me/memberships. */
export interface OrganizationMembershipSummary {
  organizationId: Guid;
  displayName: string;
  legalName: string | null;
  registrationNo: string | null;
  countryCode: string;
  defaultCurrency: string;
  orgStatus: string;
  verificationStatus: string;
  membership: OrganizationMemberResponse;
  buyerCapability: BuyerCapabilitySummary;
  sellerCapability: SellerCapabilitySummary;
  permissions: string[];
}

export interface UpdateMemberRoleRequest {
  roleCode: OrganizationRoleCode;
  expectedRowVersion?: string | null;
}
export interface SuspendMemberRequest {
  reason?: string | null;
  expectedRowVersion?: string | null;
}
export interface ReactivateMemberRequest {
  expectedRowVersion?: string | null;
}
/** POST /organizations/{id}/transfer-ownership — the target is identified by memberId (not userId). */
export interface TransferOwnershipRequest {
  newOwnerMemberId: Guid;
  expectedRowVersion?: string | null;
}

// Invitations ------------------------------------------------------------------------------------

export interface CreateOrganizationInvitationRequest {
  email: string;
  roleCode: OrganizationRoleCode;
}
/** C# OrganizationInvitationResponse. */
export interface OrganizationInvitationResponse {
  invitationId: Guid;
  organizationId: Guid;
  email: string;
  roleCode: string;
  status: string;
  invitedByUserId: Guid;
  expiresAtUtc: IsoDateTime;
  resentCount: number;
  lastResentAtUtc: IsoDateTime | null;
  createdAtUtc: IsoDateTime;
  rowVersion: string;
}
export interface RevokeOrganizationInvitationRequest {
  reason?: string | null;
}
/** C# OrganizationInvitationPreviewResponse — GET /organization-invitations/{token}/preview (anonymous). */
export interface OrganizationInvitationPreviewResponse {
  invitationId: Guid;
  organizationId: Guid;
  organizationName: string;
  roleCode: string;
  status: string;
  expiresAtUtc: IsoDateTime;
  maskedEmail: string;
}
/** C# AcceptOrganizationInvitationResponse — POST /organization-invitations/{token}/accept (signed in). */
export interface AcceptOrganizationInvitationResponse {
  memberId: Guid;
  organizationId: Guid;
  organizationName: string;
  roleCode: string;
  membershipStatus: string;
  isOwner: boolean;
}

// Business changes ---------------------------------------------------------------------------------

/** OrganizationBusinessChangeService valid categories (INVALID_CHANGE_CATEGORY otherwise). */
export type BusinessChangeCategory = "TRADE_LICENCE" | "VAT_TRN" | "BANK_ACCOUNT" | "AUTHORISED_SIGNATORY" | "LEGAL_OWNERSHIP" | "REGISTERED_COMPANY_DETAILS";

export interface BusinessChangeDocumentAttachment {
  documentType: string;
  mediaAssetId: Guid;
  fileName: string;
  fileSize: number;
  mimeType: string;
}
/** C# CreateBusinessChangeRequest. proposedValues is a JSON object. */
export interface CreateBusinessChangeRequest {
  changeCategory: BusinessChangeCategory;
  reason: string;
  effectiveDate: IsoDateTime;
  proposedValues: Record<string, string>;
  documents?: BusinessChangeDocumentAttachment[] | null;
}
export interface BusinessChangeDocumentDto extends BusinessChangeDocumentAttachment {
  documentId: Guid;
  requestId: Guid;
  organizationId: Guid;
  createdAtUtc: IsoDateTime;
}
export interface BusinessChangeHistoryDto {
  historyId: Guid;
  requestId: Guid;
  organizationId: Guid;
  fromStatus: string;
  toStatus: string;
  performedByUserId: Guid;
  notes: string | null;
  occurredAtUtc: IsoDateTime;
}
/** C# BusinessChangeRequestResponse. reportingDeadlineUtc / isOverdue come from the server's UAE calendar — never computed here. */
export interface BusinessChangeRequestResponse {
  requestId: Guid;
  organizationId: Guid;
  organizationName: string;
  organizationLegalName: string | null;
  changeCategory: string;
  status: string;
  reason: string;
  effectiveDate: IsoDateTime;
  reportingDeadlineUtc: IsoDateTime;
  isOverdue: boolean;
  previousValues: unknown;
  proposedValues: unknown;
  submittedByUserId: Guid | null;
  submittedAtUtc: IsoDateTime | null;
  reviewedByUserId: Guid | null;
  reviewedAtUtc: IsoDateTime | null;
  reviewNotes: string | null;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime;
  rowVersion: string;
  documents?: BusinessChangeDocumentDto[] | null;
  history?: BusinessChangeHistoryDto[] | null;
}
