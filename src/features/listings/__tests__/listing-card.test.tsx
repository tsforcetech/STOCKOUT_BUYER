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
    const group = await screen.findByRole("group", { name: "UPVC Tee 6in quantity in cart" });
    expect(group).toHaveTextContent("1");
    // Quantity changes right on the card (max 2 in stock), and "−" at 1 removes it.
    await userEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(group).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Decrease quantity" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove UPVC Tee 6in from cart" }));
    expect(await screen.findByRole("button", { name: "Add UPVC Tee 6in to cart" })).toBeInTheDocument();
  });

  it("no button when it can't be bought", () => {
    mockFetch([]);
    at(<ListingCard item={item({ isAvailable: false })} />);
    expect(screen.queryByRole("button", { name: /to cart/ })).not.toBeInTheDocument();
  });

  it("shows the AED 10 delivery under the price", () => {
    mockFetch([]);
    at(<ListingCard item={item()} />);
    expect(screen.getByText(/\+ AED\s?10\.00 delivery/)).toBeInTheDocument();
  });
});
