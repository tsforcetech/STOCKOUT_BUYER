import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithApp } from "@/test/render";
import { mockFetch } from "@/test/http";
import HomePage from "../home-page";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("home: location and delivery wording (UX audit 22 Nov)", () => {
  it("starts on All UAE, says delivery (not collection), and remembers an explicit choice", async () => {
    const { calls } = mockFetch([{ method: "GET", path: /.*/, respond: () => ({ body: { items: [], totalCount: 0, page: 1, pageSize: 12 } }) }]);
    renderWithApp([{ path: "/", element: <HomePage /> }], "/");
    const location = await screen.findByRole("combobox", { name: "Location" });
    expect(location).toHaveTextContent("All UAE");
    expect(screen.getByText("Delivered to your site across the UAE")).toBeInTheDocument();
    expect(screen.queryByText(/Collect from a seller|collect today/)).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.searchParams.get("stateOrEmirate") === "Dubai")).toBe(false);
  });

  it("keeps a buyer's saved emirate", async () => {
    localStorage.setItem("stockout.market.emirate", "Sharjah");
    mockFetch([{ method: "GET", path: /.*/, respond: () => ({ body: { items: [], totalCount: 0, page: 1, pageSize: 12 } }) }]);
    renderWithApp([{ path: "/", element: <HomePage /> }], "/");
    expect(await screen.findByRole("combobox", { name: "Location" })).toHaveTextContent("Sharjah");
  });
});
