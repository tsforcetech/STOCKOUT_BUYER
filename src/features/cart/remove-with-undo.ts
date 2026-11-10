import * as React from "react";
import { toast } from "sonner";

export const prefersReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Lets a row slide out (~180 ms) before it is removed. The removal itself takes the row out of the list at once
 * (server cart: optimistic update; device cart: local), so nothing reappears while the server answers.
 */
export function useLeavingRows() {
  const [leaving, setLeaving] = React.useState<ReadonlySet<string>>(new Set());
  const leave = React.useCallback((id: string, run: () => void) => {
    if (prefersReducedMotion()) return run();
    setLeaving((s) => new Set(s).add(id));
    window.setTimeout(() => {
      run();
      // Clear on the next frame, after the optimistic removal has unmounted the row (or after a failure restored it).
      window.setTimeout(() => {
        setLeaving((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      }, 50);
    }, 180);
  }, []);
  return { isLeaving: (id: string) => leaving.has(id), leave };
}

/** "Removed <item> · Undo" toast. Undo puts the line back with the same quantity. */
export function undoToast(title: string, onUndo: () => void) {
  toast(`Removed ${title}`, { action: { label: "Undo", onClick: onUndo }, duration: 6000 });
}
