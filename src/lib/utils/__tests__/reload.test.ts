import { afterEach, describe, expect, it, vi } from "vitest";
import { isLoadFailure, reloadOnce } from "../reload";

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("load-failure recovery", () => {
  it("recognises script-load failures from Safari/Instagram, Chrome and Firefox", () => {
    for (const m of [
      "Importing a module script failed.",
      "Load failed",
      "'text/html' is not a valid JavaScript MIME type.",
      "Failed to fetch dynamically imported module: https://x/assets/a.js",
      "error loading dynamically imported module",
    ])
      expect(isLoadFailure(new TypeError(m))).toBe(true);
    expect(isLoadFailure(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
    expect(isLoadFailure("Load failed")).toBe(false);
  });

  it("reloads at most once within 30 seconds", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    expect(reloadOnce()).toBe(true);
    expect(reloadOnce()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
