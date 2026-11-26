import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithApp } from "@/test/render";
import { mockFetch } from "@/test/http";
import OrderConfirmationPage, { deliveryAddressLines } from "../order-confirmation-page";

afterEach(() => vi.unstubAllGlobals());

const ID = "0d000000-0000-4000-8000-000000000003";
const address = JSON.stringify({ Label: "New", ContactName: "Site desk", ContactPhone: "+971501234567", Street: "27a Street", Area: "Al Muteena", City: "Dubai", StateOrEmirate: "Dubai" });
const order = {
  orderId: ID, orderNumber: "SO-10000003", buyerUserId: "u", buyerOrganizationId: null, orderDateUtc: "2026-11-26T15:01:00Z", currency: "AED",
  aggregateMaterialAmount: 5704.63, applicableMaterialVat: 285.23, deliveryAmount: 9.52, deliveryVatAmount: 0.48, totalPayableAmount: 5999.86,
  deliveryAddressSnapshotJson: address, status: "PENDING_CONFIRMATION", paymentStatus: "AUTHORIZED", paymentReference: null, statusHistory: [],
  subOrders: [
    { subOrderId: "s1", subOrderNumber: "SO-10000003-S1", sellerTradingName: "Marketplace Seller", sellerLegalName: null, subOrderTotal: 4.86, confirmationDeadlineUtc: "2026-11-27T15:01:00Z", items: [{ orderLineId: "l1" }, { orderLineId: "l2" }] },
    { subOrderId: "s2", subOrderNumber: "SO-10000003-S2", sellerTradingName: "XYZ Company Dubai", sellerLegalName: null, subOrderTotal: 5985, confirmationDeadlineUtc: "2026-11-27T15:01:00Z", items: [{ orderLineId: "l3" }] },
  ],
};

describe("order confirmation page", () => {
  it("shows a clear thank-you with the order, the hold, next steps, sellers, freight and the address", async () => {
    mockFetch([{ method: "GET", path: `/api/v1/buyer/orders/${ID}`, respond: () => ({ body: order }) }]);
    renderWithApp([{ path: "/checkout/complete/:orderId", element: <OrderConfirmationPage /> }], `/checkout/complete/${ID}`);
    expect(screen.getByRole("heading", { name: "Thank you, your order is placed" })).toBeInTheDocument();
    expect(await screen.findByText("SO-10000003")).toBeInTheDocument();
    expect(screen.getByText(/3 items from 2 sellers/)).toBeInTheDocument();
    expect(screen.getByText(/AED\s?5,999\.86 on hold on your card/)).toBeInTheDocument();
    expect(screen.getByText("What happens next")).toBeInTheDocument();
    expect(screen.getByText("XYZ Company Dubai")).toBeInTheDocument();
    expect(screen.getByText("Freight delivery")).toBeInTheDocument();
    expect(screen.getByText("Al Muteena, Dubai")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View order" })).toHaveAttribute("href", `/account/orders/${ID}`);
    expect(screen.getByRole("link", { name: "Continue shopping" })).toHaveAttribute("href", "/");
  });

  it("still confirms the order and links to it when details can't load", async () => {
    mockFetch([{ method: "GET", path: `/api/v1/buyer/orders/${ID}`, respond: () => ({ status: 503, body: {} }) }]);
    renderWithApp([{ path: "/checkout/complete/:orderId", element: <OrderConfirmationPage /> }], `/checkout/complete/${ID}`);
    expect(await screen.findByText(/Your order is placed\. We couldn't load its details/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View order" })).toHaveAttribute("href", `/account/orders/${ID}`);
  });

  it("reads the address snapshot in either casing and ignores bad JSON", () => {
    expect(deliveryAddressLines(address)?.lines).toEqual(["New", "27a Street", "Al Muteena, Dubai"]);
    expect(deliveryAddressLines('{"label":"Site","area":"Al Quoz","city":"Dubai"}')?.lines).toEqual(["Site", "Al Quoz, Dubai"]);
    expect(deliveryAddressLines("not json")).toBeNull();
    expect(deliveryAddressLines(null)).toBeNull();
  });
});
