import { CheckIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";

/**
 * Compact horizontal progress indicator for multi-step seller flows (new listing, bulk upload).
 * `current` is 1-based. Labels collapse to the current step only on narrow screens.
 */
export function Stepper({ steps, current, className }: { steps: readonly string[]; current: number; className?: string }) {
  return (
    <ol className={cn("mb-4 flex items-center gap-2 rounded-xl bg-surface px-4 py-3 sm:gap-3", className)} aria-label="Steps">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className={cn("flex min-w-0 items-center gap-2 sm:gap-3", n < steps.length && "flex-1", active && (n < steps.length ? "flex-none sm:flex-1" : "flex-none"))} aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                done ? "border-action-border bg-action text-action-foreground" : active ? "border-ink bg-ink text-ink-foreground" : "border-secondary-border bg-surface text-muted-foreground",
              )}
              aria-hidden
            >
              {done ? <CheckIcon weight="bold" className="size-3.5" /> : n}
            </span>
            <span className={cn("text-sm sm:truncate", active && "whitespace-nowrap sm:whitespace-normal", active ? "font-medium text-foreground" : "hidden text-muted-foreground sm:inline", done && "sm:text-foreground")}>
              {label}
              <span className="sr-only">{done ? " (done)" : active ? " (current step)" : ""}</span>
            </span>
            {n < steps.length && <span className={cn("h-px min-w-3 flex-1", done ? "bg-action-border" : "bg-border-strong")} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
