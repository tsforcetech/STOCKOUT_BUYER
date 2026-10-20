import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { routes } from "@/app/router/router";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { LISTING_VIEWS, listingState } from "../lib/listing";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const SELLER = "11111111-1111-1111-1111-111111111111";
const row = (n: number, status: string, v: string | null) => ({
  listingId: `0000000${n}-0000-0000-0000-00000000000${n}`,
  sellerId: SELLER,
  status,
  currentDraftVersionId: v ? `aaaaaaa${n}-0000-0000-0000-000000000000` : null,
  currentDraftVersionStatus: v,
  publishedVersionId: status === "PUBLISHED" ? `bbbbbbb${n}-0000-0000-0000-000000000000` : null,
  createdAtUtc: "2026-10-20T08:00:00",
  updatedAtUtc: null,
  title: `Listing ${n}`,
  categoryId: "33333333-3333-3333-3333-333333333333",
  requiresPhysicalInspection: false,
});
const items = [row(1, "DRAFT", "DRAFT"), row(2, "DRAFT", "UNDER_REVIEW"), row(3, "DRAFT", "CHANGES_REQUIRED"), row(4, "PUBLISHED", null), row(5, "PUBLISHED", "UNDER_REVIEW"), row(6, "SUSPENDED", null)];

describe("seller listing status views", () => {
  it("matches version states the list API can't filter by", () => {
    const count = (key: string) => items.filter(LISTING_VIEWS.find((v) => v.key === key)!.match as (l: (typeof items)[number]) => boolean).length;
    expect(count("all")).toBe(6);
    expect(count("draft")).toBe(1);
    expect(count("review")).toBe(2);
    expect(count("changes")).toBe(1);
    expect(count("live")).toBe(2);
    expect(count("paused")).toBe(1);
    expect(listingState(items[2] as never).label).toBe("Changes requested");
    expect(listingState(items[4] as never).label).toBe("Live · update in review");
    expect(listingState(items[3] as never).label).toBe("Live");
  });

  it("shows status pills with counts and filters the list", async () => {
    localStorage.setItem("stockout.market.rt", "rt-1");
    localStorage.setItem("stockout.market.sellerListingsView", "list");
    const { calls } = mockFetch([
      ...sessionRoutes([{ sellerId: SELLER, sellerType: "BUSINESS", displayName: "Acme Surplus", status: "ACTIVE", verificationStatus: "VERIFIED", onboardingStatus: "COMPLETED", isOwner: true }]),
      { method: "GET", path: /\/api\/v1\/catalog\/categories$/, respond: () => ({ body: { success: true, data: [] } }) },
      { method: "GET", path: `/api/v1/marketplace/sellers/${SELLER}/listings`, respond: () => ({ body: { items, totalCount: items.length } }) },
    ]);
    renderWithApp(routes, "/seller/listings");
    const pills = await screen.findByRole("tablist", { name: "Listing status" });
    expect(await within(pills).findByRole("tab", { name: /In review 2/ })).toBeInTheDocument();
    expect(within(pills).getByRole("tab", { name: /Changes requested 1/ })).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname.endsWith("/listings"))?.url.searchParams.get("pageSize")).toBe("1000");

    await userEvent.click(within(pills).getByRole("tab", { name: /Changes requested/ }));
    expect(await screen.findByText("Listing 3")).toBeInTheDocument();
    expect(screen.queryByText("Listing 1")).not.toBeInTheDocument();
    expect(screen.getByText(/1 listing match your filters/)).toBeInTheDocument();
  });
});
