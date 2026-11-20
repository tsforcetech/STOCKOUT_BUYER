import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApp } from "@/test/render";
import { IMPACT_MESSAGES, ImpactBanner } from "../impact-banner";

afterEach(() => sessionStorage.clear());
const at = (el: React.ReactNode) => renderWithApp([{ path: "/x", element: el }], "/x");

describe("sustainability banner", () => {
  it("shows one message with its action, and stays closed for the visit once closed", async () => {
    const m = IMPACT_MESSAGES[0];
    const { unmount } = at(<ImpactBanner message={m} />);
    expect(screen.getByRole("heading", { name: m.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(m.cta) })).toHaveAttribute("href", m.to);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("heading", { name: m.title })).not.toBeInTheDocument();
    unmount();
    at(<ImpactBanner message={m} />);
    expect(screen.queryByRole("heading", { name: m.title })).not.toBeInTheDocument();
  });

  it("never makes claims the product can't back", () => {
    const text = IMPACT_MESSAGES.map((m) => `${m.title} ${m.body}`).join(" ");
    expect(text).not.toMatch(/carbon neutral|zero (emission|waste)|certified|net zero|\d+\s*%/i);
  });
});
