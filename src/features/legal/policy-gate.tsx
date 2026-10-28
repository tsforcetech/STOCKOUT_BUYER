import * as React from "react";
import { Link } from "react-router";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowSquareOutIcon, CaretDownIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox, Skeleton } from "@/components/ui/misc";
import { FormError } from "@/components/forms/form-field";
import { ErrorState } from "@/components/feedback/states";
import { Notice } from "@/features/seller/components/notice";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDate } from "@/lib/utils/format";
import { policiesService } from "@/services/policies.service";
import type { PolicySummaryResponse } from "@/api/types/policies";
import { PolicyMarkdown } from "./policy-markdown";
import { clearSignupConsent, readSignupConsent } from "./signup-consent";
import { policyKeys, policyPath } from "./queries";

/**
 * PA-1A pending-policy gate (F3). After sign-in (and on every restored session) GET /policies/me/pending; while any
 * applicable mandatory policy is unaccepted, a blocking dialog lists every one with its full current text and asks for
 * one explicit agreement covering all of them — the box is never pre-ticked and nothing is accepted automatically. Seller-only policies are asked only
 * of users who have a seller account. If the pending check itself fails the site isn't blocked; the server still
 * enforces acceptance where it matters (e.g. seller KYC submission → POLICY_ACCEPTANCE_REQUIRED).
 */
interface PolicyGateValue {
  /** Re-reads pending policies, e.g. after the server answers POLICY_ACCEPTANCE_REQUIRED. */
  recheck: () => Promise<void>;
}
const Ctx = React.createContext<PolicyGateValue>({ recheck: async () => {} });
export const usePolicyGate = () => React.useContext(Ctx);

const UPDATED = "These terms have recently been updated. Please review and accept the latest version to continue.";

export function appliesTo(p: PolicySummaryResponse, isSeller: boolean): boolean {
  const audience = (p.audience || "ALL").toUpperCase();
  return p.isMandatory && (audience !== "SELLER" || isSeller);
}

export function PolicyGateProvider({ children }: { children: React.ReactNode }) {
  const { status, actor, user } = useAuth();
  const qc = useQueryClient();
  const signedIn = status === "authenticated";
  const pending = useQuery({
    queryKey: policyKeys.pending,
    queryFn: ({ signal }) => policiesService.pending(signal),
    enabled: signedIn,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const isSeller = (actor?.sellerContexts.length ?? 0) > 0;
  const required = signedIn ? (pending.data ?? []).filter((p) => appliesTo(p, isSeller)) : [];
  const recording = useSignupConsentRecorder(user?.userId, required);

  const value = React.useMemo<PolicyGateValue>(() => ({ recheck: () => qc.invalidateQueries({ queryKey: policyKeys.pending }) }), [qc]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {required.length > 0 && !recording && <PolicyAcceptanceDialog policies={required} />}
    </Ctx.Provider>
  );
}

/**
 * First sign-in after creating an account: records the agreement given on the sign-up form for the pending policies
 * whose revision id and content hash are exactly what was shown then. Anything else stays pending for the dialog.
 * Returns true while recording, so the dialog doesn't flash up for policies that are about to be accepted.
 */
function useSignupConsentRecorder(userId: string | undefined, required: PolicySummaryResponse[]): boolean {
  const qc = useQueryClient();
  const [recording, setRecording] = React.useState(false);
  const done = React.useRef<string | null>(null);
  const matches = React.useMemo(() => {
    if (!userId || !required.length) return [];
    const agreed = readSignupConsent(userId);
    return required.filter((p) => agreed.some((a) => a.policyRevisionId === p.policyRevisionId && a.contentHash === p.contentHash));
  }, [userId, required]);

  React.useEffect(() => {
    if (!userId || !matches.length || done.current === userId) return;
    done.current = userId;
    setRecording(true);
    void (async () => {
      for (const p of matches) {
        try {
          // The server labels client-sent acceptances PORTAL_MODAL whatever source is claimed; the agreement itself was given at sign-up.
          await policiesService.accept({ policyRevisionId: p.policyRevisionId, affirmativeAcceptance: true, contentHash: p.contentHash, acceptanceSource: "REGISTRATION" });
        } catch {
          /* left pending: the dialog asks for it */
        }
      }
      clearSignupConsent(userId);
      await Promise.all([qc.invalidateQueries({ queryKey: policyKeys.pending }), qc.invalidateQueries({ queryKey: policyKeys.acceptances })]);
      setRecording(false);
    })();
  }, [userId, matches, qc]);

  return recording;
}

function PolicyAcceptanceDialog({ policies }: { policies: PolicySummaryResponse[] }) {
  const { signOut } = useAuth();
  const qc = useQueryClient();
  // Every pending policy's full text is loaded; the revision and hash of the text shown are what the user agrees to.
  const details = useQueries({
    queries: policies.map((p) => ({
      queryKey: policyKeys.detail(p.policyCode),
      queryFn: ({ signal }: { signal: AbortSignal }) => policiesService.detail(p.policyCode, signal),
      staleTime: 10 * 60_000,
    })),
  });
  const [agreed, setAgreed] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const codes = policies.map((p) => p.policyCode).join("|");

  // A different set of policies (e.g. one was updated) needs a fresh agreement.
  React.useEffect(() => {
    setAgreed(false);
  }, [codes]);

  const loaded = details.every((d) => d.data);
  const failed = details.find((d) => d.error && !d.data);
  const loading = details.some((d) => d.isLoading);

  const refreshAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: policyKeys.pending }),
      qc.invalidateQueries({ queryKey: ["policies", "detail"] }),
      qc.invalidateQueries({ queryKey: policyKeys.list }),
    ]);
  };

  const onAccept = async () => {
    if (!loaded) return;
    setError(null);
    setSaving(true);
    try {
      // The API records one acceptance per revision, so the single agreement is sent for each policy in turn.
      for (const d of details) {
        const p = d.data!;
        try {
          await policiesService.accept({ policyRevisionId: p.policyRevisionId, affirmativeAcceptance: true, contentHash: p.contentHash });
        } catch (e) {
          const code = isApiError(e) ? e.code : undefined;
          if (code === "STALE_REVISION_SUPERSEDED" || code === "CONTENT_HASH_MISMATCH") {
            setAgreed(false);
            setNotice(UPDATED);
          } else if (code === "REVISION_NOT_YET_EFFECTIVE") setError(`${p.title}: this version isn't in effect yet. Please try again later.`);
          else if (code === "AFFIRMATIVE_ACCEPTANCE_REQUIRED") setError("Tick the box to confirm you agree before continuing.");
          else setError(`${p.title}: ${getErrorMessage(e)}`);
          // Policies accepted before the failure stay accepted; the list reloads with what's still pending.
          await refreshAll();
          return;
        }
      }
      setNotice(null);
      await Promise.all([qc.invalidateQueries({ queryKey: policyKeys.pending }), qc.invalidateQueries({ queryKey: policyKeys.acceptances })]);
    } finally {
      setSaving(false);
    }
  };

  const many = policies.length > 1;
  return (
    <Dialog open>
      <DialogContent
        dismissible={false}
        size="xl"
        title="Review and accept"
        description={many ? `Before you continue, please read and accept the current version of these ${policies.length} policies.` : "Before you continue, please read and accept the current version of this policy."}
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
              <Checkbox className="mt-0.5" checked={agreed} disabled={!loaded || saving} onCheckedChange={(v) => setAgreed(v === true)} />
              <span>
                {many ? (
                  <>
                    I have read and agree to all {policies.length} policies listed above.
                  </>
                ) : (
                  <>
                    I have read and agree to the <strong>{details[0]?.data?.title ?? policies[0].title}</strong> ({details[0]?.data?.revisionCode ?? policies[0].revisionCode}).
                  </>
                )}
              </span>
            </label>
            <div className="flex shrink-0 gap-2">
              <Button variant="ghost" onClick={() => void signOut()} disabled={saving}>
                Sign out
              </Button>
              <Button variant="primary" onClick={() => void onAccept()} disabled={!agreed || !loaded} loading={saving}>
                {many ? "Accept all and continue" : "Accept and continue"}
              </Button>
            </div>
          </div>
        }
      >
        {notice && <Notice tone="warning" className="mb-4">{notice}</Notice>}
        <FormError message={error} />
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : failed ? (
          <ErrorState error={failed.error} onRetry={() => details.forEach((d) => d.error && void d.refetch())} title="Couldn't load the policy text" />
        ) : (
          <ul className="space-y-3" aria-label="Policies to accept">
            {details.map((d) => {
              const p = d.data!;
              return (
                <li key={p.policyCode} className="rounded-lg border border-border">
                  <details open={!many} className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <h3 className="font-heading text-lg font-bold text-foreground">{p.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {p.policyCode} · {p.revisionCode} · Effective {formatDate(p.effectiveFromUtc)}
                        </p>
                      </div>
                      <span className="flex items-center gap-3 text-sm">
                        <Link to={policyPath(p.policyCode)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-foreground underline underline-offset-4" onClick={(e) => e.stopPropagation()}>
                          Open in new tab <ArrowSquareOutIcon className="size-4" aria-hidden />
                        </Link>
                        <CaretDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                      </span>
                    </summary>
                    <div className="px-4 pb-4">
                      <div className="max-h-[40dvh] overflow-y-auto rounded-lg border border-border bg-surface-muted/40 p-4" tabIndex={0} aria-label={`${p.title} full text`}>
                        <PolicyMarkdown content={p.content} />
                      </div>
                      <p className="mt-2 break-all text-xs text-muted-foreground">Content fingerprint (SHA-256): {p.contentHash}</p>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
