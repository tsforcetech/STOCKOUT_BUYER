import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";

/** Up to `size` page numbers centred on the current page, e.g. 4 of 16 → 2 3 4 5 6. */
export function pageWindow(page: number, total: number, size = 5): number[] {
  const n = Math.min(size, total);
  let start = Math.max(1, page - Math.floor(n / 2));
  start = Math.min(start, total - n + 1);
  return Array.from({ length: n }, (_, i) => start + i);
}

const box =
  "flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface px-2 text-base font-medium text-foreground transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40";

/** Numbered pagination: ◀ 1 2 3 4 5 ▶ (current page filled). */
export function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  const pages = pageWindow(page, totalPages);
  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-col items-center gap-2">
      <div className="flex w-full max-w-md items-center justify-between gap-1.5 sm:w-auto sm:max-w-none sm:justify-center sm:gap-2">
        <button type="button" className={box} aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <CaretLeftIcon weight="fill" className="size-5" />
        </button>
        <ul className="flex items-center gap-1.5 sm:gap-2">
          {pages.map((n) => (
            <li key={n}>
              <button
                type="button"
                aria-label={`Page ${n}`}
                aria-current={n === page ? "page" : undefined}
                onClick={() => n !== page && onChange(n)}
                className={cn(box, n === page && "border-ink bg-ink text-ink-foreground hover:border-ink")}
              >
                {n}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={box} aria-label="Next page" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          <CaretRightIcon weight="fill" className="size-5" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </p>
    </nav>
  );
}
