import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { catalogService } from "@/services/catalog.service";
import { ErrorState, EmptyState } from "@/components/feedback/states";
import { Skeleton } from "@/components/ui/misc";
import { searchHref } from "@/features/search/lib/search-params";
import type { PublicCategoryTreeResponse } from "@/api/types/catalog-taxonomy";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { categoryIcon } from "./category-icon";

function Children({ nodes }: { nodes: PublicCategoryTreeResponse[] }) {
  if (!nodes.length) return null;
  return (
    <ul className="mt-3 space-y-0.5">
      {nodes.map((c) => (
        <li key={c.categoryId}>
          <Link to={searchHref({ categoryId: c.categoryId })} className="-mx-2 block rounded-md px-2 py-1 text-sm text-body transition-colors hover:bg-surface-muted hover:text-foreground">
            {c.name}
          </Link>
          <Children nodes={c.children ?? []} />
        </li>
      ))}
    </ul>
  );
}

export default function CategoriesPage() {
  const q = useQuery({ queryKey: ["catalog", "tree"], queryFn: ({ signal }) => catalogService.categoryTree(signal), staleTime: 10 * 60_000 });
  return (
    <div className="mx-auto max-w-[1336px] px-4 py-10 sm:px-6">
      <h1 className="font-heading text-[28px] font-bold leading-9 text-foreground sm:text-[34px] sm:leading-[42px]">Browse all categories</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {q.data?.length ? `${q.data.length} categories of surplus construction and industrial material.` : "Every category of surplus material on StockOut."}
      </p>
      <div className="mt-8">
        {q.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !q.data?.length ? (
          <EmptyState title="No categories yet" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {q.data.map((root) => {
              const RootIcon = categoryIcon(root.name);
              return (
                <section key={root.categoryId} className="flex flex-col rounded-2xl border border-border bg-surface p-5 transition-shadow hover:shadow-raised">
                  <Link to={searchHref({ categoryId: root.categoryId })} className="group flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cream-strong text-foreground transition-colors group-hover:bg-action group-hover:text-action-foreground">
                      <RootIcon className="size-6" />
                    </span>
                    <span className="font-heading text-lg font-bold leading-6 text-foreground group-hover:underline">{root.name}</span>
                  </Link>
                  <Children nodes={root.children ?? []} />
                  <Link to={searchHref({ categoryId: root.categoryId })} className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-foreground underline-offset-4 hover:underline">
                    View all <ArrowRightIcon className="size-3.5" />
                  </Link>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
