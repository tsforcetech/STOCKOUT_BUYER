import type { PolicySummaryResponse } from "@/api/types/policies";

/**
 * Agreement given on the Create account screen. Registration (identity-access) has no consent field and
 * POST /policies/me/accept needs a signed-in user, so the exact revisions shown at sign-up are kept in this browser
 * and recorded right after the first sign-in (policy-gate). Only revisions whose id AND content hash still match are
 * recorded; anything changed since sign-up is asked again in the gate.
 */
const KEY = "stockout.market.signup-consent";
/** Unverified sign-ups that come back later than this are asked again. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface SignupConsentRevision {
  policyCode: string;
  policyRevisionId: string;
  contentHash: string;
}
interface Stored {
  userId: string;
  agreedAtUtc: string;
  revisions: SignupConsentRevision[];
}

function readAll(): Stored[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? (v as Stored[]).filter((s) => typeof s?.userId === "string" && Array.isArray(s.revisions)) : [];
  } catch {
    return [];
  }
}
function writeAll(list: Stored[]): void {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the gate will simply ask after sign-in */
  }
}

export function saveSignupConsent(userId: string, policies: PolicySummaryResponse[]): void {
  if (!userId || !policies.length) return;
  const fresh = readAll().filter((s) => s.userId !== userId && Date.now() - Date.parse(s.agreedAtUtc) < MAX_AGE_MS);
  fresh.push({
    userId,
    agreedAtUtc: new Date().toISOString(),
    revisions: policies.map((p) => ({ policyCode: p.policyCode, policyRevisionId: p.policyRevisionId, contentHash: p.contentHash })),
  });
  writeAll(fresh);
}

/** Revisions this user agreed to at sign-up (empty when none, expired, or another user's). */
export function readSignupConsent(userId: string): SignupConsentRevision[] {
  const s = readAll().find((x) => x.userId.toLowerCase() === userId.toLowerCase());
  if (!s || !(Date.now() - Date.parse(s.agreedAtUtc) < MAX_AGE_MS)) return [];
  return s.revisions;
}

export function clearSignupConsent(userId: string): void {
  writeAll(readAll().filter((x) => x.userId.toLowerCase() !== userId.toLowerCase()));
}
