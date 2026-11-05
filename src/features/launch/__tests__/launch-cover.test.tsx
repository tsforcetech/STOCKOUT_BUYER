import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { SiteLayout } from "@/app/layouts/site-layout";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const routes = [{ path: "/", element: <SiteLayout />, children: [{ index: true, element: <p>Marketplace home</p> }, { path: "search", element: <p>Search page</p> }] }];

describe("launch-soon cover", () => {
  it("shows the cover on the home page with the contact email, and lets testers into the preview", async () => {
    mockFetch([...sessionRoutes([])]);
    renderWithApp(routes, "/");
    expect(await screen.findByText(/Launching soon/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Get early access/ })).toHaveAttribute("href", expect.stringMatching(/^mailto:info@stockoutme\.com\?subject=/));
    expect(screen.getAllByRole("link", { name: /info@stockoutme\.com/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Marketplace home")).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: /Explore marketplace/ })[0]);
    expect(await screen.findByText("Marketplace home")).toBeInTheDocument();
    expect(localStorage.getItem("stockout.preview")).toBe("1");
  });

  it("only covers the home page: other pages open directly", async () => {
    mockFetch([...sessionRoutes([])]);
    renderWithApp(routes, "/search");
    expect(await screen.findByText("Search page")).toBeInTheDocument();
    expect(screen.queryByText(/Launching soon/)).not.toBeInTheDocument();
  });
});
