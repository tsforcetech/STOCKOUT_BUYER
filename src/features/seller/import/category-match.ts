/**
 * "Match your categories": sellers write their own group names ("GI & MI FITTINGS", "PLUMBING_PPR PIPES") in the
 * category column, which the server rejects (CATEGORY_INVALID_OR_INACTIVE). Before upload we group the rows by
 * that value, suggest a StockOut leaf category for each, and let the seller confirm, so one choice fixes every
 * row with that name. Choices are remembered per name for the next import.
 */
import type { CategoryEntry } from "../lib/queries";
import { TARGETS, type ConvertedRow } from "./mapping";

export const CATEGORY_COL = TARGETS.findIndex((t) => t.key === "category");
const TITLE_COL = TARGETS.findIndex((t) => t.key === "title");

/** Same value, different spelling: case, spacing and punctuation are ignored. */
export const categoryKey = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const STOP = new Set(["and", "the", "of", "for", "with", "other", "others", "general", "misc", "item", "items", "product", "products", "accessory", "accessories"]);
const stem = (w: string) => (w.length > 4 && w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.length > 3 && /(ss|x|ch|sh)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const words = (s: string) => new Set(categoryKey(s).split(" ").filter((w) => w && !STOP.has(w)).map(stem));

export type Suggest = (value: string) => CategoryEntry | null;

/**
 * Best-guess leaf category for a seller's own name, or null when nothing is a clear winner. Words that are rare
 * in the taxonomy ("ppr", "hdpe", "stainless") count for more than common ones ("fitting", "pipe"); at least one
 * word must be in the leaf's own name (not only its parent), and the winner must be clearly ahead of the runner-up.
 */
export function createCategorySuggester(leaves: CategoryEntry[]): Suggest {
  const docs = leaves.map((c) => ({ c, name: words(c.name), all: words(c.path.join(" ")) }));
  const df = new Map<string, number>();
  for (const d of docs) for (const w of d.all) df.set(w, (df.get(w) ?? 0) + 1);
  const idf = (w: string) => Math.log(1 + docs.length / (df.get(w) ?? 1));
  const weight = (ws: Iterable<string>) => [...ws].reduce((s, w) => s + idf(w), 0);
  return (value) => {
    const q = words(value);
    const qWeight = weight(q);
    if (!qWeight) return null;
    const scored = docs
      .map((d) => {
        let shared = 0;
        let inName = 0;
        for (const w of q) {
          if (!d.all.has(w)) continue;
          shared += idf(w);
          if (d.name.has(w)) inName += idf(w);
        }
        const nameWeight = weight(d.name) || 1;
        return { c: d.c, inName, score: 0.6 * (shared / qWeight) + 0.4 * (inName / nameWeight) };
      })
      .filter((s) => s.inName > 0)
      .sort((a, b) => b.score - a.score);
    const [best, next] = scored;
    if (!best || best.score < 0.45 || (next && best.score - next.score < 0.08)) return null;
    return best.c;
  };
}

export interface CategoryGroup {
  key: string;
  /** As written in the seller's file (first spelling seen). */
  value: string;
  rows: number;
  examples: string[];
  /** The value names a StockOut category that has sub-categories; listings need a specific one. */
  general?: CategoryEntry;
  suggestion: { categoryId: string; from: "saved" | "guess" } | null;
}

/** Distinct category values that aren't a StockOut leaf category, most rows first. */
export function categoryGroups(rows: ConvertedRow[], index: Map<string, CategoryEntry>, suggest: Suggest, saved: Record<string, string> = loadCategoryChoices()): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  const byName = new Map<string, CategoryEntry>();
  for (const c of index.values()) if (!c.isLeaf) byName.set(categoryKey(c.name), c);
  for (const r of rows) {
    const value = String(r.cells[CATEGORY_COL] ?? "").trim();
    if (!value || index.get(value)?.isLeaf) continue;
    const key = categoryKey(value) || value;
    let g = groups.get(key);
    if (!g) {
      // "PLUMBING" names "Plumbing & Piping": exact name, or the start of exactly one parent's name.
      const starts = [...byName.entries()].filter(([k]) => k.startsWith(`${key} `));
      const general = index.get(value) ?? byName.get(key) ?? (starts.length === 1 ? starts[0][1] : undefined);
      const remembered = saved[key] && index.get(saved[key])?.isLeaf ? saved[key] : null;
      const guess = remembered ? null : suggest(value);
      g = { key, value, rows: 0, examples: [], general: general && !general.isLeaf ? general : undefined, suggestion: remembered ? { categoryId: remembered, from: "saved" } : guess ? { categoryId: guess.categoryId, from: "guess" } : null };
      groups.set(key, g);
    }
    g.rows++;
    const title = String(r.cells[TITLE_COL] ?? "").trim();
    if (title && g.examples.length < 2) g.examples.push(title);
  }
  return [...groups.values()].sort((a, b) => b.rows - a.rows || a.value.localeCompare(b.value));
}

/** Puts the chosen category id on every row of each matched name; unmatched names are left as written. */
export function applyCategoryChoices(rows: ConvertedRow[], choices: Record<string, string>): ConvertedRow[] {
  return rows.map((r) => {
    const value = String(r.cells[CATEGORY_COL] ?? "").trim();
    const id = value ? choices[categoryKey(value) || value] : "";
    if (!id) return r;
    const cells = [...r.cells];
    cells[CATEGORY_COL] = id;
    return { ...r, cells, notes: r.notes.filter((n) => !n.startsWith("Category ")) };
  });
}

const STORE = "stockout.import.categoryChoices";
export function loadCategoryChoices(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
export function saveCategoryChoices(choices: Record<string, string>): void {
  try {
    const all = { ...loadCategoryChoices(), ...Object.fromEntries(Object.entries(choices).filter(([, v]) => v)) };
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - 300))) delete all[k];
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch {
    /* storage unavailable: choices just aren't remembered */
  }
}
