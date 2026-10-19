import type * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils/format";

/** Full-screen filters sheet for phones/tablets. Filters apply live; the footer shows the live result count. */
export function FilterSheet({
  open,
  onOpenChange,
  activeCount,
  resultCount,
  loading,
  onClearAll,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
  resultCount: number | undefined;
  loading: boolean;
  onClearAll: () => void;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col bg-surface focus:outline-none data-[state=open]:animate-[fade-in_150ms_ease-out]"
          aria-describedby={undefined}
        >
          <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
            <DialogPrimitive.Title className="flex items-center gap-2 font-heading text-xl font-bold text-foreground">
              Filters
              {activeCount > 0 && <span className="rounded-full bg-action px-2 py-0.5 text-xs text-action-foreground">{activeCount}</span>}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="flex size-10 cursor-pointer items-center justify-center rounded-full text-foreground hover:bg-surface-muted" aria-label="Close filters">
              <XIcon className="size-5" />
            </DialogPrimitive.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">{children}</div>
          <footer className="flex items-center gap-3 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {activeCount > 0 && (
              <Button variant="ghost" onClick={onClearAll} className="underline underline-offset-4">
                Clear all
              </Button>
            )}
            <Button className="h-12 flex-1 text-base" aria-busy={loading || undefined} onClick={() => onOpenChange(false)}>
              {resultCount === undefined || loading ? "Show results" : `Show ${formatNumber(resultCount)} results`}
            </Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
