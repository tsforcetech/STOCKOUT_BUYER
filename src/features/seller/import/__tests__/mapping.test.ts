import { describe, expect, it } from "vitest";
import readExcelFile from "read-excel-file/universal";
import { autoMap, convert, readAs, detectHeaderRow, headersOf, TARGETS, TEMPLATE_HEADERS, toIsoDate, toNumber, writeTemplate, type Cell } from "../mapping";

// A typical stock ledger: a title row, the headings, then data with its own column names and formats.
const LEDGER: Cell[][] = [
  ["EMCORE Trading — Stock ledger Oct 2026", null, null, null, null, null],
  ["Item Code", "Item Description", "UOM", "Qty", "Rate (AED)", "Item Group"],
  ["EM-001", "PPR pipe 25mm", "MTR", 120, "AED 1,250.50", "Pumps > Centrifugal Pumps"],
  [null, null, null, null, null, null],
  ["EM-002", "Gate valve 2 inch", "PCS", "40", 85, "Unknown group"],
];

describe("own-sheet mapping", () => {
  it("finds the heading row and matches common column names", () => {
    const headerRow = detectHeaderRow(LEDGER);
    expect(headerRow).toBe(1);
    const m = autoMap(headersOf(LEDGER, headerRow));
    expect(m.sku).toEqual({ kind: "column", col: 0 });
    expect(m.title).toEqual({ kind: "column", col: 1 });
    expect(m.unit).toEqual({ kind: "column", col: 2 });
    expect(m.quantity).toEqual({ kind: "column", col: 3 });
    expect(m.price).toEqual({ kind: "column", col: 4 });
    expect(m.category).toEqual({ kind: "column", col: 5 });
    expect(m.currency).toEqual({ kind: "fixed", value: "AED" });
    expect(m.country).toEqual({ kind: "fixed", value: "AE" });
    expect(m.brand).toEqual({ kind: "none" });
  });

  it("cleans numbers and dates the way sellers type them", () => {
    expect(toNumber("AED 1,250.50")).toBe(1250.5);
    expect(toNumber("1.250,5")).toBe(1250.5);
    expect(toNumber(" 40 ")).toBe(40);
    expect(toNumber("1,250")).toBe(1250);
    expect(toNumber("12,5")).toBe(12.5);
    expect(toNumber("1,250,000")).toBe(1250000);
    expect(toNumber("ask")).toBe("ask");
    expect(toIsoDate("31/12/2027")).toBe("2027-12-31");
    expect(toIsoDate(46387)).toBe("2026-12-31");
    expect(toIsoDate(new Date("2027-01-05T00:00:00Z"))).toBe("2027-01-05");
  });

  it("converts rows into the 19 template columns, resolving categories and skipping blank rows", () => {
    const m = autoMap(headersOf(LEDGER, 1));
    const rows = convert(LEDGER, 1, { ...m, emirate: { kind: "fixed", value: "Dubai" } }, { resolveCategory: (v) => (v.startsWith("Pumps") ? "cat-pumps" : null) });
    expect(rows).toHaveLength(2);
    const at = (r: number, key: string) => rows[r].cells[TARGETS.findIndex((t) => t.key === key)];
    expect(rows[0].sourceRow).toBe(3);
    expect(at(0, "sku")).toBe("EM-001");
    expect(at(0, "category")).toBe("cat-pumps");
    expect(at(0, "price")).toBe(1250.5);
    expect(at(0, "quantity")).toBe(120);
    expect(at(0, "currency")).toBe("AED");
    expect(at(0, "emirate")).toBe("Dubai");
    expect(at(1, "quantity")).toBe(40);
    expect(rows[1].notes.join(" ")).toMatch(/isn't a StockOut category/);
    expect(rows[0].missing).toEqual([]);
  });

  it("generates item codes when the sheet has none and reports missing required values", () => {
    const sheet: Cell[][] = [["Name", "Qty"], ["Copper cable", 10]];
    const rows = convert(sheet, 0, autoMap(headersOf(sheet, 0)));
    expect(rows[0].cells[0]).toBe("ROW-0001");
    expect(rows[0].missing).toEqual(expect.arrayContaining(["Category", "Price per unit", "Unit"]));
  });

  it("writes a Products sheet the server reads by position: headings in row 1, data from row 2", async () => {
    const rows = convert(LEDGER, 1, autoMap(headersOf(LEDGER, 1)));
    const file = await writeTemplate(rows);
    const sheets = (await readExcelFile(await readAs(file, "arrayBuffer"))) as Array<{ sheet: string; data: Cell[][] }>;
    expect(sheets[0].sheet).toBe("Products");
    expect(sheets[0].data[0]).toEqual(TEMPLATE_HEADERS);
    expect(sheets[0].data[1].slice(0, 3)).toEqual(["EM-001", "PPR pipe 25mm", "Pumps > Centrifugal Pumps"]);
    expect(sheets[0].data[1][6]).toBe(1250.5);
    expect(sheets[0].data[1][10]).toBe(120);
    expect(sheets[0].data[1][11]).toBe("MTR");
  });
});
