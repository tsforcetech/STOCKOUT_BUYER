import * as React from "react";

/** Construction-surplus searches the placeholder cycles through ("Try asking for '…'"). */
export const SEARCH_EXAMPLES = [
  "PPR pipes in Dubai",
  "PPR fittings 25 mm",
  "porcelain tiles 60x60",
  "copper cable 16 mm",
  "copper pipes",
  "rebar under 3000 AED",
  "used forklift",
  "fire extinguishers",
] as const;

const TYPE_MS = 75;
const DELETE_MS = 35;
const HOLD_MS = 1500;
const NEXT_MS = 350;

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i]!.toLowerCase() === b[i]!.toLowerCase()) i++;
  return i;
}

function usePrefersReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = React.useState(() => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : true));
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const onChange = () => {
      setReduced(mq.matches);
    };
    mq.addEventListener?.("change", onChange);
    return () => {
      mq.removeEventListener?.("change", onChange);
    };
  }, []);
  return reduced;
}

type Phase = "type" | "delete";

/**
 * Typewriter text for a search placeholder: types an example, holds it, deletes back to the prefix it shares
 * with the next one (so "PPR pipes…" only backs up to "PPR "), then types the next. Returns null while
 * `active` is false or the visitor prefers reduced motion; callers then show a static placeholder.
 */
export function useTypewriter(examples: readonly string[], active: boolean): string | null {
  const reduced = usePrefersReducedMotion();
  const running = active && !reduced && examples.length > 0;
  const [state, setState] = React.useState<{ i: number; n: number; phase: Phase }>({ i: 0, n: 0, phase: "type" });

  React.useEffect(() => {
    if (!running) return;
    const word = examples[state.i % examples.length]!;
    const next = examples[(state.i + 1) % examples.length]!;
    let delay: number;
    let update: { i: number; n: number; phase: Phase };
    if (state.phase === "type") {
      if (state.n < word.length) {
        delay = TYPE_MS + Math.round(Math.random() * 40);
        update = { ...state, n: state.n + 1 };
      } else {
        delay = HOLD_MS;
        update = { ...state, phase: "delete" };
      }
    } else {
      const keep = commonPrefix(word, next);
      if (state.n > keep) {
        delay = DELETE_MS;
        update = { ...state, n: state.n - 1 };
      } else {
        delay = NEXT_MS;
        update = { i: (state.i + 1) % examples.length, n: keep, phase: "type" };
      }
    }
    const timer = window.setTimeout(() => {
      setState(update);
    }, delay);
    return () => {
      window.clearTimeout(timer);
    };
  }, [running, state, examples]);

  if (!running) return null;
  return examples[state.i % examples.length]!.slice(0, state.n);
}
