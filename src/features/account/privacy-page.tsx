import * as React from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircleIcon, FileTextIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton, Switch } from "@/components/ui/misc";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { FormError } from "@/components/forms/form-field";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/utils/format";
import { policiesService } from "@/services/policies.service";
import { useCookieConsent } from "@/features/privacy/cookie-consent";
import { policyKeys, policyPath } from "@/features/legal/queries";
import type { CommunicationPreferenceRequest } from "@/api/types/policies";
import { AccountTabs } from "./account-tabs";

function CardTitle({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-heading text-xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = { PORTAL_MODAL: "Sign-in prompt", REGISTRATION: "Registration", PROFILE: "Account settings", ADMIN_RECORDED: "Recorded by StockOut" };

export default function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="My account" title="Privacy" description="Marketing messages, cookie choices and the policies you've accepted." />
      <AccountTabs />
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard>
            <CardTitle title="Marketing messages" description="Offers and news from StockOut. Order, account and security messages are always sent." />
            <CommunicationPreferences />
          </SectionCard>
          <SectionCard>
            <CookieChoices />
          </SectionCard>
        </div>
        <SectionCard>
          <CardTitle
            title="Accepted policies"
            description="Each policy version you agreed to, with when and how."
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link to="/legal">View all policies</Link>
              </Button>
            }
          />
          <AcceptanceHistory />
        </SectionCard>
      </div>
    </>
  );
}

function CommunicationPreferences() {
  const qc = useQueryClient();
  const prefs = useQuery({ queryKey: policyKeys.communication, queryFn: ({ signal }) => policiesService.communicationPreferences(signal) });
  const [draft, setDraft] = React.useState<CommunicationPreferenceRequest | null>(null);
  React.useEffect(() => {
    if (prefs.data) setDraft({ marketingEmail: prefs.data.marketingEmail, marketingSms: prefs.data.marketingSms });
  }, [prefs.data]);
  const save = useApiMutation({
    toastOnError: false,
    mutationFn: (body: CommunicationPreferenceRequest) => policiesService.saveCommunicationPreferences({ ...body, consentSource: "PROFILE" }),
    successMessage: "Marketing preferences saved.",
    onSuccess: (saved) => qc.setQueryData(policyKeys.communication, saved),
  });

  if (prefs.isLoading || (!draft && !prefs.error))
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  if (prefs.error || !draft) return <ErrorState error={prefs.error} onRetry={() => void prefs.refetch()} title="Couldn't load your preferences" />;
  const dirty = draft.marketingEmail !== prefs.data?.marketingEmail || draft.marketingSms !== prefs.data?.marketingSms;
  const rows: Array<{ key: keyof CommunicationPreferenceRequest & ("marketingEmail" | "marketingSms"); title: string; body: string }> = [
    { key: "marketingEmail", title: "Email", body: "New stock alerts, offers and StockOut news by email." },
    { key: "marketingSms", title: "SMS", body: "Occasional offers by text message." },
  ];
  return (
    <div>
      <FormError message={save.error ? getErrorMessage(save.error) : null} />
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.key} className="flex items-start gap-4 py-3">
            <div className="min-w-0 flex-1">
              <label htmlFor={`comm-${r.key}`} className="text-sm font-medium text-foreground">
                {r.title}
              </label>
              <p className="text-sm text-muted-foreground">{r.body}</p>
            </div>
            <Switch id={`comm-${r.key}`} checked={draft[r.key]} disabled={save.isPending} onCheckedChange={(v) => setDraft((d) => d && { ...d, [r.key]: v === true })} />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{prefs.data?.updatedAtUtc ? `Last updated ${formatDateTime(prefs.data.updatedAtUtc)}` : null}</p>
        <Button variant="primary" size="sm" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate(draft)}>
          Save preferences
        </Button>
      </div>
    </div>
  );
}

function CookieChoices() {
  const { consent, openSettings } = useCookieConsent();
  const on = consent ? (["functional", "analytics", "marketing"] as const).filter((k) => consent[k]) : [];
  return (
    <>
      <CardTitle title="Cookies" description="Strictly necessary cookies are always on. Optional ones are up to you." />
      <p className="text-sm text-body">
        {!consent
          ? "You haven't chosen yet — only strictly necessary cookies are used."
          : on.length
            ? `Allowed: strictly necessary, ${on.join(", ")}.`
            : "Only strictly necessary cookies are allowed."}
      </p>
      {consent && <p className="mt-1 text-xs text-muted-foreground">Saved {formatDateTime(consent.updatedAtUtc)} · {consent.consentRevision}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={openSettings}>
          Change cookie settings
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link to={policyPath("STK-POL-CKE-001")}>Cookie Policy</Link>
        </Button>
      </div>
    </>
  );
}

function AcceptanceHistory() {
  const history = useQuery({ queryKey: policyKeys.acceptances, queryFn: ({ signal }) => policiesService.acceptances(signal) });
  if (history.isLoading)
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  if (history.error) return <ErrorState error={history.error} onRetry={() => void history.refetch()} title="Couldn't load your acceptance history" />;
  const list = [...(history.data ?? [])].sort((a, b) => b.acceptedAtUtc.localeCompare(a.acceptedAtUtc));
  if (!list.length) return <EmptyState icon={<FileTextIcon />} title="No accepted policies yet" description="Policies you accept will be listed here." />;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Accepted policies">
      {list.map((a) => (
        <li key={a.acceptanceId} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 sm:p-4">
          <CheckCircleIcon className="size-5 shrink-0 text-success" weight="fill" aria-hidden />
          <div className="min-w-0 flex-1">
            <Link to={policyPath(a.policyCode)} className="text-sm font-medium text-foreground hover:underline">
              {a.title || a.policyCode}
            </Link>
            <p className="text-xs text-muted-foreground">
              {[a.policyCode, a.revisionCode, SOURCE_LABELS[a.acceptanceSource] ?? a.acceptanceSource].filter(Boolean).join(" · ")}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">Accepted {formatDateTime(a.acceptedAtUtc)}</span>
        </li>
      ))}
    </ul>
  );
}
