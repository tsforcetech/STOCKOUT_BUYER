import { http } from "@/lib/api/client";
import { expectArray, unwrapData, type Envelope } from "@/lib/api/envelope";
import type {
  AcceptPolicyRequest,
  CommunicationPreferenceRequest,
  CommunicationPreferenceResponse,
  CookieConsentRequest,
  CookieConsentResponse,
  PolicyDetailResponse,
  PolicySummaryResponse,
  UserPolicyAcceptanceResponse,
} from "@/api/types/policies";

/**
 * PA-1A policies and consent (user-organization, enveloped { success, data }).
 * Policy reads are anonymous; /me/* and communication preferences need a session; cookie preferences take either
 * the session or an anonymous token. Only English is published (lang=ar returns an empty list).
 */
const seg = encodeURIComponent;
const LANG = "en";
const get = async <T>(path: string, signal?: AbortSignal) => unwrapData<T>(await http.get<Envelope<T>>(path, { signal }));

export const policiesService = {
  list: async (signal?: AbortSignal) => expectArray<PolicySummaryResponse>(await get(`/api/v1/policies?lang=${LANG}`, signal)),
  detail: (code: string, signal?: AbortSignal) => get<PolicyDetailResponse>(`/api/v1/policies/${seg(code)}?lang=${LANG}`, signal),
  pending: async (signal?: AbortSignal) => expectArray<PolicySummaryResponse>(await get(`/api/v1/policies/me/pending?lang=${LANG}`, signal)),
  acceptances: async (signal?: AbortSignal) => expectArray<UserPolicyAcceptanceResponse>(await get("/api/v1/policies/me/acceptances", signal)),
  accept: async (body: AcceptPolicyRequest) => unwrapData<UserPolicyAcceptanceResponse>(await http.post<Envelope<UserPolicyAcceptanceResponse>>("/api/v1/policies/me/accept", body)),

  cookiePreferences: (anonymousToken: string | null, signal?: AbortSignal) =>
    get<CookieConsentResponse>(`/api/v1/privacy/cookie-preferences${anonymousToken ? `?anonymousToken=${seg(anonymousToken)}` : ""}`, signal),
  saveCookiePreferences: async (body: CookieConsentRequest) =>
    unwrapData<CookieConsentResponse>(await http.put<Envelope<CookieConsentResponse>>("/api/v1/privacy/cookie-preferences", body)),

  communicationPreferences: (signal?: AbortSignal) => get<CommunicationPreferenceResponse>("/api/v1/users/me/communication-preferences", signal),
  saveCommunicationPreferences: async (body: CommunicationPreferenceRequest) =>
    unwrapData<CommunicationPreferenceResponse>(await http.put<Envelope<CommunicationPreferenceResponse>>("/api/v1/users/me/communication-preferences", body)),
};
