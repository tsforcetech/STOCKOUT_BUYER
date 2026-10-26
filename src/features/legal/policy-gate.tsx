import * as React from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox, Skeleton } from "@/components/ui/misc";
import { FormError } from "@/components/forms/form-field";
import { ErrorState } from "@/components/feedback/states";
import { Notice } from "@/features/seller/components/notice";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDate } from "@/lib/utils/format";
import { policiesService } from "@/services/policies.service";
import type { PolicySummaryResponse } from "@/api/types/policies";
import { PolicyMarkdown } from "./policy-markdown";
import { policyKeys, policyPath, usePolicy } from "./queries";

/**
 * PA-1A pending-policy gate (F3). After sign-in (and on every restored session) GET /policies/me/pending; while any
 * applicable mandatory policy is unaccepted, a blocking dialog shows its full current text and asks for explicit
 * acceptance — the box is never pre-ticked and nothing is accepted automatically. Seller-only policies are asked only
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
  const { status, actor } = useAuth();
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

  const value = React.useMemo<PolicyGateValue>(() => ({ recheck: () => qc.invalidateQueries({ queryKey: policyKeys.pending }) }), [qc]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {required.length > 0 && <PolicyAcceptanceDialog policies={required} />}
    </Ctx.Provider>
  );
}

function PolicyAcceptanceDialog({ policies }: { policies: PolicySummaryResponse[] }) {
  const { signOut } = useAuth();
  const qc = useQueryClient();
  const current = policies[0];
  const detail = usePolicy(current.policyCode);
  const [agreed, setAgreed] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [total] = React.useState(policies.length);
  const step = Math.max(1, total - policies.length + 1);

  React.useEffect(() => {
    setAgreed(false);
    setError(null);
  }, [current.policyCode]);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: policyKeys.pending }),
      qc.invalidateQueries({ queryKey: policyKeys.detail(current.policyCode) }),
      qc.invalidateQueries({ queryKey: policyKeys.list }),
    ]);
  };

  const accept = useApiMutation({
    toastOnError: false,
    // The revision and hash of the text actually shown are what the user agrees to.
    mutationFn: () => policiesService.accept({ policyRevisionId: detail.data!.policyRevisionId, affirmativeAcceptance: true, contentHash: detail.data!.contentHash }),
    onSuccess: async () => {
      setNotice(null);
      await Promise.all([qc.invalidateQueries({ queryKey: policyKeys.pending }), qc.invalidateQueries({ queryKey: policyKeys.acceptances })]);
    },
  });

  const onAccept = () => {
    setError(null);
    accept.mutate(undefined, {
      onError: async (e) => {
        const code = isApiError(e) ? e.code : undefined;
        if (code === "STALE_REVISION_SUPERSEDED" || code === "CONTENT_HASH_MISMATCH") {
          setAgreed(false);
          setNotice(UPDATED);
          await refresh();
        } else if (code === "REVISION_NOT_YET_EFFECTIVE") setError("This version isn't in effect yet. Please try again later.");
        else if (code === "AFFIRMATIVE_ACCEPTANCE_REQUIRED") setError("Tick the box to confirm you agree before continuing.");
        else setError(getErrorMessage(e));
      },
    });
  };

  const p = detail.data;
  const busy = accept.isPending || (detail.isFetching && !detail.data);
  return (
    <Dialog open>
      <DialogContent
        dismissible={false}
        size="xl"
        title={total > 1 ? `Review and accept (${step} of ${total})` : "Review and accept"}
        description="Before you continue, please read and accept the current version of this policy."
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
              <Checkbox className="mt-0.5" checked={agreed} disabled={!p || busy} onCheckedChange={(v) => setAgreed(v === true)} aria-describedby="policy-gate-title" />
              <span>
                I have read and agree to the <strong>{p?.title ?? current.title}</strong> ({p?.revisionCode ?? current.revisionCode}).
              </span>
            </label>
            <div className="flex shrink-0 gap-2">
              <Button variant="ghost" onClick={() => void signOut()} disabled={accept.isPending}>
                Sign out
              </Button>
              <Button variant="primary" onClick={onAccept} disabled={!agreed || !p} loading={accept.isPending}>
                Accept and continue
              </Button>
            </div>
          </div>
        }
      >
        {notice && <Notice tone="warning" className="mb-4">{notice}</Notice>}
        <FormError message={error} />
        {detail.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : detail.error || !p ? (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} title="Couldn't load the policy text" />
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 id="policy-gate-title" className="font-heading text-xl font-bold text-foreground">
                  {p.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.policyCode} · {p.revisionCode} · Effective {formatDate(p.effectiveFromUtc)}
                </p>
              </div>
              <Link to={policyPath(p.policyCode)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-foreground underline underline-offset-4">
                Open in new tab <ArrowSquareOutIcon className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="mt-4 max-h-[50dvh] overflow-y-auto rounded-lg border border-border bg-surface-muted/40 p-4" tabIndex={0} aria-label={`${p.title} full text`}>
              <PolicyMarkdown content={p.content} />
            </div>
            <p className="mt-2 break-all text-xs text-muted-foreground">Content fingerprint (SHA-256): {p.contentHash}</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
