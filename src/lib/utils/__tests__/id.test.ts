import { afterEach, describe, expect, it, vi } from "vitest";
import { newId } from "../id";

afterEach(() => vi.unstubAllGlobals());

describe("newId", () => {
  it("works on non-secure (http) pages where crypto.randomUUID is missing", () => {
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => (a.fill(7), a) });
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
