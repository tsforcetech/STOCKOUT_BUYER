import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp } from "@/test/render";
import { mockFetch } from "@/test/http";
import { ListingCard } from "../components/listing-card";
import type { ListingSearchCard } from "@/api/types/search";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const item = (over: Partial<ListingSearchCard> = {}) =>
  ({
    listingId: "l-1", publishedVersionId: "v", versionNumber: 1, listingNumber: "LST-1", title: "UPVC Tee 6in", description: null, categoryId: "c", categoryName: "UPVC Pipes & Fittings", categoryBreadcrumb: [],
    brandId: null, brandName: null, conditionId: null, conditionName: null, gradeId: null, gradeName: null, pricingMode: "FIXED_PRICE", basePrice: 71.25, currency: "AED", quantityUnitId: null,
    quantityUnitName: "Pieces", quantityUnitSymbol: "pcs", sellableQuantity: 2, isAvailable: true, expiresAtUtc: null, primaryImage: null,
    seller: { sellerId: "s-1", displayName: "Seller", entityType: "BUSINESS", isVerified: true }, location: { countryCode: "AE", stateOrEmirate: "Sharjah", city: null }, attributes: [], publishedAtUtc: "2026-11-20T10:00:00Z", ...over,
  }) as ListingSearchCard;
const at = (el: React.ReactNode) => renderWithApp([{ path: "/x", element: el }, { path: "/listings/*", element: <p>listing page</p> }], "/x");

describe("listing card: add to cart", () => {
  it("adds straight from the card without opening the listing, then shows it's in the cart", async () => {
    mockFetch([]);
    at(<ListingCard item={item()} />);
    await userEvent.click(screen.getByRole("button", { name: "Add UPVC Tee 6in to cart" }));
    expect(screen.queryByText("listing page")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /1 in your cart, view cart/ }, { timeout: 3000 })).toBeInTheDocument();
  });

  it("no button when it can't be bought", () => {
    mockFetch([]);
    at(<ListingCard item={item({ isAvailable: false })} />);
    expect(screen.queryByRole("button", { name: /to cart/ })).not.toBeInTheDocument();
  });
});
