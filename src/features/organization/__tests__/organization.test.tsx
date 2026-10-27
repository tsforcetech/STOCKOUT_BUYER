import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { RequireSeller } from "@/features/seller/require-seller";
import TeamPage from "../team-page";
import BusinessChangesPage from "../business-changes-page";
import InvitationPage from "../invitation-page";
import { BuyerEligibilityNote } from "@/features/cart/components/buyer-eligibility";
import { RequireAuth } from "@/lib/auth/guards";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const ORG = "3934b874-33be-474d-9e12-247a0290c77e";
const ok = (data: unknown) => ({ body: { success: true, data } });
const seller = { sellerId: ORG, sellerType: "BUSINESS", displayName: "Sharaco", status: "ACTIVE", verificationStatus: "VERIFIED", onboardingStatus: "COMPLETED", isOwner: true };
const member = (over: Record<string, unknown>) => ({
  memberId: "m-1",
  organizationId: ORG,
  userId: "u-1",
  email: "owner@sharaco.test",
  displayName: "Owner",
  roleCode: "Owner",
  membershipStatus: "ACTIVE",
  isOwner: true,
  joinedAtUtc: "2026-10-01T00:00:00",
  updatedAtUtc: null,
  rowVersion: "AAAAAAAAAAE=",
  ...over,
});
const allPerms = ["organization.members.view", "organization.members.invite", "organization.members.manage", "organization.members.remove", "organization.business_changes.submit"];
const sellerRoutes = (extra: unknown[]) => [
  ...sessionRoutes([seller]),
  { method: "GET", path: `/api/v1/organizations/${ORG}/my-permissions`, respond: () => ok({ organizationId: ORG, roleCode: "Owner", membershipStatus: "ACTIVE", isOwner: true, permissions: allPerms }) },
  ...(extra as never[]),
];
const portal = (path: string, el: React.ReactNode) => [
  { element: <RequireAuth />, children: [{ path: "/seller", element: <RequireSeller />, children: [{ path: path, element: el }] }] },
  { path: "/login", element: <div>login</div> },
];

describe("Team page", () => {
  it("protects the last owner and rows without a member id, and invites with the chosen role", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    let invited: unknown = null;
    mockFetch(
      sellerRoutes([
        {
          method: "GET",
          path: `/api/v1/organizations/${ORG}/members`,
          respond: () =>
            ok([
              member({}),
              member({ memberId: "00000000-0000-0000-0000-000000000000", userId: "u-2", email: "ghost@x.test", displayName: "Ghost", roleCode: "Staff", isOwner: false }),
              member({ memberId: "m-3", userId: "u-3", email: "staff@x.test", displayName: "Staffer", roleCode: "Staff", isOwner: false }),
            ]),
        },
        { method: "POST", path: `/api/v1/organizations/${ORG}/invitations`, respond: ({ body }: { body: unknown }) => ((invited = body), ok({ invitationId: "i-1" })) },
        { method: "GET", path: `/api/v1/organizations/${ORG}/invitations`, respond: () => ok([]) },
      ]),
    );
    const user = userEvent.setup();
    renderWithApp(portal("team", <TeamPage />), "/seller/team");
    const list = await screen.findByRole("list", { name: "Members" });
    const ghost = within(list).getByText("Ghost").closest("li")!;
    expect(within(ghost as HTMLElement).getByRole("button", { name: "Remove" })).toBeDisabled();
    const staffer = within(list).getByText("Staffer").closest("li")!;
    expect(within(staffer as HTMLElement).getByRole("button", { name: "Remove" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /Invite member/ }));
    const dialog = await screen.findByRole("dialog", { name: "Invite member" });
    await user.type(within(dialog).getByLabelText(/Email/), "new@x.test");
    await user.click(within(dialog).getByRole("button", { name: /Send invitation/ }));
    await waitFor(() => expect(invited).toEqual({ email: "new@x.test", roleCode: "Staff" }));
  });
});

describe("Business changes", () => {
  it("creates a draft with the category's keys and shows the UAE calendar error in plain words", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    const bodies: unknown[] = [];
    mockFetch(
      sellerRoutes([
        { method: "GET", path: `/api/v1/organizations/${ORG}/business-changes`, respond: () => ok([]) },
        {
          method: "POST",
          path: `/api/v1/organizations/${ORG}/business-changes`,
          respond: ({ body }: { body: unknown }) => (bodies.push(body), { status: 422, body: { status: 422, title: "Validation", code: "UAE_CALENDAR_COVERAGE_MISSING", detail: "missing 2035" } }),
        },
      ]),
    );
    const user = userEvent.setup();
    renderWithApp(portal("business-changes", <BusinessChangesPage />), "/seller/business-changes");
    await user.click(await screen.findByRole("button", { name: /Report a change/ }));
    const dialog = await screen.findByRole("dialog", { name: "Report a business change" });
    await user.click(within(dialog).getByRole("combobox", { name: /What changed/ }));
    await user.click(await screen.findByRole("option", { name: "Bank account" }));
    await user.type(within(dialog).getByLabelText(/^IBAN/), "AE070331234567890123456");
    await user.type(within(dialog).getByLabelText(/Bank$/), "ADCB");
    await user.type(within(dialog).getByLabelText(/Effective date/), "2026-10-24");
    await user.type(within(dialog).getByLabelText(/Reason/), "Moved our main account to ADCB");
    await user.click(within(dialog).getByRole("button", { name: "Save draft" }));
    expect(await within(dialog).findByText(/haven't been confirmed for that period/)).toBeInTheDocument();
    expect(bodies[0]).toEqual({
      changeCategory: "BANK_ACCOUNT",
      reason: "Moved our main account to ADCB",
      effectiveDate: "2026-10-24T00:00:00Z",
      proposedValues: { bankName: "ADCB", bankIban: "AE070331234567890123456" },
    });
  });
});

describe("Invitation landing", () => {
  it("previews anonymously and asks the visitor to sign in before accepting", async () => {
    const { calls } = mockFetch([
      { method: "POST", path: "/api/v1/auth/token/refresh", respond: () => ({ status: 401, body: {} }) },
      {
        method: "GET",
        path: "/api/v1/organization-invitations/tok-123/preview",
        respond: () => ok({ invitationId: "i-1", organizationId: ORG, organizationName: "Sharaco", roleCode: "Manager", status: "INVITED", expiresAtUtc: "2099-01-01T00:00:00Z", maskedEmail: "n***t@x.test" }),
      },
    ]);
    renderWithApp([{ path: "/invitations/:token", element: <InvitationPage /> }], "/invitations/tok-123");
    expect(await screen.findByRole("heading", { name: "Join Sharaco" })).toBeInTheDocument();
    expect(screen.getByText("n***t@x.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in or register to accept" })).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname.includes("/preview"))!.headers.get("authorization")).toBeNull();
  });
});

describe("Buyer eligibility (BK-1)", () => {
  it("never shows buying as allowed when the check is unavailable", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    mockFetch([
      ...sessionRoutes(),
      {
        method: "GET",
        path: "/api/v1/marketplace/buyer/eligibility",
        respond: () => ok({ buyerId: "00000000-0000-0000-0000-000000000000", eligible: false, verificationStatus: "UNAVAILABLE", canPurchase: false, reason: "config missing" }),
      },
    ]);
    renderWithApp([{ path: "/", element: <BuyerEligibilityNote /> }], "/");
    expect(await screen.findByText(/couldn't confirm your buying access/)).toBeInTheDocument();
  });

  it("confirms an active user can buy without company verification", async () => {
    sessionStorage.setItem("stockout.market.rt", "rt-1");
    mockFetch([
      ...sessionRoutes(),
      { method: "GET", path: "/api/v1/marketplace/buyer/eligibility", respond: () => ok({ buyerId: "b", eligible: true, verificationStatus: "NOT_REQUIRED", canPurchase: true, reason: null }) },
    ]);
    renderWithApp([{ path: "/", element: <BuyerEligibilityNote /> }], "/");
    expect(await screen.findByText(/no company verification needed/)).toBeInTheDocument();
  });
});
