import * as React from "react";
import { ListBulletsIcon, SquaresFourIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";

export type SearchView = "grid" | "list";
export const SEARCH_VIEW_KEY = "stockout.market.searchView";

function readView(): SearchView {
  try {
    return localStorage.getItem(SEARCH_VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

/** Grid/list preference, remembered per browser. */
export function useSearchView(): [SearchView, (view: SearchView) => void] {
  const [view, setView] = React.useState<SearchView>(readView);
  const update = React.useCallback((next: SearchView) => {
    setView(next);
    try {
      localStorage.setItem(SEARCH_VIEW_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);
  return [view, update];
}

export function ViewToggle({ view, onChange, className }: { view: SearchView; onChange: (view: SearchView) => void; className?: string }) {
  const item = (value: SearchView, label: string, Icon: typeof SquaresFourIcon) => (
    <button
      type="button"
      aria-pressed={view === value}
      aria-label={label}
      title={label}
      onClick={() => onChange(value)}
      className={cn(
        "flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors",
        view === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-cream-strong hover:text-foreground",
      )}
    >
      <Icon className="size-[18px]" weight={view === value ? "fill" : "regular"} />
    </button>
  );
  return (
    <div role="group" aria-label="Results view" className={cn("inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5", className)}>
      {item("grid", "Grid view", SquaresFourIcon)}
      {item("list", "List view", ListBulletsIcon)}
    </div>
  );
}
