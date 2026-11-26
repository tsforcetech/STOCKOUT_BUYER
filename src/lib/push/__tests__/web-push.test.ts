import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  localStorage.clear();
});

describe("web push", () => {
  it("is unavailable until every public Firebase value is configured", async () => {
    vi.stubEnv("VITE_FIREBASE_API_KEY", "");
    const m = await import("../web-push");
    expect(m.pushConfigured()).toBe(false);
    expect(m.pushState()).toBe("unavailable");
  });
  it("keeps one installation id per browser for logout revocation", async () => {
    const m = await import("../web-push");
    const a = m.installationId();
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(m.installationId()).toBe(a);
  });
  it("logout revokes this browser's installation on the server", async () => {
    const { mockFetch } = await import("@/test/http");
    const { calls } = mockFetch([{ method: "DELETE", path: /\/api\/v1\/notifications\/devices\/installations\/.+/, respond: () => ({ body: { success: true, data: { revokedCount: 1 } } }) }]);
    const m = await import("../web-push");
    const id = m.installationId();
    await m.disablePush();
    expect(calls.some((c) => c.method === "DELETE" && c.url.pathname.endsWith(`/installations/${id}`))).toBe(true);
  });
});
