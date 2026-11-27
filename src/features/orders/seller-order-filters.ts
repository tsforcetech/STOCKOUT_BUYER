import type { SellerSubOrderDto } from "@/api/types/orders";
import { statusIs } from "./order-status";

/**
 * Seller order list views (client side: GET /seller/orders filters by one raw status only and returns no totals, so the
 * page loads the seller's orders and groups them here). One view per order, decided from status + fulfilment status.
 */
export type SellerView = "confirm" | "prepare" | "transit" | "delivered" | "completed" | "closed";

export const SELLER_VIEWS: Array<{ id: SellerView | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "confirm", label: "To confirm" },
  { id: "prepare", label: "To prepare" },
  { id: "transit", label: "On the way" },
  { id: "delivered", label: "Delivered" },
  { id: "completed", label: "Completed" },
  { id: "closed", label: "Cancelled" },
];

export function sellerView(s: Pick<SellerSubOrderDto, "status" | "fulfillmentStatus">): SellerView {
  const st = s.status;
  if (["CANCELLED", "REJECTED", "EXPIRED"].some((x) => statusIs(st, x))) return "closed";
  if (statusIs(st, "PENDING_CONFIRMATION")) return "confirm";
  if (["ACCEPTED", "COMPLETED"].some((x) => statusIs(st, x))) return "completed";
  if (["DELIVERED", "CLAIM_DISPUTED"].some((x) => statusIs(st, x)) || ["DELIVERED", "COLLECTED"].some((x) => statusIs(s.fulfillmentStatus, x))) return "delivered";
  if (statusIs(s.fulfillmentStatus, "IN_TRANSIT")) return "transit";
  return "prepare";
}

export const PERIODS = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "90d", label: "Last 90 days" },
] as const;
export type PeriodId = (typeof PERIODS)[number]["id"];

/** Start of the period in local time (null = no limit). */
export function periodStart(id: string, now = new Date()): number | null {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  switch (id) {
    case "today":
      return day;
    case "7d":
      return day - 6 * 86_400_000;
    case "30d":
      return day - 29 * 86_400_000;
    case "90d":
      return day - 89 * 86_400_000;
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    default:
      return null;
  }
}

export const SORTS = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "value", label: "Highest value" },
  { id: "deadline", label: "Confirm by (soonest)" },
] as const;

const time = (v: string | null | undefined) => (v ? Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`) : NaN);
export const createdAt = (s: Pick<SellerSubOrderDto, "createdAtUtc" | "purchasedAtUtc">) => time(s.purchasedAtUtc ?? s.createdAtUtc);

export function sortOrders(rows: SellerSubOrderDto[], sort: string): SellerSubOrderDto[] {
  const out = [...rows];
  if (sort === "oldest") out.sort((a, b) => createdAt(a) - createdAt(b));
  else if (sort === "value") out.sort((a, b) => b.subOrderTotal - a.subOrderTotal);
  else if (sort === "deadline")
    out.sort((a, b) => {
      const da = sellerView(a) === "confirm" ? time(a.confirmationDeadlineUtc) : NaN;
      const db = sellerView(b) === "confirm" ? time(b.confirmationDeadlineUtc) : NaN;
      if (Number.isNaN(da) && Number.isNaN(db)) return createdAt(b) - createdAt(a);
      if (Number.isNaN(da)) return 1;
      if (Number.isNaN(db)) return -1;
      return da - db;
    });
  else out.sort((a, b) => createdAt(b) - createdAt(a));
  return out;
}

export function matchesSearch(s: SellerSubOrderDto, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return s.subOrderNumber.toLowerCase().includes(t) || s.items.some((i) => (i.titleSnapshot ?? "").toLowerCase().includes(t));
}

/** "Today" / "Yesterday" / "Wed 25 Nov 2026" for date group headings. */
export function dayLabel(ms: number, now = new Date()): string {
  const d = new Date(ms);
  const key = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key(d) === key(now)) return "Today";
  if (key(d) === key(y)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function toCsv(rows: SellerSubOrderDto[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const head = ["Order", "Buyer order", "Date", "Status", "Items", "Quantity", "Materials", "VAT", "Total", "Currency"];
  const lines = rows.map((s) => [
    s.subOrderNumber,
    s.subOrderNumber.replace(/-S\d+$/i, ""),
    new Date(createdAt(s)).toISOString().slice(0, 10),
    SELLER_VIEWS.find((v) => v.id === sellerView(s))?.label ?? s.status,
    s.items.map((i) => i.titleSnapshot ?? "").join("; "),
    String(s.items.reduce((n, i) => n + i.quantity, 0)),
    s.materialSubtotal.toFixed(2),
    s.applicableMaterialVat.toFixed(2),
    s.subOrderTotal.toFixed(2),
    s.items[0]?.currency ?? "AED",
  ]);
  return [head, ...lines].map((r) => r.map(esc).join(",")).join("\r\n");
}
