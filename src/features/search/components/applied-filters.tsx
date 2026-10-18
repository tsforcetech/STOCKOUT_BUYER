import { XIcon } from "@phosphor-icons/react";
import type { SearchFacets } from "@/api/types/search";
import { formatMoney, formatNumber } from "@/lib/utils/format";
import { priceOrUndefined, type SearchState } from "../lib/search-params";

export interface AppliedFilterChip {
  key: string;
  label: string;
  /** Patch that removes just this filter (always resets to page 1). */
  remove: Partial<SearchState>;
}

function price(value: number, currency: string) {
  return currency ? formatMoney(value, currency) : formatNumber(value);
}

/**
 * One chip per active filter. Names come from the facets of the current search response
 * (facets are disjunctive, so a selected brand/condition/grade is still listed); until they load the
 * chip falls back to a generic label rather than showing a raw id.
 */
export function appliedFilterChips(state: SearchState, facets: SearchFacets | undefined): AppliedFilterChip[] {
  const chips: AppliedFilterChip[] = [];
  if (state.q.trim()) chips.push({ key: "q", label: `“${state.q.trim()}”`, remove: { q: "", page: 1 } });
  if (state.categoryId) {
    const name = facets?.categories.find((c) => c.categoryId === state.categoryId)?.categoryName;
    chips.push({ key: "category", label: name ?? "Category", remove: { categoryId: "", page: 1 } });
  }
  const multi = [
    { key: "brandId", title: "Brand", buckets: facets?.brands },
    { key: "conditionId", title: "Condition", buckets: facets?.conditions },
    { key: "gradeId", title: "Grade", buckets: facets?.grades },
  ] as const;
  for (const group of multi) {
    const selected = state[group.key];
    for (const id of selected) {
      const name = group.buckets?.find((b) => b.id === id)?.name;
      const label = group.key === "gradeId" ? `Grade ${name ?? ""}`.trim() : (name ?? group.title);
      chips.push({ key: `${group.key}:${id}`, label, remove: { [group.key]: selected.filter((x) => x !== id), page: 1 } });
    }
  }
  if (state.stateOrEmirate) chips.push({ key: "emirate", label: state.stateOrEmirate, remove: { stateOrEmirate: "", page: 1 } });
  const min = priceOrUndefined(state.minPrice);
  const max = priceOrUndefined(state.maxPrice);
  if (min !== undefined || max !== undefined) {
    const cur = state.currency || facets?.priceRange.currency || "AED";
    const label = min !== undefined && max !== undefined ? `${price(min, cur)} – ${price(max, cur)}` : min !== undefined ? `From ${price(min, cur)}` : `Up to ${price(max as number, cur)}`;
    chips.push({ key: "price", label, remove: { minPrice: "", maxPrice: "", currency: "", page: 1 } });
  }
  if (state.inStockOnly) chips.push({ key: "inStock", label: "In stock only", remove: { inStockOnly: false, page: 1 } });
  return chips;
}

export function AppliedFilters({ chips, onRemove, onClearAll }: { chips: AppliedFilterChip[]; onRemove: (chip: AppliedFilterChip) => void; onClearAll: () => void }) {
  if (!chips.length) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Applied filters" role="group">
      {chips.map((chip) => (
        <span key={chip.key} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border-strong bg-cream py-1 pl-3 pr-1 text-xs font-medium text-foreground sm:text-sm">
          <span className="truncate">{chip.label}</span>
          <button
            type="button"
            onClick={() => onRemove(chip)}
            aria-label={`Remove filter: ${chip.label}`}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-cream-strong hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClearAll} className="cursor-pointer px-1 text-xs font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground sm:text-sm">
        Clear all
      </button>
    </div>
  );
}
