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

/** Handoff 26 Nov §5: order notifications open the order (buyer) or the seller's part (seller). */
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BY_ENTITY_ID: Record<string, (id: string) => string> = {
  ORDER: (id) => `/account/orders/${id}`,
  SUB_ORDER: (id) => `/seller/orders/${id}`,
  SUBORDER: (id) => `/seller/orders/${id}`,
};

/** The server's canonical targets (handoff §5) mapped to this site's routes; admin targets don't exist here. */
const SITE_PATHS: Array<[RegExp, string]> = [
  [/^\/buyer\/orders\//, "/account/orders/"],
  [/^\/buyer\/verification(?=$|[/?#])/, "/account/verification"],
  [/^\/buyer\/saved-searches(?=$|[/?#])/, "/account/saved-searches"],
];
function toSitePath(path: string | null): string | null {
  if (!path) return null;
  if (/^\/admin(\/|$)/.test(path)) return null;
  for (const [re, to] of SITE_PATHS) if (re.test(path)) return path.replace(re, to);
  return path;
}

export function notificationHref(n: Pick<UserNotificationDto, "navigationTarget" | "relatedEntityType"> & { relatedEntityId?: string | null }): string | null {
  const own = toSitePath(safeInternalPath(n.navigationTarget));
  if (own) return own;
  const type = n.relatedEntityType?.toUpperCase() ?? "";
  if (n.relatedEntityId && GUID.test(n.relatedEntityId) && BY_ENTITY_ID[type]) return BY_ENTITY_ID[type](n.relatedEntityId);
  return BY_ENTITY[type] ?? null;
}

/** Bell badge text: hidden at zero, capped at 99+. */
export const badgeText = (n: number | null | undefined) => (!n || n <= 0 ? null : n > 99 ? "99+" : String(n));
