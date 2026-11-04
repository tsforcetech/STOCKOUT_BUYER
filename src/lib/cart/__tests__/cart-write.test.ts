import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { BuyerCartResponse } from "@/api/types/buyer-commerce";
import { cartWrite, commerceKeys } from "../server-cart";

const cart = (rowVersion: string) => ({ rowVersion }) as BuyerCartResponse;
const later = <T,>(value: T, ms: number) => new Promise<T>((r) => setTimeout(() => r(value), ms));

describe("cartWrite (BUYER_CART.RowVersion is the only concurrency token)", () => {
  it("runs writes one at a time, each with the version returned by the write before it", async () => {
    const qc = new QueryClient();
    qc.setQueryData(commerceKeys.cart, cart("V1"));
    const sent: (string | null)[] = [];
    const a = cartWrite(qc, (rv) => (sent.push(rv), later(cart("V2"), 20)));
    const b = cartWrite(qc, (rv) => (sent.push(rv), later(cart("V3"), 1)));
    await Promise.all([a, b]);
    expect(sent).toEqual(["V1", "V2"]);
    expect(qc.getQueryData<BuyerCartResponse>(commerceKeys.cart)?.rowVersion).toBe("V3");
  });

  it("keeps the queue moving after a failed write and does not retry it", async () => {
    const qc = new QueryClient();
    qc.setQueryData(commerceKeys.cart, cart("V1"));
    let calls = 0;
    const failed = cartWrite(qc, () => (calls++, Promise.reject(new Error("409"))));
    const next = cartWrite(qc, (rv) => (calls++, Promise.resolve(cart(rv === "V1" ? "V2" : "X"))));
    await expect(failed).rejects.toThrow("409");
    await expect(next).resolves.toEqual(cart("V2"));
    expect(calls).toBe(2);
  });

  it("sends no version for a cart that has none yet", async () => {
    const qc = new QueryClient();
    const sent: (string | null)[] = [];
    await cartWrite(qc, (rv) => (sent.push(rv), Promise.resolve(cart("V1"))));
    expect(sent).toEqual([null]);
  });
});
