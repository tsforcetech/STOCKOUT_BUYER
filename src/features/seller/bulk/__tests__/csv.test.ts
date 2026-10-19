import { describe, expect, it } from "vitest";
import { csvLine, parseCsv, toCsvText } from "../csv";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3").rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("strips a UTF-8 BOM and handles CRLF and a trailing newline", () => {
    const r = parseCsv("﻿title,price\r\nBolts,10\r\n");
    expect(r.rows).toEqual([
      ["title", "price"],
      ["Bolts", "10"],
    ]);
    expect(r.error).toBeNull();
  });

  it("handles lone CR line endings", () => {
    expect(parseCsv("a\rb").rows).toEqual([["a"], ["b"]]);
  });

  it("keeps commas, newlines and doubled quotes inside quoted fields", () => {
    const r = parseCsv('title,description\n"Bolts, M8","Line 1\r\nLine 2 ""quoted"""\nNext,row');
    expect(r.rows).toEqual([
      ["title", "description"],
      ["Bolts, M8", 'Line 1\r\nLine 2 "quoted"'],
      ["Next", "row"],
    ]);
    // Line numbers point at where each row starts in the file.
    expect(r.lines).toEqual([1, 2, 4]);
  });

  it("keeps empty fields, including a trailing empty field and quoted empties", () => {
    expect(parseCsv('a,,c,\n"",x').rows).toEqual([
      ["a", "", "c", ""],
      ["", "x"],
    ]);
  });

  it("keeps a stray quote inside an unquoted field literally", () => {
    expect(parseCsv('12" pipe,5').rows).toEqual([['12" pipe', "5"]]);
  });

  it("reports an unterminated quoted field", () => {
    const r = parseCsv('a,b\n"open,1\n2');
    expect(r.error).toMatch(/line 2/);
  });

  it("supports another delimiter", () => {
    expect(parseCsv("a;b\n1;2", ";").rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns no rows for empty input", () => {
    expect(parseCsv("").rows).toEqual([]);
  });

  it("round-trips values written by csvLine / toCsvText", () => {
    const rows = [
      ["title", "description"],
      ['He said "hi", then left', "multi\nline"],
      [" padded ", ""],
    ];
    expect(csvLine(rows[1])).toBe('"He said ""hi"", then left","multi\nline"');
    expect(parseCsv(toCsvText(rows)).rows).toEqual(rows);
  });
});
