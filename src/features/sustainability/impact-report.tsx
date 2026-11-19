import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CarProfileIcon, DownloadSimpleIcon, LeafIcon, PackageIcon, PlantIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils/format";
import { sustainabilityKeys, sustainabilityService } from "@/services/sustainability.service";
import type { TransactionSustainabilityReportDto } from "@/api/types/sustainability";

/** kg, or tonnes from 1,000 kg (one decimal). */
export function formatMass(kg: number | null | undefined) {
  if (typeof kg !== "number" || !Number.isFinite(kg)) return "—";
  return kg >= 1000 ? `${formatNumber(Math.round(kg / 100) / 10)} t` : `${formatNumber(Math.round(kg * 10) / 10)} kg`;
}
const co2 = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? `${formatNumber(Math.round(v * 10) / 10)} kg CO₂e` : "—");

/** SUS-03-CORRECTION-02 badges. Anything else is shown as a model estimate; never "certified" or "audited". */
export function VerificationBadge({ level }: { level: string | null | undefined }) {
  return level === "EvidenceBackedEstimate" ? <Badge tone="success">Evidence-backed</Badge> : <Badge tone="neutral">Model estimate</Badge>;
}

const sum = (r: TransactionSustainabilityReportDto) => r.lineSnapshots.reduce<number | null>((t, l) => (typeof l.passengerCarKmEquivalent === "number" ? (t ?? 0) + l.passengerCarKmEquivalent : t), null);

/**
 * One SUS-03 report: diverted mass, embodied carbon, net avoided carbon and car-km equivalent exactly as the backend
 * snapshot states them, the verification level per line, adjustments, the environmental disclaimer verbatim and the PDF.
 * Green Points stay "not yet available" while approvedEarnablePoints is null (never 0, never the illustrative value).
 */
export function ImpactReport({ report, onDownload }: { report: TransactionSustainabilityReportDto; onDownload: () => Promise<Blob> }) {
  const carKm = sum(report);
  const pointsOpen = report.lineSnapshots.some((l) => l.approvedEarnablePoints != null);
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-label="Sustainability impact report">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success-soft-foreground">
          <LeafIcon className="size-5" weight="fill" aria-hidden />
        </span>
        <div className="min-w-[200px] flex-1">
          <h2 className="font-heading text-lg font-bold text-foreground">Sustainability impact</h2>
          <p className="text-xs text-muted-foreground">
            Report {report.reportNumber} · revision {report.reportRevision} · {formatDateTime(report.generatedAtUtc)}
            {report.reportStatus && !/^generated$/i.test(report.reportStatus) ? ` · ${report.reportStatus}` : ""}
          </p>
        </div>
        <DownloadPdf report={report} onDownload={onDownload} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { label: "Materials kept in use", value: formatMass(report.totalPhysicalMassKg), icon: <PackageIcon /> },
          { label: "Embodied carbon reused", value: co2(report.totalEmbodiedCarbonKgCo2e), icon: <PlantIcon /> },
          { label: "Net avoided carbon", value: report.totalNetAvoidedCarbonKgCo2e == null ? "Not calculated" : co2(report.totalNetAvoidedCarbonKgCo2e), icon: <LeafIcon /> },
          ...(carKm != null ? [{ label: "Car travel equivalent", value: `${formatNumber(Math.round(carKm))} km`, icon: <CarProfileIcon /> }] : []),
        ].map((m) => (
          <div key={m.label} className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-surface-muted p-3">
            <dt className="flex items-start gap-2 text-xs leading-4 text-muted-foreground">
              <span className="min-w-0 flex-1">{m.label}</span>
              <span className="shrink-0 text-foreground [&_svg]:size-4">{m.icon}</span>
            </dt>
            <dd className="break-words font-heading text-lg font-bold leading-6 text-foreground">{m.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 rounded-lg bg-surface-muted p-3 text-xs leading-5 text-body">{report.environmentalDisclaimer}</p>

      {report.lineSnapshots.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="sr-only">Impact per line</caption>
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Material</th>
                <th className="py-2 pr-3 font-medium">Quantity</th>
                <th className="py-2 pr-3 font-medium">Weight</th>
                <th className="py-2 pr-3 font-medium">Embodied carbon</th>
                <th className="py-2 font-medium">Basis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.lineSnapshots.map((l) => (
                <tr key={l.snapshotId}>
                  <td className="py-2 pr-3">
                    <span className="font-medium text-foreground">{l.materialName}</span>
                    <span className="block text-xs text-muted-foreground">{l.materialCategory}</span>
                  </td>
                  <td className="py-2 pr-3 text-body">
                    {formatNumber(l.quantity)} {l.quantityUnit}
                  </td>
                  <td className="py-2 pr-3 text-body">{formatMass(l.totalWeightKg)}</td>
                  <td className="py-2 pr-3 text-body">{co2(l.materialImpactKgCo2e)}</td>
                  <td className="py-2">
                    <VerificationBadge level={l.verificationLevel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report.adjustments.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-foreground">Adjustments</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {report.adjustments.map((a) => (
              <li key={a.adjustmentId} className="rounded-lg border border-border p-3">
                <span className="font-medium text-foreground">{a.isPhysicalReturn ? "Physical return" : "Refund without return"}</span>
                <span className="text-muted-foreground"> · {formatDate(a.createdAtUtc)}</span>
                <p className="mt-0.5 text-body">
                  Quantity {formatNumber(a.originalQuantity)} → {formatNumber(a.effectiveQuantity)}.{" "}
                  {a.isPhysicalReturn ? `Embodied carbon reduced by ${co2(a.reversedMaterialImpactKgCo2e)}.` : "Embodied carbon unchanged (goods were not returned)."}
                </p>
                {a.adjustmentReason && <p className="text-xs text-muted-foreground">{a.adjustmentReason}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <LeafIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {pointsOpen ? "Green Points for this order are shown in your Green Points account." : "Green Points not yet available. This report shows environmental impact only and doesn't earn points."}
      </p>
    </section>
  );
}

function DownloadPdf({ report, onDownload }: { report: TransactionSustainabilityReportDto; onDownload: () => Promise<Blob> }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  if (!report.downloadUrl && !report.fileAssetId) return null;
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const blob = await onDownload();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.reportNumber || "impact-report"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="secondary" loading={busy} onClick={() => void run()}>
        <DownloadSimpleIcon /> Download report (PDF)
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger-soft-foreground">
          {error}
        </p>
      )}
    </div>
  );
}

/** "No report yet" is normal (not accepted yet, factors pending): never a zero or an estimate in its place. */
const PENDING = (e: unknown) => isApiError(e) && (e.status === 404 || e.code === "SUSTAINABILITY_REPORT_NOT_FOUND" || e.code === "REPORT_NOT_FOUND");

function ReportState({ q, onDownload }: { q: { isLoading: boolean; error: unknown; data: TransactionSustainabilityReportDto | undefined; refetch: () => unknown }; onDownload: (r: TransactionSustainabilityReportDto) => Promise<Blob> }) {
  if (q.isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (q.data) return <ImpactReport report={q.data} onDownload={() => onDownload(q.data!)} />;
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 text-sm" aria-label="Sustainability impact report">
      <h2 className="flex items-center gap-2 font-heading text-base font-bold text-foreground">
        <LeafIcon className="size-4 text-success" weight="fill" aria-hidden /> Sustainability impact
      </h2>
      {PENDING(q.error) || !q.error ? (
        <p className="mt-1 text-muted-foreground">Not available yet. The impact report is prepared after the order is accepted and its material data is approved.</p>
      ) : (
        <p className="mt-1 text-muted-foreground">
          The impact report couldn&apos;t be loaded.{" "}
          <button type="button" className="underline underline-offset-4" onClick={() => void q.refetch()}>
            Try again
          </button>
        </p>
      )}
    </section>
  );
}

const reportRetry = (n: number, e: unknown) => !(isApiError(e) && e.status >= 400 && e.status < 500) && n < 1;

/** Buyer order page: GET /api/v1/buyer/orders/{orderId}/sustainability-report. */
export function BuyerOrderImpact({ orderId }: { orderId: string }) {
  const q = useQuery({ queryKey: sustainabilityKeys.buyerOrder(orderId), queryFn: ({ signal }) => sustainabilityService.buyerOrderReport(orderId, signal), retry: reportRetry });
  return <ReportState q={q} onDownload={(r) => sustainabilityService.buyerPdf(r.reportId)} />;
}

/** Seller sub-order page: GET /api/v1/seller/suborders/{subOrderId}/sustainability-report?sellerId=. */
export function SellerSubOrderImpact({ sellerId, subOrderId }: { sellerId: string; subOrderId: string }) {
  const q = useQuery({
    queryKey: sustainabilityKeys.sellerSubOrder(sellerId, subOrderId),
    queryFn: ({ signal }) => sustainabilityService.sellerSubOrderReport(sellerId, subOrderId, signal),
    retry: reportRetry,
  });
  return <ReportState q={q} onDownload={(r) => sustainabilityService.sellerPdf(sellerId, r.reportId)} />;
}
