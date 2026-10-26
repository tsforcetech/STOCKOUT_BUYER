import { Link, useParams } from "react-router";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { ErrorState } from "@/components/feedback/states";
import { Skeleton } from "@/components/ui/misc";
import { isApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/utils/format";
import NotFoundPage from "@/features/errors/not-found-page";
import { PolicyMarkdown, policyOutline } from "./policy-markdown";
import { codeFromSlug, policyPath, usePolicies, usePolicy } from "./queries";

/** /legal/:slug — full text of the currently published revision (GET /policies/{code}). */
export default function PolicyPage() {
  const { slug = "" } = useParams();
  const code = codeFromSlug(slug);
  const policy = usePolicy(code);
  const others = usePolicies();
  const p = policy.data;

  if (policy.error && isApiError(policy.error) && policy.error.status === 404) return <NotFoundPage />;

  const outline = p ? policyOutline(p.content) : [];
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/legal" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> All policies
      </Link>
      {policy.isLoading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-6 h-64 w-full" />
        </div>
      ) : policy.error || !p ? (
        <ErrorState className="mt-6" error={policy.error} onRetry={() => void policy.refetch()} title="Couldn't load this policy" />
      ) : (
        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
          <article className="min-w-0">
            <p className="text-eyebrow mb-1 font-display text-foreground">{p.policyCode}</p>
            <h1 className="font-heading text-[28px] font-bold leading-9 text-foreground sm:text-[36px] sm:leading-[44px]">{p.title}</h1>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <div className="flex gap-1.5">
                <dt>Revision</dt>
                <dd className="font-medium text-foreground">{p.revisionCode}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Effective</dt>
                <dd className="font-medium text-foreground">{formatDate(p.effectiveFromUtc)}</dd>
              </div>
              {p.publishedAtUtc && (
                <div className="flex gap-1.5">
                  <dt>Published</dt>
                  <dd className="font-medium text-foreground">{formatDate(p.publishedAtUtc)}</dd>
                </div>
              )}
            </dl>
            <PolicyMarkdown content={p.content} className="mt-8" />
            <p className="mt-10 break-all border-t border-border pt-4 text-xs text-muted-foreground">Content fingerprint (SHA-256): {p.contentHash}</p>
          </article>
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              {outline.length > 0 && (
                <nav aria-label="On this page">
                  <p className="text-eyebrow mb-2 font-display text-foreground">On this page</p>
                  <ul className="space-y-1.5 text-sm">
                    {outline.map((o) => (
                      <li key={o.id}>
                        <a href={`#${o.id}`} className="text-muted-foreground hover:text-foreground">
                          {o.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
              {!!others.data?.length && (
                <nav aria-label="Other policies">
                  <p className="text-eyebrow mb-2 font-display text-foreground">Other policies</p>
                  <ul className="space-y-1.5 text-sm">
                    {others.data
                      .filter((o) => o.policyCode !== p.policyCode)
                      .map((o) => (
                        <li key={o.policyCode}>
                          <Link to={policyPath(o.policyCode)} className="text-muted-foreground hover:text-foreground">
                            {o.name}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </nav>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
