import { describe, expect, it } from "vitest";
import { expectArray, unwrapData } from "../envelope";

describe("unwrapData", () => {
  it("unwraps { success, data }", () => {
    expect(unwrapData({ success: true, data: [1, 2] })).toEqual([1, 2]);
  });
  it("unwraps files { data }", () => {
    expect(unwrapData({ data: { fileId: "f" } })).toEqual({ fileId: "f" });
  });
  it("passes through bare DTOs that happen to contain a data field among others", () => {
    const dto = { data: 1, totalCount: 3 };
    expect(unwrapData(dto)).toBe(dto);
  });
  it("throws on success:false", () => {
    expect(() => unwrapData({ success: false, data: null, message: "nope" })).toThrow("nope");
  });
  it("unwraps an envelope that carries extra keys", () => {
    expect(unwrapData({ success: true, data: [1], message: null, errors: null, traceId: "t" })).toEqual([1]);
  });
});

describe("expectArray", () => {
  it("returns arrays and maps null/undefined to []", () => {
    expect(expectArray([1])).toEqual([1]);
    expect(expectArray(null)).toEqual([]);
    expect(expectArray(undefined)).toEqual([]);
  });
  it("rejects objects and strings instead of letting them reach .map", () => {
    expect(() => expectArray({ items: [] })).toThrow(/unexpected response/);
    expect(() => expectArray("<!doctype html>")).toThrow(/unexpected response/);
  });
});
