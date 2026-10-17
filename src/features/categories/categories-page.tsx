import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { catalogService } from "@/services/catalog.service";
import { ErrorState, EmptyState } from "@/components/feedback/states";
import { Skeleton } from "@/components/ui/misc";
import { searchHref } from "@/features/search/lib/search-params";
import type { PublicCategoryTreeResponse } from "@/api/types/catalog-taxonomy";

function Children({ nodes }: { nodes: PublicCategoryTreeResponse[] }) {
  if (!nodes.length) return null;
  return (
    <ul className="mt-2 space-y-1 border-l border-border pl-3">
      {nodes.map((c) => (
        <li key={c.categoryId}>
          <Link to={searchHref({ categoryId: c.categoryId })} className="text-sm text-body hover:text-foreground hover:underline">
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
      <h1 className="font-heading text-[32px] font-bold leading-10 text-foreground">Browse all categories</h1>
      <p className="mt-2 text-sm text-muted-foreground">Every category of surplus material currently listed on StockOut.</p>
      <div className="mt-8">
        {q.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !q.data?.length ? (
          <EmptyState title="No categories yet" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {q.data.map((root) => (
              <section key={root.categoryId} className="rounded-xl bg-cream p-5">
                <Link to={searchHref({ categoryId: root.categoryId })} className="font-heading text-xl font-bold text-foreground hover:underline">
                  {root.name}
                </Link>
                <Children nodes={root.children ?? []} />
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
