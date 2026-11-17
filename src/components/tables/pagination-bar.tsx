import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";

/** Page numbers with ellipses: 1 … 4 5 6 … 20 */
export function pageWindow(page: number, count: number): Array<number | "…"> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set([1, count, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const result: Array<number | "…"> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push("…");
    result.push(p);
  });
  return result;
}

/**
 * "Showing 1–20 of 80 · Rows per page [20] · ‹ 1 2 3 4 Next ›". Shared by DataTable and card grids so every list
 * pages the same way. Page-size and page controls only appear when there's more than the smallest page.
 */
export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  sizeLabel = "Rows per page",
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  sizeLabel?: string;
  className?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const options = pageSizeOptions.includes(pageSize) ? pageSizeOptions : [...pageSizeOptions, pageSize].sort((a, b) => a - b);
  return (
    <div className={cn("flex flex-col gap-3 text-sm text-foreground @xl:flex-row @xl:items-center @xl:justify-between", className)}>
      <div className="whitespace-nowrap text-muted-foreground">
        Showing {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </div>
      {total > Math.min(...options) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 whitespace-nowrap">
            <span>{sizeLabel}</span>
            <NativeSelect className="h-8 w-[76px] px-2.5 text-sm" value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} aria-label={sizeLabel}>
              {options.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </label>
          <nav className="flex items-center gap-1" aria-label="Pagination">
            <Button variant="ghost" size="icon-sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
              <CaretLeftIcon />
            </Button>
            {pageWindow(page, pageCount).map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden>
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-current={p === page ? "page" : undefined}
                  aria-label={`Page ${p}`}
                  className={cn(
                    "flex size-8 cursor-pointer items-center justify-center rounded-sm text-sm transition-colors",
                    p === page ? "bg-action font-semibold text-action-foreground" : "text-foreground hover:bg-surface-muted",
                  )}
                >
                  {p}
                </button>
              ),
            )}
            <Button variant="ghost" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
              Next <CaretRightIcon />
            </Button>
          </nav>
        </div>
      )}
    </div>
  );
}
