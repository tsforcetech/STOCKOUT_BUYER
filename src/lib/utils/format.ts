const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" });
const numberFormatter = new Intl.NumberFormat();

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && value.startsWith("0001-01-01")) return null;
  // The backend serialises SQL datetimes without an offset; they are UTC by convention.
  const normalised = typeof value === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(value) ? `${value}Z` : value;
  const date = value instanceof Date ? value : new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: string | number | Date | null | undefined, fallback = "—"): string {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : fallback;
}

/** "0001-01-01T00:00:00" (unset .NET DateTime) is treated as missing. */
export function isUnsetDate(value: string | null | undefined): boolean {
  return !value || value.startsWith("0001-01-01");
}

export function formatDate(value: string | number | Date | null | undefined, fallback = "—"): string {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : fallback;
}

export function formatNumber(value: number | null | undefined, fallback = "—"): string {
  return typeof value === "number" && Number.isFinite(value) ? numberFormatter.format(value) : fallback;
}

export function formatMoney(value: number | null | undefined, currency: string | null | undefined, fallback = "—"): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (!currency) return numberFormatter.format(value);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  } catch {
    return `${numberFormatter.format(value)} ${currency}`;
  }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

/** "PENDING_REVIEW" / "pendingReview" → "Pending review". Display only; never used for logic. */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const spaced = value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** "12 min ago", "3 hr ago", "2 days ago" — for backend UTC timestamps. */
export function timeAgo(value: string | null | undefined, now: number = Date.now()): string | null {
  if (!value || value.startsWith("0001-01-01")) return null;
  const iso = /^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(value) ? `${value}Z` : value;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const min = Math.max(0, Math.floor((now - t) / 60000));
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d > 1 ? "s" : ""} ago`;
  return null;
}
