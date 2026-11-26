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

/** An id that is safe to put in one path segment. */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const safeId = (v: string | null | undefined) => (v && SAFE_ID.test(v) ? v : null);

/**
 * Backend canonical paths (/buyer/..., /seller/...; handoff 26 Nov 2026 §5) mapped to this app's routes. Admin and
 * Finance paths don't exist in the marketplace, so they map to nothing (the item stays in the inbox).
 */
function toAppPath(path: string): string | null {
  const [pathname] = path.split(/[?#]/);
  const seg = pathname.split("/").filter(Boolean);
  const [area, section, id] = seg;
  if (area === "buyer") {
    if (section === "orders") return id && safeId(id) ? `/account/orders/${id}` : "/account/orders";
    if (section === "verification") return "/account/verification";
    if (section === "saved-searches") return "/account/saved-searches";
    return null;
  }
  if (area === "seller" && section === "orders") return id && safeId(id) ? `/seller/orders/${id}` : "/seller/orders";
  if (area === "notifications") return "/account/notifications";
  if (area === "admin") return null;
  return path;
}

/** Role-aware route from (notificationType, relatedEntityType, relatedEntityId). */
function entityPath(n: Partial<Pick<UserNotificationDto, "notificationType" | "relatedEntityType" | "relatedEntityId">>): string | null {
  const type = (n.notificationType ?? "").toUpperCase();
  const entity = (n.relatedEntityType ?? "").toUpperCase();
  const id = safeId(n.relatedEntityId);
  const staff = type.startsWith("ADMIN_") || type.startsWith("FINANCE_");
  switch (entity) {
    case "ORDER":
      return staff ? null : id ? `/account/orders/${id}` : "/account/orders";
    case "SUB_ORDER":
      return type.startsWith("SELLER_") ? (id ? `/seller/orders/${id}` : "/seller/orders") : null;
    case "BUYER_VERIFICATION":
      return "/account/verification";
    case "SAVED_SEARCH":
      return "/account/saved-searches";
    default:
      // CLAIM / ESCALATION are admin screens; unknown types stay in the inbox.
      return null;
  }
}

export function notificationHref(
  n: Pick<UserNotificationDto, "navigationTarget" | "relatedEntityType"> & Partial<Pick<UserNotificationDto, "notificationType" | "relatedEntityId">>,
): string | null {
  const target = safeInternalPath(n.navigationTarget);
  return (target ? toAppPath(target) : null) ?? entityPath(n);
}

/** Bell badge text: hidden at zero, capped at 99+. */
export const badgeText = (n: number | null | undefined) => (!n || n <= 0 ? null : n > 99 ? "99+" : String(n));
