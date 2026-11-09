import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import { ORDER_PAGE_SIZE } from "@/services/orders.service";

/**
 * Page-by-page order lists. The API returns a bare array with no totals, so "Load more" asks for the next page until
 * one comes back short. Rows are de-duplicated by id when pages are joined; no total count is shown or invented.
 */
export function useOrderPages<T>(key: QueryKey, fetchPage: (page: number, signal: AbortSignal) => Promise<T[]>, idOf: (row: T) => string, enabled = true) {
  const q = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.length < ORDER_PAGE_SIZE ? undefined : all.length + 1),
    enabled,
  });
  const seen = new Set<string>();
  const rows: T[] = [];
  for (const page of q.data?.pages ?? [])
    for (const r of page) {
      if (seen.has(idOf(r))) continue;
      seen.add(idOf(r));
      rows.push(r);
    }
  return { ...q, rows };
}
