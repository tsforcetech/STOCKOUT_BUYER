import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "../login-page";
import { RedirectIfAuthenticated } from "@/lib/auth/guards";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";

afterEach(() => vi.unstubAllGlobals());

const routes = [
  { element: <RedirectIfAuthenticated />, children: [{ path: "/login", element: <LoginPage /> }] },
  { path: "/", element: <div>Home page</div> },
];

describe("LoginPage", () => {
  it("validates required fields before calling the API", async () => {
    const { fn } = mockFetch([]);
    renderWithApp(routes, "/login");
    await userEvent.click(await screen.findByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Enter your email address.")).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });

  it("maps a 401 to a friendly message and clears the password", async () => {
    mockFetch([{ method: "POST", path: "/api/v1/auth/login", respond: () => ({ status: 401, body: { title: "Authentication Failed", status: 401, detail: "Invalid credentials." } }) }]);
    renderWithApp(routes, "/login");
    await userEvent.type(await screen.findByLabelText("Email"), "admin@stockout.test");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("The email or password is incorrect.")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("signs in and lands on the dashboard", async () => {
    const { calls } = mockFetch([
      { method: "POST", path: "/api/v1/auth/login", respond: () => ({ body: { accessToken: "a.eyJzaWQiOiJzMSJ9.c", refreshToken: "rt", expiresIn: 900, tokenType: "Bearer", mfaRequired: false, mfaChallengeToken: null } }) },
      ...sessionRoutes().slice(1),
    ]);
    renderWithApp(routes, "/login");
    await userEvent.type(await screen.findByLabelText("Email"), "admin@stockout.test");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(calls[0].body).toEqual({ emailOrMobile: "admin@stockout.test", password: "correct-horse-battery" });
  });

  it("runs the emailed-code MFA step when required", async () => {
    const { calls } = mockFetch([
      { method: "POST", path: "/api/v1/auth/login", respond: () => ({ body: { accessToken: "", refreshToken: "", expiresIn: 0, tokenType: "Bearer", mfaRequired: true, mfaChallengeToken: "chal-1", userId: "u-1" } }) },
      { method: "POST", path: "/api/v1/auth/mfa/verify", respond: () => ({ body: { accessToken: "a.eyJzaWQiOiJzMSJ9.c", refreshToken: "rt", expiresIn: 900, tokenType: "Bearer", mfaRequired: false } }) },
      ...sessionRoutes().slice(1),
    ]);
    renderWithApp(routes, "/login");
    await userEvent.type(await screen.findByLabelText("Email"), "admin@stockout.test");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    const code = await screen.findByLabelText("Verification code");
    await userEvent.type(code, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname === "/api/v1/auth/mfa/verify")?.body).toEqual({ userId: "u-1", challengeToken: "chal-1", code: "123456", recoveryCode: null });
  });
});

describe("returning to the seller portal", () => {
  it("has a single login form and returns to the requested page after sign-in", async () => {
    mockFetch([
      { method: "POST", path: "/api/v1/auth/login", respond: () => ({ body: { accessToken: "a.eyJzaWQiOiJzMSJ9.c", refreshToken: "rt", expiresIn: 900, tokenType: "Bearer", mfaRequired: false, mfaChallengeToken: null } }) },
      ...sessionRoutes().slice(1),
    ]);
    renderWithApp([...routes, { path: "/seller", element: <div>Seller portal home</div> }], "/login?next=%2Fseller");
    expect(await screen.findByRole("heading", { name: "Welcome to StockOut" })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Email"), "seller@stockout.test");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Seller portal home")).toBeInTheDocument();
  });
});
