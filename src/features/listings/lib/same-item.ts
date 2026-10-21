/** Words that don't identify a product ("Box of 100", "x 4 m"). */
const STOP = new Set(["x", "of", "the", "and", "with", "for", "in", "a", "an", "box", "pack", "set", "per", "new"]);

/** "PPR Pipe PN20 25 mm x 4 m (Green)" → ["ppr", "pipe", "pn20", "25", "mm", "4", "m"]. Bracketed notes are ignored. */
export function titleTokens(title: string): string[] {
  return title
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t && !STOP.has(t));
}

/** Search text for the same product: the title without bracketed notes. */
export function sameItemQuery(title: string): string {
  return title.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}

/**
 * Is `other` the same product as `title`? At least `threshold` of this title's words must appear in the other
 * title, so sizes and grades have to match ("Hex Bolts M20 Grade 10.9" ≠ "Hex Bolts M16 Grade 8.8").
 */
export function isSameItem(title: string, other: string, threshold = 0.75): boolean {
  const mine = [...new Set(titleTokens(title))];
  if (mine.length === 0) return false;
  const theirs = new Set(titleTokens(other));
  return mine.filter((t) => theirs.has(t)).length / mine.length >= threshold;
}
