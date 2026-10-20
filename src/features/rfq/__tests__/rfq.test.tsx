import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet } from "react-router";
import { RfqProvider } from "../rfq-dialog";
import { RfqBanner } from "../rfq-banner";
import { renderWithApp } from "@/test/render";
import { mockFetch } from "@/test/http";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const tree = { method: "GET", path: "/api/v1/catalog/categories", respond: () => ({ body: { success: true, data: [{ categoryId: "root", slug: "plumbing", parentCategoryId: null, name: "Plumbing & Piping", children: [] }] } }) };

const routes = [
  {
    element: (
      <RfqProvider>
        <Outlet />
      </RfqProvider>
    ),
    children: [
      {
        path: "/search",
        element: <RfqBanner variant="empty" options={{ source: "search-empty", prefill: { item: "brass valve" } }} title="Can't find it?" body="Tell us." />,
      },
    ],
  },
];

describe("RFQ", () => {
  it("opens from a banner with the search pre-filled and keeps a draft, but doesn't pretend to send", async () => {
    const { calls } = mockFetch([tree]);
    renderWithApp(routes, "/search");
    await userEvent.click(await screen.findByRole("button", { name: /Share your RFQ/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/What do you need/)).toHaveValue("brass valve");
    await userEvent.type(within(dialog).getByLabelText("Quantity"), "40");
    expect(JSON.parse(localStorage.getItem("stockout.market.rfq-draft") ?? "{}")).toMatchObject({ item: "brass valve", quantity: "40" });
    expect(within(dialog).getByText(/Sending RFQs opens soon/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Send request/ })).toBeDisabled();
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  });

  it("accepts BOQ files on the upload tab", async () => {
    mockFetch([tree]);
    renderWithApp(routes, "/search");
    await userEvent.click(await screen.findByRole("button", { name: /Share your RFQ/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("tab", { name: /Upload BOQ/ }));
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, new File(["a,b"], "boq.csv", { type: "text/csv" }));
    expect(within(dialog).getByRole("list", { name: "Attached files" })).toHaveTextContent("boq.csv");
  });
});
