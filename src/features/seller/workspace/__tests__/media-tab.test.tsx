import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithApp } from "@/test/render";
import { mockFetch } from "@/test/http";
import type { ListingDetailResponse } from "@/api/types/seller-listings";
import { MediaTab } from "../media-tab";

afterEach(() => vi.unstubAllGlobals());

const live = {
  listingId: "l-1",
  status: "PUBLISHED",
  currentDraftVersionId: null,
  currentDraftVersion: null,
  publishedVersionId: "v-pub",
  publishedVersion: { title: "Steel Filing Cabinet" },
  rowVersion: "rv",
  expiresAtUtc: null,
} as unknown as ListingDetailResponse;

const mediaRoute = {
  method: "GET",
  path: "/api/v1/marketplace/sellers/s-1/listings/l-1/media",
  respond: () => ({
    body: {
      listingId: "l-1",
      listingVersionId: "v-pub",
      rowVersion: "rv",
      media: [
        { listingVersionMediaId: "m-2", fileAssetId: "f-2", mediaType: "IMAGE", displayOrder: 2, isPrimary: false, documentType: null },
        { listingVersionMediaId: "m-1", fileAssetId: "f-1", mediaType: "IMAGE", displayOrder: 1, isPrimary: true, documentType: null },
        { listingVersionMediaId: "m-3", fileAssetId: "f-3", mediaType: "DOCUMENT", displayOrder: 1, isPrimary: false, documentType: "Test certificate" },
      ],
    },
  }),
};

describe("MediaTab without a draft", () => {
  it("shows the published version's photos and documents read-only from the seller media endpoint", async () => {
    const { calls } = mockFetch([mediaRoute]);
    renderWithApp([{ path: "/", element: <MediaTab sellerId="s-1" listing={live} /> }], "/");
    expect(await screen.findByRole("heading", { name: /Photos/ })).toBeInTheDocument();
    expect(screen.getByText("(2/10)")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Test certificate")).toBeInTheDocument();
    expect(screen.getByText(/can only be changed on a draft/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove|Make primary|Move/ })).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname.startsWith("/api/v1/catalog/listings"))).toBe(false);
  });

  it("also shows media for paused listings", async () => {
    mockFetch([mediaRoute]);
    renderWithApp([{ path: "/", element: <MediaTab sellerId="s-1" listing={{ ...live, status: "PAUSED" } as unknown as ListingDetailResponse} /> }], "/");
    expect(await screen.findByText("(2/10)")).toBeInTheDocument();
    expect(screen.getByText(/can only be changed on a draft/)).toBeInTheDocument();
  });

  it("doesn't call the endpoint when the listing has no version at all", async () => {
    const { calls } = mockFetch([]);
    renderWithApp([{ path: "/", element: <MediaTab sellerId="s-1" listing={{ ...live, publishedVersionId: null } as unknown as ListingDetailResponse} /> }], "/");
    expect(await screen.findByText(/no photos or documents yet/)).toBeInTheDocument();
    expect(calls.length).toBe(0);
  });
});
