import * as React from "react";
import { toast } from "sonner";

export const prefersReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Lets a row slide out (~180 ms) before it is removed. If the removal fails, the row simply stays. */
export function useLeavingRows() {
  const [leaving, setLeaving] = React.useState<ReadonlySet<string>>(new Set());
  const leave = React.useCallback((id: string, run: () => void) => {
    if (prefersReducedMotion()) return run();
    setLeaving((s) => new Set(s).add(id));
    window.setTimeout(() => {
      run();
      setLeaving((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }, 180);
  }, []);
  return { isLeaving: (id: string) => leaving.has(id), leave };
}

/** "Removed <item> · Undo" toast. Undo puts the line back with the same quantity. */
export function undoToast(title: string, onUndo: () => void) {
  toast(`Removed ${title}`, { action: { label: "Undo", onClick: onUndo }, duration: 6000 });
}
