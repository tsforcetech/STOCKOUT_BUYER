import { Link } from "react-router";
import { LeafIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/common/page-header";
import { formatDate } from "@/lib/utils/format";
import { useActiveSeller } from "@/features/seller/lib/queries";
import { LoadMore, OrderListSkeleton } from "@/features/orders/my-orders-page";
import { useOrderPages } from "@/features/orders/use-order-pages";
import { sustainabilityKeys, sustainabilityService } from "@/services/sustainability.service";
import type { TransactionSustainabilityReportDto } from "@/api/types/sustainability";
import { formatMass, VerificationBadge } from "./impact-report";

const co2 = (v: number) => `${formatMass(v)} CO₂e`;

function ReportList({ rows, linkOf }: { rows: TransactionSustainabilityReportDto[]; linkOf: (r: TransactionSustainabilityReportDto) => string }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {rows.map((r) => {
        const evidence = r.lineSnapshots.length > 0 && r.lineSnapshots.every((l) => l.verificationLevel === "EvidenceBackedEstimate");
        return (
          <li key={r.reportId}>
            <Link to={linkOf(r)} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition hover:bg-surface-muted">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success-soft-foreground">
                <LeafIcon className="size-5" weight="fill" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">{r.reportNumber}</span>
                <span className="block text-xs text-muted-foreground">
                  Generated {formatDate(r.generatedAtUtc)} · revision {r.reportRevision} · {r.reportStatus}
                </span>
              </span>
              <span className="text-sm text-body">{formatMass(r.totalPhysicalMassKg)} kept in use</span>
              <span className="text-sm text-body">{co2(r.totalEmbodiedCarbonKgCo2e)}</span>
              <VerificationBadge level={evidence ? "EvidenceBackedEstimate" : "UnverifiedModelEstimate"} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const EMPTY = "Reports appear here after an order is accepted and its material data is approved.";

/** /account/impact-reports: GET /api/v1/buyer/sustainability/reports (shown only when ORDER_API.sustainabilityReports is on). */
export default function BuyerImpactReportsPage() {
  const q = useOrderPages(sustainabilityKeys.buyerList, (page, signal) => sustainabilityService.buyerReports(page, signal), (r) => r.reportId);
  return (
    <div>
      <PageHeader eyebrow="My account" title="Impact reports" description="The environmental impact of the surplus materials you've bought, per accepted order." />
      <div className="mt-5">
        {q.isLoading ? (
          <OrderListSkeleton />
        ) : q.error && !q.rows.length ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !q.rows.length ? (
          <EmptyState
            icon={<LeafIcon />}
            title="No impact reports yet"
            description={EMPTY}
            action={
              <Button asChild variant="secondary">
                <Link to="/account/orders">My orders</Link>
              </Button>
            }
            className="rounded-2xl border border-border bg-surface"
          />
        ) : (
          <>
            <ReportList rows={q.rows} linkOf={(r) => `/account/orders/${r.orderId}`} />
            <LoadMore q={q} />
          </>
        )}
      </div>
    </div>
  );
}

/** /seller/impact-reports: GET /api/v1/seller/sustainability/reports?sellerId= (gated like the buyer page). */
export function SellerImpactReportsPage() {
  const seller = useActiveSeller();
  const q = useOrderPages(sustainabilityKeys.sellerList(seller.sellerId), (page, signal) => sustainabilityService.sellerReports(seller.sellerId, page, signal), (r) => r.reportId);
  return (
    <>
      <PageHeader eyebrow="Seller portal" title="Impact reports" description="The environmental impact of the materials you've sold, per accepted order." />
      {q.isLoading ? (
        <OrderListSkeleton />
      ) : q.error && !q.rows.length ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.rows.length ? (
        <EmptyState icon={<LeafIcon />} title="No impact reports yet" description={EMPTY} className="rounded-2xl border border-border bg-surface" />
      ) : (
        <>
          <ReportList rows={q.rows} linkOf={(r) => `/seller/orders/${r.subOrderId ?? ""}`} />
          <LoadMore q={q} />
        </>
      )}
    </>
  );
}
