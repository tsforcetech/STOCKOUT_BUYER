import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { RequireAuth } from "@/lib/auth/guards";
import NotificationsPage from "../notifications-page";
import { NotificationBell } from "../notification-bell";
import { badgeText, notificationHref, safeInternalPath } from "../notification-target";
import { placementOutcome } from "@/lib/orders/placement-outcome";
import { ApiError } from "@/lib/api/errors";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const signIn = () => {
  sessionStorage.setItem("stockout.market.rt", "rt-1");
  localStorage.setItem("stockout.market.rt", "rt-1");
};
const env = (data: unknown) => ({ body: { success: true, data } });
const n = (id: string, over: object = {}) => ({
  notificationId: id, recipientOrganizationId: null, notificationType: "SEARCH_ALERT_MATCHED", title: `Note ${id}`, message: "2 new listings match your saved search.",
  relatedEntityType: "SAVED_SEARCH", relatedEntityId: "s-1", navigationTarget: null, scope: "PERSONAL", channel: "IN_APP", deliveryStatus: "DELIVERED",
  isRead: false, readAtUtc: null, createdAtUtc: "2026-11-17T08:00:00Z", ...over,
});
const routes = [
  { element: <RequireAuth />, children: [{ path: "/account/notifications", element: <><NotificationBell /><NotificationsPage /></> }, { path: "/account/saved-searches", element: <div>saved searches page</div> }, { path: "/account/orders/o-1", element: <div>order page</div> }] },
  { path: "/login", element: <div>login</div> },
];

describe("notification center", () => {
  it("lists notifications, badges the bell, opens a safe target and marks it read; read-all clears the badge", async () => {
    signIn();
    let unread = 2;
    const read = new Set<string>();
    const { calls } = mockFetch([
      ...sessionRoutes([]),
      { method: "GET", path: "/api/v1/notifications/unread-count", respond: () => env({ unreadCount: unread }) },
      {
        method: "GET",
        path: "/api/v1/notifications",
        respond: () =>
          env({
            items: [n("a1000000-0000-4000-8000-000000000001", { navigationTarget: "https://evil.example/x", isRead: read.has("a1000000-0000-4000-8000-000000000001") }), n("a1000000-0000-4000-8000-000000000002", { scope: "ORGANIZATION", recipientOrganizationId: "o-9", title: "Company update", navigationTarget: "/account/orders/o-1" })],
            page: 1, pageSize: 20, totalCount: 2, unreadCount: unread,
          }),
      },
      { method: "POST", path: /\/api\/v1\/notifications\/[^/]+\/read$/, respond: ({ url }) => (read.add(url.pathname.split("/")[4]), (unread -= 1), env({ notificationId: url.pathname.split("/")[4], isRead: true, wasAlreadyRead: false })) },
      { method: "POST", path: "/api/v1/notifications/read-all", respond: () => ((unread = 0), env({ updatedCount: 1 })) },
    ]);
    renderWithApp(routes, "/account/notifications");
    expect(await screen.findByRole("link", { name: "Notifications, 2 unread" })).toHaveAttribute("href", "/account/notifications");
    const list = await screen.findByRole("list", { name: "Notifications" });
    expect(within(list).getByText("Company")).toBeInTheDocument(); // organization scope is labelled
    // An absolute URL from the payload is never followed: the saved-search screen is used instead.
    await userEvent.click(within(list).getByRole("button", { name: /Unread: Note a1000000-0000-4000-8000-000000000001/ }));
    expect(await screen.findByText("saved searches page")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST" && c.url.pathname.endsWith("/a1000000-0000-4000-8000-000000000001/read"))).toBe(true);
    expect(calls.every((c) => !c.url.search.includes("recipient"))).toBe(true); // never sends a recipient id
  });

  it("mark all as read updates the badge; a failed refresh keeps the list", async () => {
    signIn();
    let unread = 3;
    let fail = false;
    mockFetch([
      ...sessionRoutes([]),
      { method: "GET", path: "/api/v1/notifications/unread-count", respond: () => env({ unreadCount: unread }) },
      { method: "GET", path: "/api/v1/notifications", respond: () => (fail ? { status: 503, body: { error: "SERVICE_UNAVAILABLE", message: "down" } } : env({ items: [n("a1000000-0000-4000-8000-000000000003")], page: 1, pageSize: 20, totalCount: 1, unreadCount: unread })) },
      { method: "POST", path: "/api/v1/notifications/read-all", respond: () => ((unread = 0), (fail = true), env({ updatedCount: 3 })) },
    ]);
    renderWithApp(routes, "/account/notifications");
    expect(await screen.findByRole("link", { name: "Notifications, 3 unread" })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: /Mark all as read/ }));
    await waitFor(() => expect(screen.queryByRole("link", { name: /unread/ })).not.toBeInTheDocument()); // badge hidden at 0
    expect(await screen.findByText(/couldn't refresh your notifications/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Notifications" })).toBeInTheDocument(); // list kept
  });

  it("shows an empty state for no notifications", async () => {
    signIn();
    mockFetch([
      ...sessionRoutes([]),
      { method: "GET", path: "/api/v1/notifications/unread-count", respond: () => env({ unreadCount: 0 }) },
      { method: "GET", path: "/api/v1/notifications", respond: () => env({ items: [], page: 1, pageSize: 20, totalCount: 0, unreadCount: 0 }) },
    ]);
    renderWithApp(routes, "/account/notifications");
    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
  });
});

describe("notification helpers", () => {
  it.each([
    ["/account/orders/1", "/account/orders/1"],
    ["https://evil.example", null],
    ["//evil.example", null],
    ["/\\evil", null],
    ["javascript:alert(1)", null],
    ["/x:y", null],
    ["", null],
  ])("safeInternalPath(%j) → %j", (v, out) => expect(safeInternalPath(v)).toBe(out));

  it("falls back to the related entity, then to nothing", () => {
    expect(notificationHref({ navigationTarget: null, relatedEntityType: "BUYER_VERIFICATION" })).toBe("/account/verification");
    expect(notificationHref({ navigationTarget: null, relatedEntityType: "UNKNOWN" })).toBeNull();
  });

  it("caps the badge at 99+ and hides it at zero", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(7)).toBe("7");
    expect(badgeText(250)).toBe("99+");
  });

  it("treats an uncertain commit as unknown, never as failure", () => {
    const err = (code: string, status: number) => new ApiError({ kind: "server", status, code, message: code, fieldErrors: {} } as never);
    expect(placementOutcome(err("ORDER_COMMIT_UNCERTAIN", 500))).toBe("uncertain");
    expect(placementOutcome(err("ORDER_COMMIT_UNCERTAIN_RECOVERY_ENQUEUE_FAILED", 500))).toBe("uncertain");
    expect(placementOutcome(err("ORDER_PLACEMENT_DISABLED", 503))).toBe("disabled");
    expect(placementOutcome(err("CART_EMPTY", 400))).toBe("failed");
  });
});
