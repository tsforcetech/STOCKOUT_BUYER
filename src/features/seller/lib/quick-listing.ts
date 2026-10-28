import type { CategoryEntry } from "./queries";

/**
 * Quick add helpers: a category suggestion from the title, and the choices a seller made last time
 * (currency, condition, location) so the next listing starts pre-filled.
 */

const STOP = new Set(["and", "for", "with", "the", "new", "used", "unused", "set", "lot", "pcs", "pc", "piece", "pieces", "box", "boxes", "inch", "mm", "cm", "kg", "of", "in", "x"]);

function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !/^\d+$/.test(w) && !STOP.has(w))
    .map(stem);
}

/**
 * Up to `max` leaf categories whose name (strongly) or parent path (weakly) shares words with the title.
 * Partial matches count for longer words ("valve" ↔ "valves", "pump" ↔ "pumps").
 */
export function suggestCategories(title: string, categories: Iterable<CategoryEntry>, max = 3): CategoryEntry[] {
  const t = [...new Set(words(title))];
  if (!t.length) return [];
  const hit = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
  const scored: Array<{ c: CategoryEntry; score: number }> = [];
  for (const c of categories) {
    if (!c.isLeaf) continue;
    const name = words(c.name);
    const parents = words(c.path.slice(0, -1).join(" "));
    let score = 0;
    for (const w of t) {
      if (name.some((n) => n === w)) score += 3;
      else if (name.some((n) => hit(n, w))) score += 2;
      else if (parents.some((p) => hit(p, w))) score += 1;
    }
    if (score > 0) scored.push({ c, score: score + (name.length ? 0.1 / name.length : 0) });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.c.path.join(">").localeCompare(b.c.path.join(">")))
    .slice(0, max)
    .map((s) => s.c);
}

export interface QuickDefaults {
  categoryId?: string;
  currency?: string;
  /** Condition code (ids differ per category; codes don't). */
  conditionCode?: string;
  countryCode?: string;
  stateOrEmirate?: string;
  city?: string;
}

const KEY = "stockout.seller.quick-add";

export function loadQuickDefaults(sellerId: string): QuickDefaults {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, QuickDefaults>;
    return all[sellerId] ?? {};
  } catch {
    return {};
  }
}

export function saveQuickDefaults(sellerId: string, value: QuickDefaults): void {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, QuickDefaults>;
    all[sellerId] = value;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}
