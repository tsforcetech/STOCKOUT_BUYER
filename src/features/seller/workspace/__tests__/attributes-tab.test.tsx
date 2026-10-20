import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithApp } from "@/test/render";
import { mockFetch } from "@/test/http";
import type { ListingDetailResponse } from "@/api/types/seller-listings";
import { AttributesTab } from "../attributes-tab";

afterEach(() => vi.unstubAllGlobals());

const live = {
  listingId: "l-1",
  status: "PUBLISHED",
  currentDraftVersionId: null,
  currentDraftVersion: null,
  publishedVersion: { title: "Steel Filing Cabinet" },
  rowVersion: "rv",
  expiresAtUtc: null,
} as unknown as ListingDetailResponse;

describe("AttributesTab without a draft", () => {
  it("shows a live listing's attributes read-only from the public listing", async () => {
    const { calls } = mockFetch([
      {
        method: "GET",
        path: "/api/v1/catalog/listings/l-1",
        respond: () => ({
          body: {
            listingId: "l-1",
            attributes: [
              { code: "material", name: "Material", textValue: "Carbon Steel", numValue: null },
              { code: "thickness_mm", name: "Thickness (mm)", textValue: null, numValue: 6 },
            ],
          },
        }),
      },
    ]);
    renderWithApp([{ path: "/", element: <AttributesTab sellerId="s-1" listing={live} /> }], "/");
    expect(await screen.findByRole("heading", { name: "Attributes buyers see" })).toBeInTheDocument();
    expect(screen.getByText("2 attributes · view only")).toBeInTheDocument();
    expect(screen.getByText("Material")).toBeInTheDocument();
    expect(screen.getByText("Carbon Steel")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save attributes/i })).not.toBeInTheDocument();
    // The seller attributes endpoint 409s without a draft, so it must not be called.
    expect(calls.some((c) => c.url.pathname.endsWith("/attributes"))).toBe(false);
  });

  it("keeps the note for paused listings (not public)", async () => {
    const { calls } = mockFetch([]);
    renderWithApp([{ path: "/", element: <AttributesTab sellerId="s-1" listing={{ ...live, status: "PAUSED" } as unknown as ListingDetailResponse} /> }], "/");
    expect(await screen.findByText(/can only be changed on a draft/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname.startsWith("/api/v1/catalog/listings"))).toBe(false);
  });
});
