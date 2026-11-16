import { afterEach, describe, expect, it } from "vitest";
import type { CategoryEntry } from "../../lib/queries";
import { TARGETS, type ConvertedRow } from "../mapping";
import { CATEGORY_COL, applyCategoryChoices, categoryGroups, createCategorySuggester, loadCategoryChoices, saveCategoryChoices } from "../category-match";

afterEach(() => localStorage.clear());

const tree: Array<[string, string[]]> = [
  ["p", ["Plumbing & Piping"]],
  ["p-ppr", ["Plumbing & Piping", "PPR Pipes & Fittings"]],
  ["p-hdpe", ["Plumbing & Piping", "HDPE Pipes & Fittings"]],
  ["p-gi", ["Plumbing & Piping", "GI & Malleable Fittings"]],
  ["p-drain", ["Plumbing & Piping", "Drainage Systems"]],
  ["s", ["Steel & Metals"]],
  ["s-ss", ["Steel & Metals", "Stainless Steel"]],
  ["s-ms", ["Steel & Metals", "Mild Steel"]],
  ["e", ["Electrical & Cables"]],
  ["e-power", ["Electrical & Cables", "Power Cables"]],
  ["e-cb", ["Electrical & Cables", "Circuit Breakers"]],
  ["b", ["Sanitaryware & Bathroom"]],
  ["b-taps", ["Sanitaryware & Bathroom", "Taps & Mixers"]],
];
const index = new Map<string, CategoryEntry>(tree.map(([id, path]) => [id, { categoryId: id, name: path.at(-1)!, path, depth: path.length - 1, isLeaf: path.length === 2 }]));
const leaves = [...index.values()].filter((c) => c.isLeaf);
const row = (n: number, title: string, category: string): ConvertedRow => ({ sourceRow: n, cells: TARGETS.map((t) => (t.key === "title" ? title : t.key === "category" ? category : "")), missing: [], notes: [] });

describe("createCategorySuggester", () => {
  const suggest = createCategorySuggester(leaves);
  it.each([
    ["PLUMBING_PPR PIPES & FITTINGS", "p-ppr"],
    ["plumbing_hdpe pipes", "p-hdpe"],
    ["GI & MI FITTINGS", "p-gi"],
    ["PLUMBING_DRAINAGE SYSTEMS", "p-drain"],
    ["STAINLESS STEEL_FITTINGS", "s-ss"],
    ["SANITARY_TAPS & MIXERS", "b-taps"],
  ])("suggests %s → %s", (value, id) => expect(suggest(value)?.categoryId).toBe(id));

  it.each(["PLUMBING", "ELECTRICAL", "FITTINGS", "random stuff", ""])("makes no guess for %j", (value) => expect(suggest(value)).toBeNull());
});

describe("categoryGroups", () => {
  const rows = [
    row(2, "1in GI tee", "GI & MI FITTINGS"),
    row(3, "PPR elbow", "PLUMBING_PPR PIPES & FITTINGS"),
    row(4, "GI elbow", "gi & mi fittings"),
    row(5, "Valve", "p-ppr"), // already a StockOut leaf id
    row(6, "Pump", "PLUMBING"), // a general (parent) category name
    row(7, "No category", ""),
  ];

  it("groups unknown names case-insensitively, most rows first, with suggestions and examples", () => {
    const groups = categoryGroups(rows, index, createCategorySuggester(leaves), {});
    expect(groups.map((g) => [g.value, g.rows, g.suggestion?.categoryId ?? null])).toEqual([
      ["GI & MI FITTINGS", 2, "p-gi"],
      ["PLUMBING", 1, null],
      ["PLUMBING_PPR PIPES & FITTINGS", 1, "p-ppr"],
    ]);
    expect(groups[0].examples).toEqual(["1in GI tee", "GI elbow"]);
    expect(groups[1].general?.categoryId).toBe("p");
  });

  it("prefers the seller's saved choice over a guess", () => {
    saveCategoryChoices({ "gi mi fittings": "s-ms" });
    const groups = categoryGroups(rows, index, createCategorySuggester(leaves));
    expect(groups[0].suggestion).toEqual({ categoryId: "s-ms", from: "saved" });
  });

  it("applies one choice to every row with that name and leaves the rest as written", () => {
    const out = applyCategoryChoices(rows, { "gi mi fittings": "p-gi", plumbing: "" });
    expect(out.map((r) => r.cells[CATEGORY_COL])).toEqual(["p-gi", "PLUMBING_PPR PIPES & FITTINGS", "p-gi", "p-ppr", "PLUMBING", ""]);
  });

  it("remembers only real choices", () => {
    saveCategoryChoices({ a: "p-gi", b: "" });
    expect(loadCategoryChoices()).toEqual({ a: "p-gi" });
  });
});
