import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { catalogService } from "@/services/catalog.service";
import NotFoundPage from "@/features/errors/not-found-page";
import { PageSkeleton } from "@/components/feedback/states";
import { ALL_STOCK_SLUG, categoryPath, parseLandingSlug, slugify } from "@/lib/seo/site";
import type { PublicCategoryTreeResponse } from "@/api/types/catalog-taxonomy";
import SearchPage from "./search-page";
import { landingCopy } from "@/lib/seo/landing-copy";

function flatten(nodes: PublicCategoryTreeResponse[]): PublicCategoryTreeResponse[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children ?? [])]);
}

export default function CategoryLandingPage() {
  const { landingSlug = "" } = useParams();
  const { categorySlug, emirate } = parseLandingSlug(landingSlug);
  const tree = useQuery({ queryKey: ["catalog", "tree"], queryFn: ({ signal }) => catalogService.categoryTree(signal), staleTime: 10 * 60_000 });
  if (categorySlug === ALL_STOCK_SLUG) {
    return <SearchPage key={landingSlug} landing={{ ...landingCopy(null, emirate?.name ?? null), path: categoryPath(null, emirate?.name) }} />;
  }
  if (tree.isLoading) return <PageSkeleton />;
  const cat = flatten(tree.data ?? []).find((c) => slugify(c.name) === categorySlug);
  if (!cat) return <NotFoundPage />;
  return (
    <SearchPage
      key={landingSlug}
      landing={{ ...landingCopy(cat.name, emirate?.name ?? null), categoryId: cat.categoryId, path: categoryPath(cat.name, emirate?.name) }}
    />
  );
}
