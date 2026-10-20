import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet } from "react-router";
import { AuthDialogProvider, useAuthDialog } from "../auth-dialog";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const loginOk = { method: "POST", path: "/api/v1/auth/login", respond: () => ({ body: { accessToken: "a.eyJzaWQiOiJzMSJ9.c", refreshToken: "rt", expiresIn: 900, tokenType: "Bearer", mfaRequired: false, mfaChallengeToken: null } }) };

function SavePage() {
  const { requireAuth, openAuth } = useAuthDialog();
  const [saved, setSaved] = React.useState(false);
  return (
    <div>
      <p>Search results</p>
      <button type="button" onClick={() => requireAuth(() => setSaved(true), "Log in to save this search.")}>
        Save search
      </button>
      <button type="button" onClick={() => openAuth({ mode: "register" })}>
        Join
      </button>
      {saved && <p>Search saved</p>}
    </div>
  );
}

const routes = [
  {
    element: (
      <AuthDialogProvider>
        <Outlet />
      </AuthDialogProvider>
    ),
    children: [{ path: "/search", element: <SavePage /> }],
  },
];

describe("sign-in popup", () => {
  it("logs in without leaving the page and finishes the action the visitor started", async () => {
    const { calls } = mockFetch([loginOk, ...sessionRoutes().slice(1)]);
    renderWithApp(routes, "/search");
    await userEvent.click(await screen.findByRole("button", { name: "Save search" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Log in to save this search.")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Email"), "buyer@stockout.test");
    await userEvent.type(within(dialog).getByLabelText("Password"), "correct-horse-battery");
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Search saved")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Search results")).toBeInTheDocument();
    expect(calls[0].body).toEqual({ emailOrMobile: "buyer@stockout.test", password: "correct-horse-battery" });
  });

  it("switches between log in, create account and forgot password inside the popup", async () => {
    const { calls } = mockFetch([{ method: "POST", path: "/api/v1/auth/password/forgot", respond: () => ({ status: 202, body: {} }) }]);
    renderWithApp(routes, "/search");
    await userEvent.click(await screen.findByRole("button", { name: "Join" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Log in" }));
    expect(within(dialog).getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Forgot password?" }));
    await userEvent.type(within(dialog).getByLabelText("Email"), "buyer@stockout.test");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send reset instructions" }));
    expect(await within(dialog).findByText("Check your inbox")).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname.includes("forgot"))).toBe(true);
    await userEvent.click(within(dialog).getByRole("button", { name: "Back to log in" }));
    expect(within(dialog).getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("closing the popup drops the pending action", async () => {
    mockFetch([]);
    renderWithApp(routes, "/search");
    await userEvent.click(await screen.findByRole("button", { name: "Save search" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Search saved")).not.toBeInTheDocument();
  });
});
