import { http } from "@/lib/api/client";
import { expectArray, unwrapData, type Envelope } from "@/lib/api/envelope";
import type { PublicBrandResponse, PublicCategoryTreeResponse } from "@/api/types/catalog-taxonomy";

/** Public (anonymous) catalog taxonomy. Success: { success, data }. Contract: docs/contracts/catalog-taxonomy.md (P*). */
export const catalogService = {
  categoryTree: async (signal?: AbortSignal) =>
    expectArray<PublicCategoryTreeResponse>(unwrapData(await http.get<Envelope<PublicCategoryTreeResponse[]>>("/api/v1/catalog/categories", { signal, auth: false }))),
  brands: async (signal?: AbortSignal) => unwrapData<PublicBrandResponse[]>(await http.get<Envelope<PublicBrandResponse[]>>("/api/v1/catalog/brands", { signal, auth: false })),
};

export function flattenCategories(nodes: PublicCategoryTreeResponse[], depth = 0, trail: string[] = []): Array<PublicCategoryTreeResponse & { depth: number; path: string[] }> {
  return nodes.flatMap((n) => [{ ...n, depth, path: [...trail, n.name] }, ...flattenCategories(n.children ?? [], depth + 1, [...trail, n.name])]);
}
