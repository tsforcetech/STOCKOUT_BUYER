import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { RequireAuth } from "@/lib/auth/guards";
import CartPage from "../cart-page";
import { MergePrompt } from "../merge-prompt";
import SavedPage from "@/features/favorites/saved-page";
import { FavoriteButton } from "@/features/favorites/favorite-button";
import { readPendingMerge } from "@/lib/cart/guest-merge";
import type { BuyerCartResponse } from "@/api/types/buyer-commerce";
import { SEND_IF_MATCH } from "@/services/buyer-commerce.service";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const L1 = "11111111-1111-4111-8111-111111111111";
const L2 = "33333333-3333-4333-8333-333333333333";
const S1 = "22222222-2222-4222-8222-222222222222";
const signIn = () => {
  sessionStorage.setItem("stockout.market.rt", "rt-1");
  localStorage.setItem("stockout.market.rt", "rt-1");
};

const line = (over: object = {}) => ({
  cartItemId: "ci-1", listingId: L1, sellerId: S1, title: "Gate valve DN100", thumbnailUrl: null, quantity: 4, addedPrice: 100, currentPrice: 110,
  addedCurrency: "AED", currentCurrency: "AED", hasPriceChanged: true, priceDifference: 10, stockAvailable: 2, hasSufficientStock: false,
  isActive: true, isPurchasable: true, itemState: "ACTIVE", statusMessage: null, lineSubtotal: 440, ...over,
});
const cart = (over: Partial<BuyerCartResponse> = {}): BuyerCartResponse => ({
  cartId: "c-1", buyerId: "u-1", itemCount: 1, totalQuantity: 4, totalSubtotal: 440, estimatedVatRatePercent: 7.5, estimatedVatAmount: 33, estimatedTotal: 473,
  currency: "AED", rowVersion: "AAAAAAAAB9E=", updatedAt: "2026-11-03T08:00:00Z",
  sellerGroups: [{ sellerId: S1, sellerDisplayName: "Gulf Valves LLC", groupSubtotal: 440, items: [line()] }],
  checkoutReadiness: { canProceed: false, blockers: [{ code: "BUYER_IDENTITY_VERIFICATION_REQUIRED", message: "Complete identity verification before purchasing.", listingId: null }] },
  ...over,
});
const page = (element: React.ReactNode, path: string) => renderWithApp([{ element: <RequireAuth />, children: [{ path, element }] }, { path: "/login", element: <div>login</div> }], path);
const cartRoute = (respond: () => { status?: number; body?: unknown }) => ({ method: "GET", path: "/api/v1/buyer/cart", respond });
const empty = { method: "GET", path: "/api/v1/buyer/cart/saved-items", respond: () => ({ body: { items: [], totalCount: 0 } }) };
const wishIds = { method: "GET", path: "/api/v1/buyer/wishlist", respond: () => ({ body: { wishlistId: "w", buyerId: "u-1", totalItems: 0, pageNumber: 1, pageSize: 100, items: [] } }) };

describe("Stage 8A.2 server cart", () => {
  it("shows seller groups, price change, short stock without reducing the quantity, API VAT rate and the verification blocker", async () => {
    signIn();
    mockFetch([...sessionRoutes([]), cartRoute(() => ({ body: cart() })), empty, wishIds]);
    page(<CartPage />, "/cart");
    expect(await screen.findByText("Gulf Valves LLC")).toBeInTheDocument();
    expect(screen.getByText(/Price changed from AED\s?100(\.00)? to AED\s?110/)).toBeInTheDocument();
    expect(screen.getByText(/Only 2 available/)).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Quantity" })).toHaveValue(4); // never silently reduced
    expect(screen.getByText("Estimated VAT (7.5%)")).toBeInTheDocument(); // rate from the API, not a hardcoded 5%
    expect(screen.getByRole("link", { name: "Verify my account" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("button", { name: /Proceed to checkout/ })).toBeDisabled();
  });

  it("sends the cart rowVersion as a quoted If-Match (when enabled) and reloads the cart after a concurrency conflict", async () => {
    signIn();
    let gets = 0;
    const { calls } = mockFetch([
      ...sessionRoutes([]),
      cartRoute(() => (gets++, { body: cart() })),
      empty,
      wishIds,
      { method: "PUT", path: `/api/v1/buyer/cart/items/${L1}`, respond: () => ({ status: 409, body: { status: 409, title: "Conflict", code: "CART_CONCURRENCY_CONFLICT" } }) },
    ]);
    page(<CartPage />, "/cart");
    await userEvent.click(await screen.findByRole("button", { name: "Decrease quantity" }));
    await waitFor(() => {
      const put = calls.find((c) => c.method === "PUT");
      expect(put?.headers.get("If-Match")).toBe(SEND_IF_MATCH ? '"AAAAAAAAB9E="' : null);
      expect(put?.body).toEqual({ quantity: 3 });
    });
    expect(await screen.findByText(/Your cart changed in another tab or device/)).toBeInTheDocument();
    await waitFor(() => expect(gets).toBeGreaterThan(1));
  });

  it("does not combine mixed currencies into one total", async () => {
    signIn();
    mockFetch([...sessionRoutes([]), cartRoute(() => ({ body: cart({ checkoutReadiness: { canProceed: false, blockers: [{ code: "MIXED_CURRENCY_NOT_SUPPORTED", message: "x", listingId: null }] } }) })), empty, wishIds]);
    page(<CartPage />, "/cart");
    expect(await screen.findAllByText(/different currencies/)).not.toHaveLength(0);
    expect(screen.queryByText("Estimated total")).not.toBeInTheDocument();
  });

  it("saves an item for later and lists it separately", async () => {
    signIn();
    let savedCalled = false;
    const { calls } = mockFetch([
      ...sessionRoutes([]),
      cartRoute(() => ({ body: cart() })),
      wishIds,
      { method: "GET", path: "/api/v1/buyer/cart/saved-items", respond: () => ({ body: savedCalled ? { items: [{ cartItemId: "ci-1", listingId: L1, sellerId: S1, title: "Gate valve DN100", thumbnailUrl: null, quantity: 4, savedPrice: 100, currentPrice: 110, currency: "AED", stockAvailable: 2, isPurchasable: true, savedAt: "2026-11-03T08:00:00Z" }], totalCount: 1 } : { items: [], totalCount: 0 } }) },
      { method: "POST", path: `/api/v1/buyer/cart/saved-items/${L1}`, respond: () => ((savedCalled = true), { body: cart({ itemCount: 0, sellerGroups: [] }) }) },
    ]);
    page(<CartPage />, "/cart");
    await userEvent.click(await screen.findByRole("button", { name: /Save for later/ }));
    const section = await screen.findByRole("region", { name: "Saved for later" });
    expect(within(section).getByText("Gate valve DN100")).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: /Move to cart/ })).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname.endsWith(`/saved-items/${L1}`))).toBeDefined();
  });
});

describe("Stage 8A.2 guest cart merge", () => {
  const guest = [{ listingId: L1, sellerId: S1, title: "Gate valve DN100", sellerName: "Gulf", unitPrice: 100, currency: "AED", unitSymbol: "pcs", imageUrl: null, quantity: 2, maxQuantity: 10, addedAtUtc: "2026-11-03T07:00:00Z" }];

  it("asks before merging, keeps the device cart after a failure, and retries with the same key and payload", async () => {
    signIn();
    localStorage.setItem("stockout.market.cart", JSON.stringify(guest));
    let attempt = 0;
    const { calls } = mockFetch([
      ...sessionRoutes([]),
      cartRoute(() => ({ body: cart({ itemCount: 0, sellerGroups: [], checkoutReadiness: { canProceed: false, blockers: [] } }) })),
      empty,
      wishIds,
      {
        method: "POST",
        path: "/api/v1/buyer/cart/merge",
        respond: () => (++attempt === 1 ? { status: 409, body: { status: 409, code: "CONCURRENT_REQUEST_IN_FLIGHT" } } : { body: cart() }),
      },
    ]);
    page(
      <>
        <CartPage />
        <MergePrompt />
      </>,
      "/cart",
    );
    const dialog = await screen.findByRole("dialog", { name: "Add your saved items to your cart?" });
    expect(calls.some((c) => c.url.pathname.endsWith("/merge"))).toBe(false); // never automatic
    await userEvent.click(within(dialog).getByRole("button", { name: /Add 1 item to my cart/ }));
    expect(await within(dialog).findByText(/Your items are still saved on this device/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("stockout.market.cart")!)).toHaveLength(1);
    const pending = readPendingMerge()!;
    expect(pending.key).toMatch(/^[A-Za-z0-9._-]{8,100}$/);

    await userEvent.click(within(dialog).getByRole("button", { name: /Add 1 item to my cart/ }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("stockout.market.cart") ?? "[]")).toHaveLength(0));
    const merges = calls.filter((c) => c.url.pathname.endsWith("/merge"));
    expect(merges).toHaveLength(2);
    expect(merges[0]!.headers.get("Idempotency-Key")).toBe(pending.key);
    expect(merges[1]!.headers.get("Idempotency-Key")).toBe(pending.key);
    expect(merges[1]!.body).toEqual(merges[0]!.body);
    expect(merges[0]!.body).toEqual({ items: [{ listingId: L1, sellerId: S1, quantity: 2, addedPrice: 100, addedCurrency: "AED" }] });
    expect(readPendingMerge()).toBeNull();
  });
});

describe("Stage 8A.2 wishlist", () => {
  const snap = { listingId: L2, sellerId: S1, title: "Copper cable", price: 10, currency: "AED", unitSymbol: "m", imageUrl: null, sellerName: "Gulf", place: null };

  it("asks a guest to sign in instead of saving on the device", async () => {
    const { calls } = mockFetch([]);
    renderWithApp([{ path: "/", element: <FavoriteButton listing={snap} /> }, { path: "/login", element: <div>login page</div> }], "/");
    await userEvent.click(screen.getByRole("button", { name: "Save Copper cable to your wishlist" }));
    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname.includes("/wishlist"))).toBe(false);
  });

  it("adds with listing and seller ids, and moves an item to the cart with the id in route and body", async () => {
    signIn();
    let list: unknown[] = [];
    const { calls } = mockFetch([
      ...sessionRoutes([]),
      cartRoute(() => ({ body: cart() })),
      { method: "GET", path: "/api/v1/buyer/wishlist", respond: () => ({ body: { wishlistId: "w", buyerId: "u-1", totalItems: list.length, pageNumber: 1, pageSize: 20, items: list } }) },
      {
        method: "POST",
        path: "/api/v1/buyer/wishlist/items",
        respond: () => ((list = [{ wishlistItemId: "wi", listingId: L2, sellerId: S1, title: "Copper cable", thumbnailUrl: null, currentPrice: 10, currency: "AED", stockAvailable: 500, isPurchasable: true, addedAt: "2026-11-03T08:00:00Z" }]), { body: true }),
      },
      { method: "POST", path: `/api/v1/buyer/wishlist/items/${L2}/move-to-cart`, respond: () => ({ body: { success: true, listingId: L2, cartId: "c-1", quantity: 1 } }) },
    ]);
    page(
      <>
        <FavoriteButton listing={snap} />
        <SavedPage />
      </>,
      "/saved",
    );
    await userEvent.click(await screen.findByRole("button", { name: "Save Copper cable to your wishlist" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.url.pathname.endsWith("/wishlist/items"))?.body).toEqual({ listingId: L2, sellerId: S1 }));
    await userEvent.click(await screen.findByRole("button", { name: /Move to cart/ }));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith("/move-to-cart"))?.body).toEqual({ listingId: L2, quantity: 1 }));
  });
});

describe("Stage 8A.2 mini cart (signed in)", () => {
  it("keeps the quantity stepper and changes the server quantity", async () => {
    const { CartDrawer } = await import("../cart-drawer");
    const { useCart } = await import("@/lib/cart/cart-context");
    const Opener = () => {
      const c = useCart();
      return (
        <button type="button" onClick={() => c.setOpen(true)}>
          open
        </button>
      );
    };
    signIn();
    const { calls } = mockFetch([
      ...sessionRoutes([]),
      cartRoute(() => ({ body: cart({ sellerGroups: [{ sellerId: S1, sellerDisplayName: "Gulf Valves LLC", groupSubtotal: 440, items: [line({ hasSufficientStock: true, stockAvailable: 50 })] }] }) })),
      wishIds,
      { method: "PUT", path: `/api/v1/buyer/cart/items/${L1}`, respond: () => ({ body: cart() }) },
    ]);
    page(
      <>
        <Opener />
        <CartDrawer />
      </>,
      "/x",
    );
    await screen.findByText("open");
    await waitFor(() => expect(calls.some((c) => c.url.pathname === "/api/v1/buyer/cart")).toBe(true));
    await userEvent.click(screen.getByText("open"));
    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText(/Gulf Valves LLC/)).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole("button", { name: "Increase quantity" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ quantity: 5 }));
    expect(within(drawer).getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });
});
