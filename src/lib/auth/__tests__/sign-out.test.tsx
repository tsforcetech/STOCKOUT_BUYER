import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { useAuth } from "../auth-context";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});

function SignOutButton() {
  const { status, signOut } = useAuth();
  return (
    <>
      <p>{status}</p>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </>
  );
}

describe("sign out (B3)", () => {
  it("logs out on the server with the refresh token before clearing the browser session", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    const { calls } = mockFetch([...sessionRoutes(), { method: "POST", path: "/api/v1/auth/logout", respond: () => ({ body: { message: "ok" } }) }]);
    const user = userEvent.setup();
    renderWithApp([{ path: "/", element: <SignOutButton /> }], "/");
    expect(await screen.findByText("authenticated")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    const logout = calls.find((c) => c.url.pathname === "/api/v1/auth/logout");
    expect(logout?.body).toEqual({ refreshToken: "rt-2" });
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("falls back to revoking the session id when /auth/logout fails, and says so if nothing worked", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    const { calls } = mockFetch([
      ...sessionRoutes(),
      { method: "POST", path: "/api/v1/auth/logout", respond: () => ({ status: 400, body: { detail: "token does not belong" } }) },
      { method: "DELETE", path: "/api/v1/auth/sessions/sid-1", respond: () => ({ status: 404, body: {} }) },
    ]);
    const user = userEvent.setup();
    renderWithApp([{ path: "/", element: <SignOutButton /> }], "/");
    await screen.findByText("authenticated");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    expect(calls.some((c) => c.method === "DELETE" && c.url.pathname === "/api/v1/auth/sessions/sid-1")).toBe(true);
    expect(await screen.findByText(/couldn't confirm the session was ended/)).toBeInTheDocument();
  });
});
