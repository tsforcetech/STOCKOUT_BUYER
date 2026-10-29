import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
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

describe("edit a published listing (L22)", () => {
  const live = {
    ...draft,
    status: "PUBLISHED",
    currentDraftVersionId: null,
    currentDraftVersion: null,
    publishedVersionId: "v-1",
    publishedVersion: { versionNumber: 1, title: "Gate valve", categoryId: "c-1" },
  } as unknown as ListingDetailResponse;
  const publishedList = (draftId: string | null, versionStatus: string | null) => ({
    method: "GET",
    path: "/api/v1/marketplace/sellers/s-1/listings",
    respond: () => ({ body: { items: [{ listingId: "l-1", status: "PUBLISHED", currentDraftVersionId: draftId, currentDraftVersionStatus: versionStatus, title: "Gate valve" }], totalCount: 1 } }),
  });

  it("creates a revision draft from a live listing", async () => {
    const calls: string[] = [];
    mockFetch([
      publishedList(null, null),
      { method: "POST", path: "/api/v1/marketplace/sellers/s-1/listings/l-1/revision", respond: () => { calls.push("revision"); return { body: { listingId: "l-1", listingVersionId: "v-2", versionNumber: 2, publishedVersionId: "v-1", rowVersion: "rv2" } }; } },
    ]);
    renderWithApp([{ path: "/", element: <WorkspaceHeader sellerId="s-1" listing={live} moderation={undefined} /> }], "/");
    expect(screen.getByText("This listing is live")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit for review/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Edit listing/ }));
    expect(await screen.findByText(/live listing stays unchanged/)).toBeInTheDocument();
    expect(calls).toEqual(["revision"]);
  });

  it("explains when an update is already in progress", async () => {
    mockFetch([
      publishedList(null, null),
      { method: "POST", path: /\/revision$/, respond: () => ({ status: 409, body: { success: false, error: { code: "MARKETPLACE_LISTING_TRANSITION_INVALID", message: "x" } } }) },
    ]);
    renderWithApp([{ path: "/", element: <WorkspaceHeader sellerId="s-1" listing={live} moderation={undefined} /> }], "/");
    fireEvent.click(screen.getByRole("button", { name: /Edit listing/ }));
    expect(await screen.findByText(/already has an update in progress/)).toBeInTheDocument();
  });

  it("treats a draft on a live listing as an editable update", async () => {
    const withDraft = { ...live, currentDraftVersionId: "v-2", currentDraftVersion: { versionNumber: 2, title: "Gate valve v2", categoryId: "c-1" } } as unknown as ListingDetailResponse;
    mockFetch([publishedList("v-2", "DRAFT"), { method: "GET", path: /listing-requirements$/, respond: () => ({ body: { success: true, data: null } }) }]);
    // moderation-status still carries v1's approval for the new draft; it must not read as "approved".
    const stale = { listingId: "l-1", listingVersionId: "v-2", status: "DRAFT", reviewedAtUtc: "2026-10-29T12:08:24", decision: "APPROVE", reasonCode: null, sellerNotes: null } as const;
    renderWithApp([{ path: "/", element: <WorkspaceHeader sellerId="s-1" listing={withDraft} moderation={stale} /> }], "/");
    expect(await screen.findByText("You're editing an update to a live listing")).toBeInTheDocument();
    expect(screen.queryByText(/waiting to be published/)).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Submit for review/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit listing/ })).not.toBeInTheDocument();
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
