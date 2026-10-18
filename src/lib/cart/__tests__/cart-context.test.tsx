import { act, renderHook } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CartProvider, clampQuantity, useCart } from "../cart-context";

const wrapper = ({ children }: { children: React.ReactNode }) => <CartProvider>{children}</CartProvider>;
const item = { listingId: "l1", title: "PPR Elbow", sellerName: "Gulf", unitPrice: 2.5, currency: "AED", unitSymbol: "pcs", imageUrl: null, quantity: 3, maxQuantity: 10 };

afterEach(() => localStorage.clear());

describe("cart", () => {
  it("clamps quantities to 1..max", () => {
    expect(clampQuantity(0, 5)).toBe(1);
    expect(clampQuantity(Number.NaN, 5)).toBe(1);
    expect(clampQuantity(9, 5)).toBe(5);
    expect(clampQuantity(2.5, 5)).toBe(2.5);
  });

  it("adds, merges the same listing up to available stock, and persists", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.add(item));
    act(() => result.current.add({ ...item, quantity: 9 }));
    expect(result.current.count).toBe(1);
    expect(result.current.items[0]!.quantity).toBe(10);
    expect(JSON.parse(localStorage.getItem("stockout.market.cart")!)[0].quantity).toBe(10);
  });

  it("updates quantity, removes and clears", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.add(item));
    act(() => result.current.add({ ...item, listingId: "l2" }));
    act(() => result.current.setQuantity("l1", 7));
    expect(result.current.items.find((i) => i.listingId === "l1")!.quantity).toBe(7);
    act(() => result.current.remove("l1"));
    expect(result.current.has("l1")).toBe(false);
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
  });

  it("ignores corrupt stored data", () => {
    localStorage.setItem("stockout.market.cart", '{"not":"an array"}');
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toEqual([]);
  });
});
