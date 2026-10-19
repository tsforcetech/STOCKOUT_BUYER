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
  publishedVersion: { title: "Steel Filing Cabinet" },
  rowVersion: "rv",
  expiresAtUtc: null,
} as unknown as ListingDetailResponse;

describe("MediaTab without a draft", () => {
  it("shows a live listing's photos read-only from the public listing", async () => {
    mockFetch([
      {
        method: "GET",
        path: "/api/v1/catalog/listings/l-1",
        respond: () => ({
          body: {
            listingId: "l-1",
            galleryImages: [
              { fileAssetId: "f-2", cdnUrl: "/api/v1/files/f-2/download", displayOrder: 2, isPrimary: false },
              { fileAssetId: "f-1", cdnUrl: "/api/v1/files/f-1/download", displayOrder: 1, isPrimary: true },
            ],
          },
        }),
      },
    ]);
    renderWithApp([{ path: "/", element: <MediaTab sellerId="s-1" listing={live} /> }], "/");
    expect(await screen.findByRole("heading", { name: "Photos buyers see" })).toBeInTheDocument();
    expect(screen.getByText("2 photos · view only")).toBeInTheDocument();
    const imgs = screen.getAllByRole("img", { name: /Steel Filing Cabinet photo/ });
    expect(imgs[0]).toHaveAttribute("src", expect.stringContaining("/api/v1/files/f-1/download"));
    expect(screen.getByText("Cover")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upload|add photos/i })).not.toBeInTheDocument();
  });

  it("keeps the note for paused listings (not public, so no photos to fetch)", async () => {
    const { calls } = mockFetch([]);
    renderWithApp([{ path: "/", element: <MediaTab sellerId="s-1" listing={{ ...live, status: "PAUSED" } as ListingDetailResponse} /> }], "/");
    expect(await screen.findByText(/can only be changed on a draft/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname.startsWith("/api/v1/catalog/listings"))).toBe(false);
  });
});
