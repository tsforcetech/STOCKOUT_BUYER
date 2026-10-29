import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import type { ListingDetailResponse } from "@/api/types/seller-listings";
import { AddToCart, type AddToCartListing } from "@/features/cart/add-to-cart";
import { WorkspaceHeader } from "../workspace-header";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const draft = {
  listingId: "l-1",
  sellerId: "s-1",
  status: "DRAFT",
  currentDraftVersionId: "v-1",
  currentDraftVersion: { versionNumber: 1, title: "Gate valve", categoryId: "c-1" },
  publishedVersionId: null,
  publishedVersion: null,
  rowVersion: "rv",
  expiresAtUtc: null,
} as unknown as ListingDetailResponse;

const listRoute = (versionStatus: string) => ({
  method: "GET",
  path: "/api/v1/marketplace/sellers/s-1/listings",
  respond: () => ({ body: { items: [{ listingId: "l-1", status: "DRAFT", currentDraftVersionId: "v-1", currentDraftVersionStatus: versionStatus, title: "Gate valve" }], totalCount: 1 } }),
});

describe("seller listing workspace status", () => {
  it("shows a submitted draft as In review and hides Submit for review", async () => {
    mockFetch([listRoute("UNDER_REVIEW"), { method: "GET", path: /listing-requirements$/, respond: () => ({ body: { success: true, data: null } }) }]);
    renderWithApp([{ path: "/", element: <WorkspaceHeader sellerId="s-1" listing={draft} moderation={undefined} /> }], "/");
    expect(await screen.findByText("In review")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit for review/ })).not.toBeInTheDocument();
  });

  it("still offers Submit for review for a plain draft", async () => {
    mockFetch([listRoute("DRAFT"), { method: "GET", path: /listing-requirements$/, respond: () => ({ body: { success: true, data: null } }) }]);
    renderWithApp([{ path: "/", element: <WorkspaceHeader sellerId="s-1" listing={draft} moderation={undefined} /> }], "/");
    expect(await screen.findByRole("button", { name: /Submit for review/ })).toBeInTheDocument();
  });
});

describe("add to cart", () => {
  const listing: AddToCartListing = { listingId: "l-9", sellerId: "S-OWN", title: "Cement", sellerName: "SO-1", basePrice: 10, currency: "AED", unitSymbol: "bag", imageUrl: null, sellableQuantity: 5, isAvailable: true };

  it("doesn't let a seller put its own listing in the cart", async () => {
    localStorage.setItem("stockout.market.rt", "rt-1");
    mockFetch(sessionRoutes([{ sellerId: "s-own", sellerType: "BUSINESS", displayName: "Me", status: "ACTIVE", verificationStatus: "VERIFIED", onboardingStatus: "COMPLETED", isOwner: true }]));
    renderWithApp([{ path: "/", element: <AddToCart listing={listing} /> }], "/");
    expect(await screen.findByText(/This is your own listing/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add to cart/ })).not.toBeInTheDocument();
  });

  it("offers Add to cart on other sellers' listings", async () => {
    mockFetch([]);
    renderWithApp([{ path: "/", element: <AddToCart listing={listing} /> }], "/");
    expect(await screen.findByRole("button", { name: /Add to cart/ })).toBeInTheDocument();
  });
});
