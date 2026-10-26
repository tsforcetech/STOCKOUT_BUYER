import { Link } from "react-router";
import { ArrowRightIcon, FileTextIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Skeleton } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils/format";
import { useCookieConsent } from "@/features/privacy/cookie-consent";
import { policyPath, usePolicies } from "./queries";

/** /legal — every published policy (GET /policies), each opening the full text. */
export default function LegalHubPage() {
  const policies = usePolicies();
  const { openSettings } = useCookieConsent();
  const list = [...(policies.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader eyebrow="Legal" title="Policies & terms" description="The rules for using StockOut. Each document shows its current revision and the date it took effect." />
      {policies.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : policies.error ? (
        <ErrorState error={policies.error} onRetry={() => void policies.refetch()} title="Couldn't load the policies" />
      ) : !list.length ? (
        <EmptyState icon={<FileTextIcon />} title="No policies published yet" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Published policies">
          {list.map((p) => (
            <li key={p.policyCode}>
              <Link
                to={policyPath(p.policyCode)}
                className="group flex h-full gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-action-soft text-foreground ring-1 ring-action-border/30" aria-hidden>
                  <FileTextIcon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-heading text-base font-bold text-foreground">{p.name}</span>
                    <ArrowRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                  {p.description && <span className="mt-1 block text-sm text-muted-foreground">{p.description}</span>}
                  <span className="mt-2 block text-xs text-muted-foreground">
                    {p.policyCode} · {p.revisionCode} · Effective {formatDate(p.effectiveFromUtc)}
                    {p.audience === "SELLER" ? " · Sellers" : p.audience === "BUYER" ? " · Buyers" : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-sm text-muted-foreground">
        Manage optional cookies any time in{" "}
        <button type="button" onClick={openSettings} className="cursor-pointer font-medium text-foreground underline underline-offset-4">
          Cookie settings
        </button>
        .
      </p>
    </div>
  );
}
