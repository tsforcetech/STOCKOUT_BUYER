/**
 * PA-1A policies, acceptance and consent (services/user-organization; gateway /api/v1/policies, /api/v1/privacy,
 * /api/v1/users/me/communication-preferences). Success bodies are enveloped { success, data }.
 * C# source: Contracts/Policies/PolicyContracts.cs. Errors are ProblemDetails with a top-level `code`.
 */
import type { Guid, IsoDateTime } from "./user-organization";

/** POLICY_DOCUMENT.Audience. */
export type PolicyAudience = "ALL" | "BUYER" | "SELLER" | (string & {});

/** C# PolicySummaryResponse — GET /policies, GET /policies/me/pending. */
export interface PolicySummaryResponse {
  policyDocumentId: Guid;
  policyCode: string;
  name: string;
  description: string | null;
  audience: PolicyAudience;
  isMandatory: boolean;
  policyRevisionId: Guid;
  revisionCode: string;
  languageCode: string;
  effectiveFromUtc: IsoDateTime;
  publishedAtUtc: IsoDateTime | null;
  status: string;
  title: string;
  contentHash: string;
}

/** C# PolicyDetailResponse — GET /policies/{code}. `content` is Markdown. */
export interface PolicyDetailResponse extends PolicySummaryResponse {
  content: string;
}

/** C# UserPolicyAcceptanceResponse — GET /policies/me/acceptances, POST /policies/me/accept. */
export interface UserPolicyAcceptanceResponse {
  acceptanceId: Guid;
  userId: Guid;
  organizationId: Guid | null;
  policyRevisionId: Guid;
  policyCode: string;
  acceptedAtUtc: IsoDateTime;
  acceptanceSource: string;
  auditReference: string | null;
  createdAtUtc: IsoDateTime;
  revisionCode: string | null;
  title: string | null;
  languageCode: string | null;
}

/** C# AcceptPolicyRequest. affirmativeAcceptance must be true; the server adds the audit reference. */
export interface AcceptPolicyRequest {
  policyRevisionId: Guid;
  affirmativeAcceptance: true;
  organizationId?: Guid | null;
  acceptanceSource?: string;
  contentHash?: string | null;
}

/** C# CookieConsentRequest — PUT /privacy/cookie-preferences. Strictly necessary cookies are always on. */
export interface CookieConsentRequest {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  consentRevision?: string;
  /** Guests only ("anon:<uuid>", kept in localStorage `stk_cookie_token`). */
  anonymousToken?: string | null;
}

/**
 * C# CookieConsentResponse. When nothing was saved yet the server returns defaults with
 * cookiePreferenceId = 00000000-0000-0000-0000-000000000000.
 */
export interface CookieConsentResponse {
  cookiePreferenceId: Guid;
  subjectId: string;
  userId: Guid | null;
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  consentRevision: string;
  updatedAtUtc: IsoDateTime;
}

/** C# CommunicationPreferenceRequest. Marketing is opt-in; transactional messages aren't covered. */
export interface CommunicationPreferenceRequest {
  marketingEmail: boolean;
  marketingSms: boolean;
  consentSource?: string;
}

/** C# CommunicationPreferenceResponse. */
export interface CommunicationPreferenceResponse {
  userId: Guid;
  marketingEmail: boolean;
  marketingSms: boolean;
  consentSource: string;
  updatedAtUtc: IsoDateTime;
}
