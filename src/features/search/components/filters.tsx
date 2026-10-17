import * as React from "react";
import type { SearchFacets, IdNameFacetBucket } from "@/api/types/search";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils/format";
import type { SearchState } from "../lib/search-params";

function FacetGroup({ title, buckets, selected, onToggle }: { title: string; buckets: IdNameFacetBucket[]; selected: string[]; onToggle: (id: string) => void }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!buckets.length) return null;
  const shown = expanded ? buckets : buckets.slice(0, 6);
  return (
    <fieldset className="border-t border-border pt-4">
      <legend className="mb-2 text-sm font-medium text-foreground">{title}</legend>
      <ul className="space-y-1.5">
        {shown.map((b) => (
          <li key={b.id}>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-body">
              <input type="checkbox" checked={selected.includes(b.id)} onChange={() => onToggle(b.id)} className="size-4 accent-[var(--action-border)]" />
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
              <span className="text-xs text-muted-foreground">{formatNumber(b.count)}</span>
            </label>
          </li>
        ))}
      </ul>
      {buckets.length > 6 && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-2 cursor-pointer text-xs text-foreground underline">
          {expanded ? "Show less" : `Show all ${buckets.length}`}
        </button>
      )}
    </fieldset>
  );
}

/** Facet-driven filters. Facet counts come from the search response for the current query. */
export function SearchFilters({ state, facets, onChange }: { state: SearchState; facets: SearchFacets | undefined; onChange: (patch: Partial<SearchState>) => void }) {
  const [minPrice, setMinPrice] = React.useState(state.minPrice);
  const [maxPrice, setMaxPrice] = React.useState(state.maxPrice);
  React.useEffect(() => {
    setMinPrice(state.minPrice);
    setMaxPrice(state.maxPrice);
  }, [state.minPrice, state.maxPrice]);

  const toggle = (key: "brandId" | "conditionId" | "gradeId", id: string) => {
    const current = state[key];
    onChange({ [key]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id], page: 1 });
  };

  const currencies = facets?.currencies.map((c) => c.key) ?? [];
  const currency = state.currency || facets?.priceRange.currency || currencies[0] || "AED";

  return (
    <div className="space-y-4">
      {facets && facets.categories.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">Category</legend>
          <ul className="space-y-1">
            {state.categoryId && (
              <li>
                <button type="button" className="cursor-pointer text-sm text-foreground underline" onClick={() => onChange({ categoryId: "", page: 1 })}>
                  ← All categories
                </button>
              </li>
            )}
            {facets.categories.map((c) => (
              <li key={c.categoryId}>
                <button
                  type="button"
                  onClick={() => onChange({ categoryId: c.categoryId, page: 1 })}
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded px-1 py-0.5 text-left text-sm ${state.categoryId === c.categoryId ? "bg-action-soft font-medium text-foreground" : "text-body hover:bg-surface-muted"}`}
                >
                  <span className="truncate">{c.categoryName}</span>
                  <span className="text-xs text-muted-foreground">{formatNumber(c.count)}</span>
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {facets && facets.statesOrEmirates.length > 0 && (
        <fieldset className="border-t border-border pt-4">
          <legend className="mb-2 text-sm font-medium text-foreground">Location</legend>
          <div className="flex flex-wrap gap-2">
            {facets.statesOrEmirates.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={state.stateOrEmirate === s.key}
                onClick={() => onChange({ stateOrEmirate: state.stateOrEmirate === s.key ? "" : s.key, page: 1 })}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-xs ${state.stateOrEmirate === s.key ? "bg-foreground text-surface" : "bg-surface-muted text-foreground hover:bg-border"}`}
              >
                {s.key} <span className="opacity-60">({formatNumber(s.count)})</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <FacetGroup title="Brand" buckets={facets?.brands ?? []} selected={state.brandId} onToggle={(id) => toggle("brandId", id)} />
      <FacetGroup title="Condition" buckets={facets?.conditions ?? []} selected={state.conditionId} onToggle={(id) => toggle("conditionId", id)} />
      <FacetGroup title="Grade" buckets={facets?.grades ?? []} selected={state.gradeId} onToggle={(id) => toggle("gradeId", id)} />

      <fieldset className="border-t border-border pt-4">
        <legend className="mb-2 text-sm font-medium text-foreground">Price</legend>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            onChange({ minPrice, maxPrice, currency: minPrice || maxPrice ? currency : "", page: 1 });
          }}
        >
          <div className="flex items-center gap-2">
            <Input inputMode="decimal" placeholder="Min" aria-label="Minimum price" value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/[^\d.]/g, ""))} className="h-9" />
            <span className="text-muted-foreground">–</span>
            <Input inputMode="decimal" placeholder="Max" aria-label="Maximum price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d.]/g, ""))} className="h-9" />
          </div>
          <div className="flex items-center gap-2">
            {currencies.length > 1 ? (
              <NativeSelect aria-label="Currency" className="h-9" value={currency} onChange={(e) => onChange({ currency: e.target.value })}>
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            ) : (
              <span className="text-xs text-muted-foreground">Prices in {currency}</span>
            )}
            <Button type="submit" variant="secondary" size="sm" className="ml-auto">
              Apply
            </Button>
          </div>
        </form>
      </fieldset>

      <label className="flex cursor-pointer items-center gap-2 border-t border-border pt-4 text-sm text-foreground">
        <input type="checkbox" checked={state.inStockOnly} onChange={(e) => onChange({ inStockOnly: e.target.checked, page: 1 })} className="size-4 accent-[var(--action-border)]" />
        In stock only {facets ? <span className="text-xs text-muted-foreground">({formatNumber(facets.inStockCount)})</span> : null}
      </label>
    </div>
  );
}
