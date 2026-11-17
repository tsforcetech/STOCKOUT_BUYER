import type { UserNotificationDto } from "@/api/types/notifications";

/**
 * Where a notification opens. navigationTarget is only trusted when it is a plain relative in-app path (one leading
 * "/", no scheme, no "//", no backslash, no control characters); otherwise the related entity decides; otherwise null
 * (the inbox stays put). Absolute or protocol-relative URLs from a payload are never followed.
 */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || [...v].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) || /^\/[^/?#]*:/.test(v) || v.length > 500) return null;
  return v;
}

const BY_ENTITY: Record<string, string> = {
  SAVED_SEARCH: "/account/saved-searches",
  BUYER_VERIFICATION: "/account/verification",
};

export function notificationHref(n: Pick<UserNotificationDto, "navigationTarget" | "relatedEntityType">): string | null {
  return safeInternalPath(n.navigationTarget) ?? (n.relatedEntityType ? (BY_ENTITY[n.relatedEntityType.toUpperCase()] ?? null) : null);
}

/** Bell badge text: hidden at zero, capped at 99+. */
export const badgeText = (n: number | null | undefined) => (!n || n <= 0 ? null : n > 99 ? "99+" : String(n));
