import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBump } from "../use-bump";

describe("useBump", () => {
  it("changes only when the value goes up", () => {
    const { result, rerender } = renderHook(({ v }) => useBump(v), { initialProps: { v: 2 } });
    expect(result.current).toBe(0); // no animation on first render
    rerender({ v: 3 });
    expect(result.current).toBe(1);
    rerender({ v: 1 });
    expect(result.current).toBe(1); // removing doesn't bounce
    rerender({ v: 2 });
    expect(result.current).toBe(2);
  });
});
