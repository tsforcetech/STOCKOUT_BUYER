import * as React from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchService } from "@/services/search.service";
import { cn } from "@/lib/utils/cn";
import { searchHref } from "../lib/search-params";

/**
 * Header / hero search with type-ahead suggestions (GET /api/v1/search/suggest).
 * Submitting navigates to /search?q=…, preserving the selected emirate.
 */
export function SearchBox({
  variant = "header",
  emirate,
  categoryId,
  autoFocus,
  addons,
}: {
  variant?: "header" | "hero";
  emirate?: string;
  categoryId?: string;
  autoFocus?: boolean;
  /** Extra controls rendered between the input and the submit button (hero: category + location). */
  addons?: React.ReactNode;
}) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [text, setText] = React.useState(params.get("q") ?? "");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const debounced = useDebouncedValue(text.trim(), 250);
  const listId = React.useId();

  React.useEffect(() => setText(params.get("q") ?? ""), [params]);

  const suggest = useQuery({
    queryKey: ["search", "suggest", debounced],
    queryFn: ({ signal }) => searchService.suggest({ prefix: debounced, limit: 8 }, signal),
    enabled: open && debounced.length >= 2,
    staleTime: 60_000,
    retry: false,
  });
  const items = suggest.data?.suggestions ?? [];

  const go = (q: string, extra?: { categoryId?: string; brandId?: string[] }) => {
    setOpen(false);
    navigate(searchHref({ q, stateOrEmirate: emirate ?? params.get("stateOrEmirate") ?? "", categoryId: categoryId || undefined, ...extra }));
  };

  const pick = (i: number) => {
    const s = items[i];
    if (!s) return;
    if (s.type === "listing" && s.listingId) {
      setOpen(false);
      navigate(`/listings/${s.listingId}`);
    } else if (s.type === "category" && s.categoryId) go("", { categoryId: s.categoryId });
    else if (s.type === "brand" && s.brandId) go("", { brandId: [s.brandId] });
    else go(s.text);
  };

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        if (active >= 0) pick(active);
        else go(text);
      }}
    >
      <div
        className={cn(
          "flex bg-surface",
          variant === "hero" ? "flex-col gap-0 overflow-hidden rounded-xl lg:h-[76px] lg:flex-row lg:items-stretch" : "h-9 items-center gap-2 rounded-full border border-secondary-border pl-3 pr-2",
        )}
      >
        <div className={cn("flex min-w-0 items-center gap-3", variant === "hero" ? "h-16 flex-1 px-5 lg:h-auto" : "contents")}>
        <MagnifyingGlassIcon className={cn("shrink-0 text-foreground", variant === "hero" ? "size-6" : "size-[18px]")} aria-hidden />
        <input
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={variant === "hero" ? "What material are you looking for?" : "Search for anything…"}
          aria-label="Search materials"
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          maxLength={200}
          className={cn("h-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground", variant === "hero" ? "text-lg" : "text-sm")}
        />
        </div>
        {addons}
        {variant === "hero" && (
          <button type="submit" className="flex h-14 cursor-pointer items-center justify-center gap-2 bg-action px-8 font-heading text-lg font-bold text-action-foreground hover:bg-action-hover lg:h-auto">
            Search <ArrowRightIcon className="size-5" />
          </button>
        )}
      </div>
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-raised">
          {items.map((s, i) => (
            <li key={`${s.type}-${s.text}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(i)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2 text-left text-sm", i === active && "bg-surface-muted")}
              >
                <span className="truncate text-foreground">{s.text}</span>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">{s.type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
