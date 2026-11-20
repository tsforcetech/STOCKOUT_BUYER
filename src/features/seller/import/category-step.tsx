import * as React from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, TagIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";
import type { CategoryEntry } from "../lib/queries";
import type { CategoryGroup } from "./category-match";

const NONE = "";

/**
 * "Match your categories": one row per category name in the seller's file that isn't a StockOut category, with a
 * pre-filled best guess. One choice moves every product with that name. Every name needs a category before
 * Continue, so no row reaches the server check with a category StockOut doesn't have.
 */
export function CategoryStep({
  groups,
  leaves,
  initial,
  sourceName,
  onBack,
  onContinue,
  busy,
  error,
}: {
  groups: CategoryGroup[];
  leaves: CategoryEntry[];
  /** Choices from an earlier visit to this step (key → category id). */
  initial?: Record<string, string>;
  sourceName: string;
  onBack: () => void;
  onContinue: (choices: Record<string, string>) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const [choices, setChoices] = React.useState<Record<string, string>>(() => initial ?? Object.fromEntries(groups.map((g) => [g.key, g.suggestion?.categoryId ?? NONE])));
  const sorted = React.useMemo(() => [...leaves].sort((a, b) => a.path.join(" › ").localeCompare(b.path.join(" › "))), [leaves]);

  const matched = groups.filter((g) => choices[g.key]);
  const rowsMatched = matched.reduce((n, g) => n + g.rows, 0);
  const rowsTotal = groups.reduce((n, g) => n + g.rows, 0);
  const left = groups.length - matched.length;
  const toCheck = groups.filter((g) => choices[g.key] && g.suggestion?.from === "guess" && choices[g.key] === g.suggestion.categoryId).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <section className="overflow-hidden rounded-2xl bg-surface">
        <header className="border-b border-border px-4 py-4 sm:px-5">
          <h2 className="font-heading text-lg font-bold text-foreground">Match your categories</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {groups.length === 1 ? "1 category name" : `${formatNumber(groups.length)} category names`} in your file {groups.length === 1 ? "isn't a StockOut category" : "aren't StockOut categories"}. Choose where each one goes. Every product with that name moves together, and we'll remember your choice next time.
          </p>
        </header>
        <ul className="divide-y divide-border" aria-label="Your categories">
          {groups.map((g) => {
            const chosen = choices[g.key] ?? NONE;
            const isGuess = !!chosen && g.suggestion?.from === "guess" && chosen === g.suggestion.categoryId;
            const isSaved = !!chosen && g.suggestion?.from === "saved" && chosen === g.suggestion.categoryId;
            return (
              <li key={g.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
                <div className="min-w-0 sm:w-[42%] sm:shrink-0 sm:pt-1.5">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {chosen ? <CheckCircleIcon weight="fill" className="size-4 shrink-0 text-success" aria-hidden /> : <WarningCircleIcon weight="fill" className="size-4 shrink-0 text-warning" aria-hidden />}
                    <span className="break-words">{g.value}</span>
                  </p>
                  {g.detail && <p className="mt-0.5 pl-6 text-xs font-medium text-body">{g.detail}</p>}
                  <p className="mt-0.5 pl-6 text-xs text-muted-foreground">
                    {formatNumber(g.rows)} {g.rows === 1 ? "product" : "products"}
                    {g.examples.length ? ` · e.g. ${g.examples.join(", ")}` : ""}
                  </p>
                  {g.general && <p className="mt-0.5 pl-6 text-xs text-warning-soft-foreground">“{g.general.path.join(" › ")}” is a general category. Choose a specific one.</p>}
                </div>
                <div className="min-w-0 flex-1">
                  <NativeSelect
                    aria-label={`StockOut category for ${g.value}`}
                    value={chosen}
                    searchable
                    searchPlaceholder="Search categories"
                    disabled={busy}
                    onChange={(e) => setChoices((c) => ({ ...c, [g.key]: e.target.value }))}
                  >
                    <option value={NONE}>Choose a category</option>
                    {sorted.map((c) => (
                      <option key={c.categoryId} value={c.categoryId}>
                        {c.path.join(" › ")}
                      </option>
                    ))}
                  </NativeSelect>
                  <p className="mt-1 text-xs">
                    {isSaved ? (
                      <Badge tone="info">Your choice last time</Badge>
                    ) : isGuess ? (
                      <Badge tone="warning">Suggested · please check</Badge>
                    ) : !chosen ? (
                      <span className="text-warning-soft-foreground">{g.suggestion ? "" : "No close match found. "}Choose where these products go.</span>
                    ) : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-[80px]" aria-label="Summary">
        <section className="rounded-2xl bg-surface p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted ring-1 ring-border" aria-hidden>
              <TagIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-xl font-bold text-foreground" data-testid="category-counts">
                {formatNumber(matched.length)} of {formatNumber(groups.length)} matched
              </p>
              <p className="truncate text-xs text-muted-foreground">{sourceName}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {formatNumber(rowsMatched)} of {formatNumber(rowsTotal)} products get a StockOut category.
          </p>
          {toCheck > 0 && <p className="mt-2 text-xs text-warning-soft-foreground">{toCheck === 1 ? "1 suggestion is" : `${formatNumber(toCheck)} suggestions are`} our best guess. Check {toCheck === 1 ? "it" : "them"} before you continue.</p>}
          {left > 0 && (
            <p className={cn("mt-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground")} role="status">
              Choose a category for {left === 1 ? "1 more name" : `${formatNumber(left)} more names`} to continue.
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={onBack} disabled={busy} aria-label="Back">
              <ArrowLeftIcon />
            </Button>
            <Button className="flex-1" onClick={() => onContinue(choices)} disabled={busy || left > 0} loading={busy}>
              Continue <ArrowRightIcon />
            </Button>
          </div>
        </section>
      </aside>
    </div>
  );
}
