import { http } from "@/lib/api/client";
import { expectArray, unwrapData, type Envelope } from "@/lib/api/envelope";
import type {
  AcceptOrganizationInvitationResponse,
  BusinessChangeDocumentAttachment,
  BusinessChangeRequestResponse,
  CreateBusinessChangeRequest,
  CreateOrganizationInvitationRequest,
  OrganizationInvitationPreviewResponse,
  OrganizationInvitationResponse,
  OrganizationMemberResponse,
  OrganizationMembershipSummary,
  OrganizationUserPermissionsResponse,
  ReactivateMemberRequest,
  RevokeOrganizationInvitationRequest,
  SuspendMemberRequest,
  TransferOwnershipRequest,
  UpdateMemberRoleRequest,
} from "@/api/types/organizations";

/** PA-1B.2 organization membership, invitations and business changes (user-organization, enveloped). */
const seg = encodeURIComponent;
const org = (id: string) => `/api/v1/organizations/${seg(id)}`;
const get = async <T>(path: string, signal?: AbortSignal) => unwrapData<T>(await http.get<Envelope<T>>(path, { signal }));
const post = async <T>(path: string, body?: unknown) => unwrapData<T>(await http.post<Envelope<T>>(path, body ?? {}));

export const organizationsService = {
  myMemberships: async (signal?: AbortSignal) => expectArray<OrganizationMembershipSummary>(await get("/api/v1/organizations/me/memberships", signal)),
  myPermissions: (orgId: string, signal?: AbortSignal) => get<OrganizationUserPermissionsResponse>(`${org(orgId)}/my-permissions`, signal),

  members: async (orgId: string, signal?: AbortSignal) => expectArray<OrganizationMemberResponse>(await get(`${org(orgId)}/members`, signal)),
  updateRole: async (orgId: string, memberId: string, body: UpdateMemberRoleRequest) =>
    unwrapData<OrganizationMemberResponse>(await http.put<Envelope<OrganizationMemberResponse>>(`${org(orgId)}/members/${seg(memberId)}/role`, body)),
  suspend: (orgId: string, memberId: string, body: SuspendMemberRequest) => post<OrganizationMemberResponse>(`${org(orgId)}/members/${seg(memberId)}/suspend`, body),
  reactivate: (orgId: string, memberId: string, body: ReactivateMemberRequest) => post<OrganizationMemberResponse>(`${org(orgId)}/members/${seg(memberId)}/reactivate`, body),
  remove: async (orgId: string, memberId: string, expectedRowVersion?: string | null) =>
    unwrapData<unknown>(
      await http.delete<Envelope<unknown>>(`${org(orgId)}/members/${seg(memberId)}${expectedRowVersion ? `?expectedRowVersion=${seg(expectedRowVersion)}` : ""}`),
    ),
  transferOwnership: (orgId: string, body: TransferOwnershipRequest) => post<unknown>(`${org(orgId)}/transfer-ownership`, body),

  invitations: async (orgId: string, signal?: AbortSignal) => expectArray<OrganizationInvitationResponse>(await get(`${org(orgId)}/invitations`, signal)),
  invite: (orgId: string, body: CreateOrganizationInvitationRequest) => post<OrganizationInvitationResponse>(`${org(orgId)}/invitations`, body),
  resendInvitation: (orgId: string, invitationId: string) => post<OrganizationInvitationResponse>(`${org(orgId)}/invitations/${seg(invitationId)}/resend`),
  revokeInvitation: (orgId: string, invitationId: string, body: RevokeOrganizationInvitationRequest) =>
    post<unknown>(`${org(orgId)}/invitations/${seg(invitationId)}/revoke`, body),

  /** Anonymous. The token is only ever sent in the path, never logged. */
  previewInvitation: async (token: string, signal?: AbortSignal) =>
    unwrapData<OrganizationInvitationPreviewResponse>(
      await http.get<Envelope<OrganizationInvitationPreviewResponse>>(`/api/v1/organization-invitations/${seg(token)}/preview`, { signal, auth: false }),
    ),
  acceptInvitation: (token: string) => post<AcceptOrganizationInvitationResponse>(`/api/v1/organization-invitations/${seg(token)}/accept`),

  businessChanges: async (orgId: string, signal?: AbortSignal) => expectArray<BusinessChangeRequestResponse>(await get(`${org(orgId)}/business-changes`, signal)),
  businessChange: (orgId: string, requestId: string, signal?: AbortSignal) => get<BusinessChangeRequestResponse>(`${org(orgId)}/business-changes/${seg(requestId)}`, signal),
  createBusinessChange: (orgId: string, body: CreateBusinessChangeRequest) => post<BusinessChangeRequestResponse>(`${org(orgId)}/business-changes`, body),
  addBusinessChangeDocument: (orgId: string, requestId: string, body: BusinessChangeDocumentAttachment) =>
    post<unknown>(`${org(orgId)}/business-changes/${seg(requestId)}/documents`, body),
  submitBusinessChange: (orgId: string, requestId: string) => post<BusinessChangeRequestResponse>(`${org(orgId)}/business-changes/${seg(requestId)}/submit`),
};
