import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { RootLayout } from "@/app/layouts/root-layout";
import { parsePolicyMarkdown } from "../policy-markdown";
import PolicyPage from "../policy-page";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const summary = (code: string, title: string, over: Record<string, unknown> = {}) => ({
  policyDocumentId: `d-${code}`,
  policyCode: code,
  name: title,
  description: null,
  audience: "ALL",
  isMandatory: true,
  policyRevisionId: `r-${code}`,
  revisionCode: "Rev. 00",
  languageCode: "en",
  effectiveFromUtc: "2026-10-21T00:00:00",
  publishedAtUtc: "2026-10-21T00:00:00",
  status: "PUBLISHED",
  title,
  contentHash: `hash-${code}`,
  ...over,
});
const detail = (code: string, title: string, over: Record<string, unknown> = {}) => ({ ...summary(code, title, over), content: `### ${title}\n\n#### 1. Scope\n\nThese terms apply to **every** user.` });
const ok = (data: unknown) => ({ body: { success: true, data } });
const NO_CHOICE = { cookiePreferenceId: "00000000-0000-0000-0000-000000000000", subjectId: "s", userId: null, necessary: true, functional: false, analytics: false, marketing: false, consentRevision: "Rev. 00", updatedAtUtc: "2026-10-26T00:00:00Z" };
const CHOSEN = { ...NO_CHOICE, cookiePreferenceId: "c-1" };

describe("policy markdown", () => {
  it("groups table rows separated by blank lines and keeps headings and paragraphs", () => {
    const blocks = parsePolicyMarkdown("#### Approval\n\n| Role | Name |\n\n| --- | --- |\n\n| Approved by | M. R. |\n\n| Owner | M. R. |\n\nText **bold** here.");
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "table", "paragraph"]);
    expect(blocks[1]).toMatchObject({ header: ["Role", "Name"], rows: [["Approved by", "M. R."], ["Owner", "M. R."]] });
  });
});

describe("policy reader", () => {
  it("renders the published text with revision, effective date and fingerprint", async () => {
    mockFetch([
      { method: "GET", path: "/api/v1/policies/STK-POL-WEB-001", respond: () => ok(detail("STK-POL-WEB-001", "Platform Terms of Use")) },
      { method: "GET", path: "/api/v1/policies", respond: () => ok([summary("STK-POL-WEB-001", "Platform Terms of Use"), summary("STK-POL-PRV-001", "Privacy Policy")]) },
    ]);
    renderWithApp([{ path: "/legal/:slug", element: <PolicyPage /> }], "/legal/terms");
    expect(await screen.findByRole("heading", { level: 1, name: "Platform Terms of Use" })).toBeInTheDocument();
    expect(screen.getByText("Rev. 00")).toBeInTheDocument();
    expect(screen.getByText(/hash-STK-POL-WEB-001/)).toBeInTheDocument();
    expect(screen.getByText("every").tagName).toBe("STRONG");
    expect(await screen.findByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/legal/privacy");
  });
});

describe("pending policy gate", () => {
  it("blocks until each policy is explicitly accepted, sending the shown revision and hash", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    let pending = [summary("STK-POL-WEB-001", "Platform Terms of Use"), summary("STK-POL-INS-001", "Inspection Terms", { audience: "SELLER" })];
    const accepted: unknown[] = [];
    mockFetch([
      ...sessionRoutes(),
      { method: "GET", path: "/api/v1/policies/me/pending", respond: () => ok(pending) },
      { method: "GET", path: "/api/v1/policies/STK-POL-WEB-001", respond: () => ok(detail("STK-POL-WEB-001", "Platform Terms of Use")) },
      { method: "GET", path: "/api/v1/policies", respond: () => ok([]) },
      { method: "GET", path: "/api/v1/privacy/cookie-preferences", respond: () => ok(CHOSEN) },
      {
        method: "POST",
        path: "/api/v1/policies/me/accept",
        respond: ({ body }) => {
          accepted.push(body);
          pending = pending.filter((p) => p.policyCode !== "STK-POL-WEB-001");
          return ok({ acceptanceId: "a-1" });
        },
      },
    ]);
    const user = userEvent.setup();
    renderWithApp([{ element: <RootLayout />, children: [{ path: "/", element: <div>home</div> }] }], "/");

    const dialog = await screen.findByRole("dialog", { name: /Review and accept/ });
    // Seller-only policy isn't asked of a buyer, so this is the only step.
    expect(within(dialog).queryByText(/of 2/)).not.toBeInTheDocument();
    expect(await within(dialog).findByText(/STK-POL-WEB-001 · Rev\. 00 · Effective/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    const accept = within(dialog).getByRole("button", { name: "Accept and continue" });
    const box = within(dialog).getByRole("checkbox");
    expect(box).not.toBeChecked();
    expect(accept).toBeDisabled();

    await user.click(box);
    await user.click(accept);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(accepted).toEqual([{ policyRevisionId: "r-STK-POL-WEB-001", affirmativeAcceptance: true, contentHash: "hash-STK-POL-WEB-001" }]);
  });

  it("asks for the latest version when the revision was superseded", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    let rev = "Rev. 00";
    mockFetch([
      ...sessionRoutes(),
      { method: "GET", path: "/api/v1/policies/me/pending", respond: () => ok([summary("STK-POL-PRV-001", "Privacy Policy", { revisionCode: rev })]) },
      { method: "GET", path: "/api/v1/policies/STK-POL-PRV-001", respond: () => ok(detail("STK-POL-PRV-001", "Privacy Policy", { revisionCode: rev })) },
      { method: "GET", path: "/api/v1/policies", respond: () => ok([]) },
      { method: "GET", path: "/api/v1/privacy/cookie-preferences", respond: () => ok(CHOSEN) },
      {
        method: "POST",
        path: "/api/v1/policies/me/accept",
        respond: () => {
          rev = "Rev. 01";
          return { status: 409, body: { title: "Conflict", status: 409, code: "STALE_REVISION_SUPERSEDED", detail: "superseded" } };
        },
      },
    ]);
    const user = userEvent.setup();
    renderWithApp([{ element: <RootLayout />, children: [{ path: "/", element: <div>home</div> }] }], "/");
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(/Rev\. 00 · Effective/);
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: "Accept and continue" }));
    expect(await within(dialog).findByText(/recently been updated/)).toBeInTheDocument();
    expect(await within(dialog).findByText(/Rev\. 01 · Effective/)).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox")).not.toBeChecked();
  });
});

describe("cookie consent", () => {
  it("shows the banner to a guest with no saved choice and saves 'reject optional' against the anonymous token", async () => {
    let saved: Record<string, unknown> | null = null;
    mockFetch([
      { method: "POST", path: "/api/v1/auth/token/refresh", respond: () => ({ status: 401, body: {} }) },
      { method: "GET", path: "/api/v1/policies", respond: () => ok([summary("STK-POL-CKE-001", "Cookie Policy", { revisionCode: "Rev. 00" })]) },
      { method: "GET", path: "/api/v1/privacy/cookie-preferences", respond: () => ok(saved ? CHOSEN : NO_CHOICE) },
      {
        method: "PUT",
        path: "/api/v1/privacy/cookie-preferences",
        respond: ({ body }) => {
          saved = body as Record<string, unknown>;
          return ok(CHOSEN);
        },
      },
    ]);
    const user = userEvent.setup();
    renderWithApp([{ element: <RootLayout />, children: [{ path: "/", element: <div>home</div> }] }], "/");
    const banner = await screen.findByRole("region", { name: "Cookie consent" });
    await user.click(within(banner).getByRole("button", { name: "Reject optional" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Cookie consent" })).not.toBeInTheDocument());
    expect(saved).toMatchObject({ functional: false, analytics: false, marketing: false, consentRevision: "Rev. 00" });
    expect(String(saved!.anonymousToken)).toMatch(/^anon:/);
    expect(localStorage.getItem("stk_cookie_token")).toBe(saved!.anonymousToken);
  });

  it("lets a visitor turn on single categories from the settings, never pre-selected", async () => {
    let saved: Record<string, unknown> | null = null;
    mockFetch([
      { method: "POST", path: "/api/v1/auth/token/refresh", respond: () => ({ status: 401, body: {} }) },
      { method: "GET", path: "/api/v1/policies", respond: () => ok([]) },
      { method: "GET", path: "/api/v1/privacy/cookie-preferences", respond: () => ok(NO_CHOICE) },
      { method: "PUT", path: "/api/v1/privacy/cookie-preferences", respond: ({ body }) => ((saved = body as Record<string, unknown>), ok({ ...CHOSEN, analytics: true })) },
    ]);
    const user = userEvent.setup();
    renderWithApp([{ element: <RootLayout />, children: [{ path: "/", element: <div>home</div> }] }], "/");
    await user.click(await screen.findByRole("button", { name: "Customise" }));
    const dialog = await screen.findByRole("dialog", { name: "Cookie settings" });
    const switches = within(dialog).getAllByRole("switch");
    expect(switches[0]).toBeChecked();
    expect(switches[0]).toBeDisabled();
    expect(switches.slice(1).every((s) => s.getAttribute("aria-checked") === "false")).toBe(true);
    await user.click(within(dialog).getByRole("switch", { name: "Analytics" }));
    await user.click(within(dialog).getByRole("button", { name: "Save choices" }));
    await waitFor(() => expect(saved).toMatchObject({ functional: false, analytics: true, marketing: false }));
    expect(saved).not.toHaveProperty("consentRevision");
  });
});
