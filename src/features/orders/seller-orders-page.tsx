import * as React from "react";
import { Link } from "react-router";
import { CheckCircleIcon, ClockIcon, DownloadSimpleIcon, ListNumbersIcon, PackageIcon, ReceiptIcon, TrendUpIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard, Toolbar, RefreshButton } from "@/components/common/section-card";
import { StatCards } from "@/components/common/stat-cards";
import { SearchInput } from "@/components/tables/table-toolbar";
import { EmptyState } from "@/components/feedback/states";
import { useUrlState } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils/cn";
import { formatMoney, formatNumber } from "@/lib/utils/format";
import { useActiveSeller } from "@/features/seller/lib/queries";
import { orderKeys, ordersService } from "@/services/orders.service";
import type { SellerSubOrderDto } from "@/api/types/orders";
import { SellerOrderList } from "./components/order-views";
import { slaState, useNow } from "./components/seller-sla";
import { OrderListSkeleton } from "./my-orders-page";
import { SellerOrderError } from "./seller-order-error";
import { useOrderPages } from "./use-order-pages";
import { PERIODS, SELLER_VIEWS, SORTS, createdAt, dayLabel, matchesSearch, periodStart, sellerView, sortOrders, toCsv } from "./seller-order-filters";

/** Safety cap when loading every page for client-side filters (20 per page). */
const MAX_PAGES = 25;
const DEFAULTS = { view: "all", period: "all", sort: "newest", q: "" };

/**
 * /seller/orders: every order for the active seller's listings, with status views, period, search, sort, date groups and
 * CSV export. GET /api/v1/seller/orders has no totals or date filter, so all pages are loaded and filtered here.
 */
export default function SellerOrdersPage() {
  const seller = useActiveSeller();
  const q = useOrderPages(orderKeys.sellerList(seller.sellerId), (page, signal) => ordersService.sellerOrders(seller.sellerId, page, signal), (s) => s.subOrderId);
  const [s, set] = useUrlState(DEFAULTS);
  const now = useNow();
  const pages = q.data?.pages.length ?? 0;

  // Load the remaining pages in the background so counts, totals and filters cover every order.
  React.useEffect(() => {
    if (q.hasNextPage && !q.isFetchingNextPage && !q.error && pages < MAX_PAGES) void q.fetchNextPage();
  }, [q.hasNextPage, q.isFetchingNextPage, q.error, pages, q]);

  const inPeriod = React.useMemo(() => {
    const from = periodStart(s.period);
    return from == null ? q.rows : q.rows.filter((r) => createdAt(r) >= from);
  }, [q.rows, s.period]);
  const searched = React.useMemo(() => inPeriod.filter((r) => matchesSearch(r, s.q)), [inPeriod, s.q]);
  const count = (id: string) => (id === "all" ? searched.length : searched.filter((r) => sellerView(r) === id).length);
  const shown = React.useMemo(() => sortOrders(s.view === "all" ? searched : searched.filter((r) => sellerView(r) === s.view), s.sort), [searched, s.view, s.sort]);

  const toConfirm = inPeriod.filter((r) => sellerView(r) === "confirm");
  const overdue = toConfirm.filter((r) => {
    const st = slaState(r, now);
    return st?.kind === "expired" || st?.kind === "escalated" || (st?.kind === "due" && st.ms < 6 * 3_600_000);
  }).length;
  const inProgress = inPeriod.filter((r) => ["prepare", "transit", "delivered"].includes(sellerView(r))).length;
  const completed = inPeriod.filter((r) => sellerView(r) === "completed");
  const sales = inPeriod.filter((r) => sellerView(r) !== "closed" && sellerView(r) !== "confirm").reduce((n, r) => n + r.subOrderTotal, 0);
  const currency = q.rows[0]?.items[0]?.currency ?? "AED";
  const periodLabel = PERIODS.find((p) => p.id === s.period)?.label.toLowerCase() ?? "all time";
  const loadingAll = q.isFetchingNextPage || (q.hasNextPage && pages < MAX_PAGES);
  const filtered = s.view !== "all" || s.period !== "all" || !!s.q;

  const exportCsv = () => {
    const blob = new Blob([toCsv(shown)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stockout-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Date groups only make sense when sorted by date.
  const groups = React.useMemo(() => {
    if (s.sort !== "newest" && s.sort !== "oldest") return [{ label: null as string | null, rows: shown }];
    const out: Array<{ label: string | null; rows: SellerSubOrderDto[] }> = [];
    for (const r of shown) {
      const label = dayLabel(createdAt(r));
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(r);
      else out.push({ label, rows: [r] });
    }
    return out;
  }, [shown, s.sort]);

  return (
    <>
      <PageHeader
        eyebrow="Seller portal"
        title="Orders"
        description={`Orders buyers have placed for ${seller.displayName}'s listings.`}
        actions={
          q.rows.length > 0 && (
            <Button variant="secondary" onClick={exportCsv} disabled={!shown.length}>
              <DownloadSimpleIcon /> Export CSV
            </Button>
          )
        }
      />
      {q.isLoading ? (
        <OrderListSkeleton />
      ) : q.error && !q.rows.length ? (
        <SellerOrderError error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.rows.length ? (
        <SectionCard>
          <EmptyState
            icon={<ReceiptIcon />}
            title="No orders yet"
            description="Orders for your listings appear here as soon as a buyer places one."
            action={
              <Button asChild variant="secondary">
                <Link to="/seller/listings">
                  <ListNumbersIcon /> Manage listings
                </Link>
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <>
          <StatCards
            className="mb-4"
            items={[
              {
                label: "To confirm",
                value: formatNumber(toConfirm.length),
                icon: <ClockIcon />,
                hint: overdue ? `${formatNumber(overdue)} due soon or overdue` : toConfirm.length ? "Confirm within 24 hours" : "Nothing waiting",
                hintTone: overdue ? "danger" : "muted",
              },
              { label: "In progress", value: formatNumber(inProgress), icon: <PackageIcon />, hint: "Preparing, on the way or delivered" },
              { label: "Completed", value: formatNumber(completed.length), icon: <CheckCircleIcon />, hint: "Accepted by the buyer" },
              { label: "Sales", value: `${currency} ${Math.round(sales).toLocaleString("en-US")}`, icon: <TrendUpIcon />, hint: `Confirmed orders, ${periodLabel}` },
            ]}
          />
          <SectionCard>
            <div role="tablist" aria-label="Order status" className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {SELLER_VIEWS.map((v) => {
                const on = s.view === v.id;
                const n = count(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => set({ view: v.id })}
                    className={cn(
                      "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                      on ? "border-foreground bg-foreground text-surface" : "border-border bg-surface text-foreground hover:border-foreground/40",
                    )}
                  >
                    {v.label}
                    <span className={cn("rounded-full px-1.5 text-xs", on ? "bg-surface/20" : v.id === "confirm" && n > 0 ? "bg-action text-action-foreground" : "bg-surface-muted text-muted-foreground")}>{formatNumber(n)}</span>
                  </button>
                );
              })}
            </div>
            <Toolbar
              left={
                <>
                  <SearchInput value={s.q} onChange={(v) => set({ q: v })} placeholder="Order number or item" label="Search orders" />
                  <NativeSelect className="h-[38px] w-full sm:w-44" value={s.period} onChange={(e) => set({ period: e.target.value })} aria-label="Period">
                    {PERIODS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </NativeSelect>
                  <NativeSelect className="h-[38px] w-full sm:w-52" value={s.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort">
                    {SORTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </NativeSelect>
                </>
              }
              right={
                <>
                  {filtered && (
                    <Button variant="ghost" size="sm" onClick={() => set({ view: "all", period: "all", q: "" })}>
                      <XIcon /> Reset
                    </Button>
                  )}
                  <RefreshButton onClick={() => void q.refetch()} spinning={q.isFetching && !q.isFetchingNextPage} />
                </>
              }
            />
            <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
              {formatNumber(shown.length)} order{shown.length === 1 ? "" : "s"}
              {shown.length > 0 && ` · ${formatMoney(shown.reduce((n, r) => n + r.subOrderTotal, 0), currency)}`}
              {loadingAll && " · loading older orders…"}
            </p>
            {shown.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No orders match these filters.</p>
            ) : (
              <div className="space-y-5">
                {groups.map((g) => (
                  <section key={g.label ?? "all"} aria-label={g.label ?? "Orders"}>
                    {g.label && (
                      <h2 className="mb-2 flex items-baseline justify-between text-sm font-semibold text-foreground">
                        {g.label}
                        <span className="text-xs font-normal text-muted-foreground">
                          {formatNumber(g.rows.length)} · {formatMoney(g.rows.reduce((n, r) => n + r.subOrderTotal, 0), currency)}
                        </span>
                      </h2>
                    )}
                    <SellerOrderList sellerId={seller.sellerId} subOrders={g.rows} />
                  </section>
                ))}
              </div>
            )}
            {q.error && q.rows.length > 0 && <p className="mt-3 text-sm text-danger">Some older orders couldn&apos;t be loaded. Refresh to try again.</p>}
          </SectionCard>
        </>
      )}
    </>
  );
}
