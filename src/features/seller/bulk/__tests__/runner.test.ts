import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFetch } from "@/test/http";
import type { CreateListingDraftRequest } from "@/api/types/seller-listings";
import { createRateLimiter, runBulkCreate, type RunState } from "../runner";

afterEach(() => vi.unstubAllGlobals());

const SELLER = "s-1";
const draft = (title: string): CreateListingDraftRequest => ({ categoryId: "c-1", title, pricingMode: "FIXED_PRICE", currency: "AED", basePrice: 10 });
const noWait = async () => {};

describe("runBulkCreate", () => {
  it("creates each row with its own idempotency key, sets stock, and continues after a failure", async () => {
    let n = 0;
    let limited = false;
    const { calls } = mockFetch([
      {
        method: "POST",
        path: `/api/v1/marketplace/sellers/${SELLER}/listings`,
        respond: ({ body }) => {
          const title = (body as CreateListingDraftRequest).title;
          if (title === "Rate limited" && !limited) {
            limited = true;
            return { status: 429, body: { error: "TOO_MANY_REQUESTS", message: "slow down" }, headers: { "Retry-After": "0" } };
          }
          if (title === "Bad") return { status: 400, body: { error: "MARKETPLACE_LISTING_CURRENCY_INVALID", message: "MARKETPLACE_LISTING_CURRENCY_INVALID" } };
          n++;
          return { status: 201, body: { listingId: `l-${n}`, currentDraftVersionId: `v-${n}`, versionNumber: 1, status: "DRAFT", rowVersion: "rv" } };
        },
      },
      {
        method: "PUT",
        path: /\/listings\/l-\d+\/inventory$/,
        respond: ({ url }) =>
          url.pathname.includes("l-2")
            ? { status: 400, body: { error: "MARKETPLACE_INVENTORY_QUANTITY_INVALID", message: "x" } }
            : { body: { listingId: "l", onHandQuantity: 5, reservedQuantity: 0, sellableQuantity: 5, quantityUnitId: null, rowVersion: "irv" } },
      },
    ]);
    const updates: Record<string, RunState> = {};
    await runBulkCreate({
      sellerId: SELLER,
      items: [
        { id: "a", draft: draft("First"), quantity: 5, image: null },
        { id: "b", draft: draft("Bad"), quantity: 1, image: null },
        { id: "c", draft: draft("Stock fails"), quantity: 1, image: null },
        { id: "d", draft: draft("Rate limited"), quantity: 2, image: null },
      ],
      submit: true,
      signal: new AbortController().signal,
      onUpdate: (id, s) => (updates[id] = s),
      limiter: noWait,
    });

    expect(updates.a).toMatchObject({ status: "done", listingId: "l-1", submitted: false, note: "Saved as draft — submitting needs a photo." });
    expect(updates.b).toMatchObject({ status: "failed", error: "Creating draft failed: Enter a 3-letter currency code, for example AED." });
    expect(updates.b.listingId).toBeUndefined();
    expect(updates.c).toMatchObject({ status: "failed", listingId: "l-2", error: "Setting stock failed: Quantity can't be negative." });
    expect(updates.d).toMatchObject({ status: "done", listingId: "l-3" });

    const creates = calls.filter((c) => c.method === "POST" && c.url.pathname.endsWith("/listings"));
    const keys = creates.map((c) => c.headers.get("X-Idempotency-Key"));
    expect(keys.every(Boolean)).toBe(true);
    // 5 create calls: a, b, c, d (429) and d's retry — the retry reuses d's key, every row has its own.
    expect(creates).toHaveLength(5);
    expect(keys[3]).toBe(keys[4]);
    expect(new Set(keys).size).toBe(4);
    expect(calls.find((c) => c.method === "PUT" && c.url.pathname.endsWith("l-1/inventory"))?.body).toEqual({ expectedRowVersion: null, onHandQuantity: 5, reasonCode: null, notes: null });
    // No submit without a photo.
    expect(calls.some((c) => c.url.pathname.endsWith("/submit"))).toBe(false);
  });

  it("marks remaining rows cancelled when aborted", async () => {
    mockFetch([]);
    const ac = new AbortController();
    ac.abort();
    const updates: Record<string, RunState> = {};
    await runBulkCreate({ sellerId: SELLER, items: [{ id: "a", draft: draft("A"), quantity: 1, image: null }], submit: false, signal: ac.signal, onUpdate: (id, s) => (updates[id] = s), limiter: noWait });
    expect(updates.a.status).toBe("cancelled");
  });
});

describe("createRateLimiter", () => {
  it("waits when the per-minute budget is used up", async () => {
    vi.useFakeTimers();
    try {
      let now = 0;
      const acquire = createRateLimiter({ perMinute: 2, minGapMs: 0, now: () => now });
      await acquire(1);
      await acquire(1);
      let third = false;
      const p = acquire(1).then(() => (third = true));
      await vi.advanceTimersByTimeAsync(59_000);
      expect(third).toBe(false);
      now = 60_000;
      await vi.advanceTimersByTimeAsync(1_000);
      await p;
      expect(third).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
