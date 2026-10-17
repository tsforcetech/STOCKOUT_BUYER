import * as React from "react";
import { CaretDownIcon, CaretRightIcon, CheckCircleIcon, FolderIcon, TagIcon } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/misc";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { SearchInput } from "@/components/tables/table-toolbar";
import type { PublicCategoryTreeResponse } from "@/api/types/catalog-taxonomy";
import { cn } from "@/lib/utils/cn";
import { useCategoryIndex } from "../lib/queries";

/** Searchable category tree (GET /api/v1/catalog/categories). Any category can be chosen; leaves are recommended. */
export function CategoryPicker({ value, onSelect }: { value: string | null; onSelect: (categoryId: string) => void }) {
  const { data, isLoading, error, refetch, index } = useCategoryIndex();
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());

  // Expand the ancestors of the current value once the tree loads.
  React.useEffect(() => {
    if (!value || !data) return;
    const ancestors: string[] = [];
    const walk = (nodes: PublicCategoryTreeResponse[], trail: string[]): boolean =>
      nodes.some((n) => (n.categoryId === value ? (ancestors.push(...trail), true) : walk(n.children ?? [], [...trail, n.categoryId])));
    walk(data, []);
    if (ancestors.length) setExpanded((prev) => new Set([...prev, ...ancestors]));
  }, [value, data]);

  if (isLoading)
    return (
      <div className="space-y-2" role="status" aria-label="Loading categories">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load categories" />;
  if (!data?.length) return <EmptyState title="No categories available" description="The catalogue has no active categories yet." />;

  const q = search.trim().toLowerCase();
  const matches = q ? [...index.values()].filter((c) => c.path.join(" ").toLowerCase().includes(q)) : [];

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderNodes = (nodes: PublicCategoryTreeResponse[], depth: number): React.ReactNode => (
    <ul role={depth === 0 ? "tree" : "group"} aria-label={depth === 0 ? "Categories" : undefined} className="space-y-0.5">
      {nodes.map((n) => {
        const hasChildren = (n.children ?? []).length > 0;
        const isOpen = expanded.has(n.categoryId);
        const selected = value === n.categoryId;
        return (
          <li key={n.categoryId} role="treeitem" aria-expanded={hasChildren ? isOpen : undefined} aria-selected={selected}>
            <div className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
              {hasChildren ? (
                <button type="button" onClick={() => toggle(n.categoryId)} className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-surface-muted" aria-label={`${isOpen ? "Collapse" : "Expand"} ${n.name}`}>
                  {isOpen ? <CaretDownIcon className="size-4" /> : <CaretRightIcon className="size-4" />}
                </button>
              ) : (
                <span className="size-7 shrink-0" aria-hidden />
              )}
              <button
                type="button"
                onClick={() => onSelect(n.categoryId)}
                className={cn(
                  "flex min-h-9 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm transition-colors",
                  selected ? "bg-action font-medium text-action-foreground ring-1 ring-action-border" : "hover:bg-surface-muted",
                )}
              >
                {hasChildren ? <FolderIcon className="size-4 shrink-0" aria-hidden /> : <TagIcon className="size-4 shrink-0" aria-hidden />}
                <span className="min-w-0 flex-1 truncate">{n.name}</span>
                {selected && <CheckCircleIcon weight="fill" className="size-4 shrink-0" aria-hidden />}
              </button>
            </div>
            {hasChildren && isOpen && <div className="mt-0.5">{renderNodes(n.children, depth + 1)}</div>}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-3">
      <SearchInput value={search} onChange={setSearch} placeholder="Search categories…" label="Search categories" />
      <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border p-2">
        {q ? (
          matches.length ? (
            <ul className="space-y-0.5" aria-label="Matching categories">
              {matches.map((c) => (
                <li key={c.categoryId}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.categoryId)}
                    aria-pressed={value === c.categoryId}
                    className={cn("flex min-h-9 w-full cursor-pointer flex-col justify-center rounded-md px-2 py-1 text-left text-sm", value === c.categoryId ? "bg-action ring-1 ring-action-border" : "hover:bg-surface-muted")}
                  >
                    <span className="font-medium text-foreground">{c.name}</span>
                    {c.path.length > 1 && <span className="text-xs text-muted-foreground">{c.path.slice(0, -1).join(" › ")}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No categories match “{search}”.</p>
          )
        ) : (
          renderNodes(data, 0)
        )}
      </div>
      <p className="text-xs text-muted-foreground">Choose the most specific category — it decides which attributes, brands, conditions and units apply.</p>
    </div>
  );
}
