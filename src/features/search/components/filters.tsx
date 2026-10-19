import * as React from "react";
import { CaretDownIcon, CaretLeftIcon } from "@phosphor-icons/react";
import type { SearchFacets } from "@/api/types/search";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { EMIRATES, attrKey, splitAttr, type SearchState } from "../lib/search-params";
import { useFilterOptions } from "../lib/filter-options";

interface Option {
  id: string;
  name: string;
  count?: number;
}

/** Collapsible checkbox group. Counts are shown when the search returned facets for it. */
function CheckGroup({ title, options, selected, onToggle, defaultOpen = true }: { title: string; options: Option[]; selected: string[]; onToggle: (id: string) => void; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen || selected.length > 0);
  const [expanded, setExpanded] = React.useState(false);
  if (!options.length) return null;
  const shown = expanded ? options : options.slice(0, 6);
  return (
    <fieldset className="border-t border-border pt-3">
      <legend className="sr-only">{title}</legend>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full cursor-pointer items-center justify-between py-1 text-left text-sm font-medium text-foreground">
        <span>
          {title}
          {selected.length > 0 && <span className="ml-1.5 rounded-full bg-ink px-1.5 text-[11px] font-bold leading-4 text-ink-foreground">{selected.length}</span>}
        </span>
        <CaretDownIcon className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <>
          <ul className="mt-1.5 space-y-1.5">
            {shown.map((o) => (
              <li key={o.id}>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-body">
                  <input type="checkbox" checked={selected.includes(o.id)} onChange={() => onToggle(o.id)} className="size-4 accent-[var(--action-border)]" />
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                  {o.count !== undefined && <span className="text-xs text-muted-foreground">{formatNumber(o.count)}</span>}
                </label>
              </li>
            ))}
          </ul>
          {options.length > 6 && (
            <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-2 cursor-pointer text-xs text-foreground underline">
              {expanded ? "Show less" : `Show all ${options.length}`}
            </button>
          )}
        </>
      )}
    </fieldset>
  );
}

/** Facet buckets win (they carry counts); otherwise fall back to the catalog's options for the category. */
function merge(facet: { id: string; name: string; count: number }[] | undefined, catalog: Option[]): Option[] {
  if (facet && facet.length) return facet;
  return catalog;
}

/**
 * Filters: category drill-down, location, brand, condition, grade, category attributes, price and stock.
 * Options come from the catalog (so they show even when the search has no results); counts come from search facets.
 */
export function SearchFilters({ state, facets, onChange }: { state: SearchState; facets: SearchFacets | undefined; onChange: (patch: Partial<SearchState>) => void }) {
  const [minPrice, setMinPrice] = React.useState(state.minPrice);
  const [maxPrice, setMaxPrice] = React.useState(state.maxPrice);
  React.useEffect(() => {
    setMinPrice(state.minPrice);
    setMaxPrice(state.maxPrice);
  }, [state.minPrice, state.maxPrice]);
  const { tree, path, requirements } = useFilterOptions(state.categoryId);

  const toggle = (key: "brandId" | "conditionId" | "gradeId" | "attr", id: string) => {
    const current = state[key];
    onChange({ [key]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id], page: 1 });
  };

  const currencies = facets?.currencies.map((c) => c.key) ?? [];
  const currency = state.currency || facets?.priceRange.currency || currencies[0] || "AED";

  // Category drill-down: children of the selected category (or the roots), with facet counts where known.
  const selected = path[path.length - 1];
  const parent = path[path.length - 2];
  const facetCount = new Map(facets?.categories.map((c) => [c.categoryId, c.count]) ?? []);
  const childNodes = selected ? (selected.children ?? []) : tree;

  // Location
  const emirateCounts = new Map(facets?.statesOrEmirates.map((s) => [s.key, s.count]) ?? []);
  const emirates = [...new Set([...EMIRATES, ...emirateCounts.keys()])];
  const cities = facets?.cities ?? [];

  // Attributes: the category's select-type attributes; facet values add counts (codes compare case-insensitively).
  const attrFacets = new Map((facets?.attributes ?? []).map((g) => [g.code.toLowerCase(), new Map(g.values.map((v) => [v.key, v.count]))]));
  const selectedAttr = state.attr.map((a) => attrKey(...splitAttr(a)));
  const attributeGroups = (requirements?.attributes ?? [])
    .filter((a) => a.dataType === "SINGLE_SELECT" || a.dataType === "MULTI_SELECT")
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((a) => {
      const counts = attrFacets.get(a.code.toLowerCase());
      return {
        code: a.code,
        name: a.name,
        options: a.options
          .filter((o) => o.isActive)
          .sort((x, y) => x.displayOrder - y.displayOrder)
          .map((o) => ({ id: attrKey(a.code, o.value), name: o.value, count: counts?.get(o.value) }))
          // With facets, hide values nobody listed; without facets keep every option.
          .filter((o) => !counts || o.count !== undefined || selectedAttr.includes(o.id)),
      };
    })
    .filter((g) => g.options.length > 0);
  // No category chosen: show facet attribute groups that came back from search, labelled by code.
  const facetOnlyGroups = !state.categoryId
    ? (facets?.attributes ?? []).map((g) => ({ code: g.code, name: g.code.replace(/[_-]+/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), options: g.values.map((v) => ({ id: attrKey(g.code, v.key), name: v.key, count: v.count })) }))
    : [];
  const toggleAttr = (id: string) => {
    const existing = state.attr.find((a) => attrKey(...splitAttr(a)) === id);
    onChange({ attr: existing ? state.attr.filter((a) => a !== existing) : [...state.attr, id], page: 1 });
  };

  const brands = merge(
    facets?.brands,
    (requirements?.brands ?? []).map((b) => ({ id: b.brandId, name: b.name })),
  );
  const conditions = merge(
    facets?.conditions,
    (requirements?.conditionRules.conditions ?? []).map((c) => ({ id: c.conditionId, name: c.name })),
  );

  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">Category</legend>
        {selected && (
          <div className="mb-2 space-y-1">
            <button type="button" className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => onChange({ categoryId: parent?.categoryId ?? "", attr: [], brandId: [], page: 1 })}>
              <CaretLeftIcon className="size-3" /> {parent ? parent.name : "All categories"}
            </button>
            <p className="rounded-md bg-ink px-2 py-1 text-sm font-medium text-ink-foreground">{selected.name}</p>
          </div>
        )}
        {childNodes.length > 0 && (
          <ul className={cn("space-y-0.5", selected && "ml-2 border-l border-border pl-2")}>
            {childNodes.map((c) => (
              <li key={c.categoryId}>
                <button
                  type="button"
                  onClick={() => onChange({ categoryId: c.categoryId, attr: [], brandId: [], page: 1 })}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 rounded px-1 py-1 text-left text-sm text-body hover:bg-surface-muted"
                >
                  <span className="truncate">{c.name}</span>
                  {facetCount.has(c.categoryId) && <span className="text-xs text-muted-foreground">{formatNumber(facetCount.get(c.categoryId)!)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <fieldset className="border-t border-border pt-3">
        <legend className="mb-2 text-sm font-medium text-foreground">Location</legend>
        <div className="flex flex-wrap gap-1.5">
          {emirates.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={state.stateOrEmirate === e}
              onClick={() => onChange({ stateOrEmirate: state.stateOrEmirate === e ? "" : e, city: "", page: 1 })}
              className={cn("cursor-pointer rounded-full px-3 py-1.5 text-xs", state.stateOrEmirate === e ? "bg-ink text-ink-foreground" : "bg-surface-muted text-foreground hover:bg-border")}
            >
              {e}
              {emirateCounts.has(e) && <span className="opacity-60"> ({formatNumber(emirateCounts.get(e)!)})</span>}
            </button>
          ))}
        </div>
        {(cities.length > 0 || state.city) && (
          <NativeSelect aria-label="City / area" className="mt-2 h-9 w-full text-sm" value={state.city} onChange={(e) => onChange({ city: e.target.value, page: 1 })}>
            <option value="">All areas</option>
            {state.city && !cities.some((c) => c.key === state.city) && <option value={state.city}>{state.city}</option>}
            {cities.map((c) => (
              <option key={c.key} value={c.key}>
                {c.key} ({formatNumber(c.count)})
              </option>
            ))}
          </NativeSelect>
        )}
      </fieldset>

      <CheckGroup title="Brand" options={brands} selected={state.brandId} onToggle={(id) => toggle("brandId", id)} />
      <CheckGroup title="Condition" options={conditions} selected={state.conditionId} onToggle={(id) => toggle("conditionId", id)} />
      <CheckGroup title="Grade" options={facets?.grades ?? []} selected={state.gradeId} onToggle={(id) => toggle("gradeId", id)} />

      {[...attributeGroups, ...facetOnlyGroups].map((g, i) => (
        <CheckGroup key={g.code} title={g.name} options={g.options} selected={g.options.filter((o) => selectedAttr.includes(o.id)).map((o) => o.id)} onToggle={toggleAttr} defaultOpen={i < 3} />
      ))}

      <fieldset className="border-t border-border pt-3">
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

      <label className="flex cursor-pointer items-center gap-2 border-t border-border pt-3 text-sm text-foreground">
        <input type="checkbox" checked={state.inStockOnly} onChange={(e) => onChange({ inStockOnly: e.target.checked, page: 1 })} className="size-4 accent-[var(--action-border)]" />
        In stock only {facets ? <span className="text-xs text-muted-foreground">({formatNumber(facets.inStockCount)})</span> : null}
      </label>
    </div>
  );
}
