import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterPage from "../register-page";
import { RedirectIfAuthenticated } from "@/lib/auth/guards";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";

afterEach(() => vi.unstubAllGlobals());

const routes = [
  { element: <RedirectIfAuthenticated />, children: [{ path: "/register", element: <RegisterPage /> }] },
  { path: "/", element: <div>Home</div> },
  { path: "/seller", element: <div>Seller portal</div> },
];

async function fill() {
  await userEvent.type(await screen.findByLabelText(/First name/), "Sami");
  await userEvent.type(screen.getByLabelText(/Last name/), "Seller");
  await userEvent.type(screen.getByLabelText(/^Email/), "Sami@Example.com");
  await userEvent.type(screen.getByLabelText(/Mobile number/), "+971 50 123 4567");
  await userEvent.type(screen.getByLabelText(/^Password/), "a-long-password-1");
  await userEvent.type(screen.getByLabelText(/Confirm password/), "a-long-password-1");
  await userEvent.click(screen.getByRole("checkbox"));
}

describe("RegisterPage", () => {
  it("validates locally before calling the API", async () => {
    const { calls } = mockFetch([]);
    renderWithApp(routes, "/register");
    await userEvent.click(await screen.findByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Enter your first name.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("registers, confirms the emailed code and signs the user in", async () => {
    const { calls } = mockFetch([
      { method: "POST", path: "/api/v1/auth/register", respond: () => ({ status: 201, body: { userId: "u-9", email: "sami@example.com", mobile: "+971501234567", status: "PendingVerification", message: "ok" } }) },
      {
        method: "POST",
        path: "/api/v1/auth/verification/registration/confirm",
        respond: () => ({ body: { accessToken: "a.eyJzaWQiOiJzOSJ9.c", refreshToken: "rt-9", expiresIn: 900, tokenType: "Bearer", userId: "u-9", firstName: "Sami", lastName: "Seller", displayName: "Sami Seller" } }),
      },
      ...sessionRoutes().slice(1),
    ]);
    renderWithApp(routes, "/register?next=%2Fseller");
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(calls.find((c) => c.url.pathname === "/api/v1/auth/register")?.body).toEqual({
      firstName: "Sami",
      lastName: "Seller",
      displayName: "Sami Seller",
      email: "sami@example.com",
      mobile: "+971501234567",
      password: "a-long-password-1",
    });
    await userEvent.type(await screen.findByLabelText("Verification code"), "654321");
    await userEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
    expect(await screen.findByText("Seller portal")).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname.endsWith("/registration/confirm"))?.body).toEqual({ userId: "u-9", channel: "Email", token: "654321" });
    expect(localStorage.getItem("stockout.market.rt")).toBe("rt-9");
  });

  it("names and links each mandatory policy and remembers the exact revisions agreed to", async () => {
    const pol = (code: string, name: string, audience = "ALL") => ({ policyDocumentId: `d-${code}`, policyCode: code, name, description: null, audience, isMandatory: true, policyRevisionId: `r-${code}`, revisionCode: "Rev. 00", languageCode: "en", effectiveFromUtc: "2026-10-21T00:00:00", publishedAtUtc: "2026-10-21T00:00:00", status: "PUBLISHED", title: name, contentHash: `h-${code}` });
    mockFetch([
      { method: "GET", path: "/api/v1/policies", respond: () => ({ body: { success: true, data: [pol("STK-POL-WEB-001", "Platform Terms of Use"), pol("STK-POL-PRV-001", "Privacy Policy"), pol("STK-POL-INS-001", "Inspection Terms", "SELLER")] } }) },
      { method: "POST", path: "/api/v1/auth/register", respond: () => ({ status: 201, body: { userId: "u-9", email: "sami@example.com", mobile: "+971501234567", status: "PendingVerification", message: "ok" } }) },
    ]);
    renderWithApp(routes, "/register");
    expect(await screen.findByRole("link", { name: "Platform Terms of Use" })).toHaveAttribute("href", "/legal/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/legal/privacy");
    expect(screen.queryByRole("link", { name: "Inspection Terms" })).not.toBeInTheDocument();
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByLabelText("Verification code")).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem("stockout.market.signup-consent") ?? "[]") as Array<{ userId: string; revisions: unknown[] }>;
    expect(saved[0].userId).toBe("u-9");
    expect(saved[0].revisions).toEqual([
      { policyCode: "STK-POL-WEB-001", policyRevisionId: "r-STK-POL-WEB-001", contentHash: "h-STK-POL-WEB-001" },
      { policyCode: "STK-POL-PRV-001", policyRevisionId: "r-STK-POL-PRV-001", contentHash: "h-STK-POL-PRV-001" },
    ]);
    localStorage.clear();
  });

  it("shows a field error when the email is already registered", async () => {
    mockFetch([{ method: "POST", path: "/api/v1/auth/register", respond: () => ({ status: 409, body: { title: "Conflict", status: 409, detail: "Email already registered." } }) }]);
    renderWithApp(routes, "/register");
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/An account with this email already exists/)).toBeInTheDocument();
  });
});
