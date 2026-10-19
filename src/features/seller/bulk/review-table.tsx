import { CheckCircleIcon, CircleNotchIcon, ImageIcon, TrashIcon, WarningCircleIcon, WarningIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { formatMoney, formatNumber } from "@/lib/utils/format";
import { categoryLabel, unitLabel, type BulkRecord, type RowCheck } from "./rows";

export interface ReviewRow {
  record: BulkRecord;
  check: RowCheck;
}

export function RowStatusBadge({ check }: { check: RowCheck }) {
  if (check.state === "checking")
    return (
      <Badge tone="neutral">
        <CircleNotchIcon className="size-3 animate-spin" aria-hidden /> Checking
      </Badge>
    );
  if (check.state === "invalid")
    return (
      <Badge tone="danger">
        <WarningCircleIcon className="size-3.5" aria-hidden /> {check.errors.length} {check.errors.length === 1 ? "error" : "errors"}
      </Badge>
    );
  return (
    <Badge tone="success">
      <CheckCircleIcon className="size-3.5" aria-hidden /> Valid
    </Badge>
  );
}

export function ReviewTable({ rows, onRemove, disabled }: { rows: ReviewRow[]; onRemove: (id: string) => void; disabled?: boolean }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[760px] text-left text-sm">
        <caption className="sr-only">Rows from your file</caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-2 font-medium sm:pl-0">
              Row
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Listing
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Price
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Stock
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-2 sm:pr-0">
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ record, check }) => {
            const v = record.values;
            return (
              <tr key={record.id} className="border-b border-border align-top last:border-0" data-testid={`review-row-${record.line}`}>
                <td className="px-4 py-3 tabular-nums text-muted-foreground sm:pl-0">{record.line}</td>
                <td className="max-w-[320px] px-3 py-3">
                  <p className="break-words font-medium text-foreground">{v.title || <span className="text-muted-foreground">(no title)</span>}</p>
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">{check.category ? categoryLabel(check.category.path) : v.category || "No category"}</p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {check.condition && <Badge tone="neutral">{check.condition.name}</Badge>}
                    {v.emirate && v.city && (
                      <Badge tone="neutral">
                        {v.city}, {v.emirate}
                      </Badge>
                    )}
                    {v.image_file && (
                      <Badge tone={check.image ? "primary" : "neutral"}>
                        <ImageIcon className="size-3.5" aria-hidden /> {v.image_file}
                      </Badge>
                    )}
                  </p>
                </td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums">{check.draft ? formatMoney(check.draft.basePrice, check.draft.currency) : v.price ? `${v.price} ${v.currency}` : "—"}</td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                  {check.quantity !== undefined ? formatNumber(check.quantity) : v.quantity || "—"} {check.unit ? <span className="text-muted-foreground">{unitLabel(check.unit)}</span> : v.unit}
                </td>
                <td className="min-w-[220px] px-3 py-3">
                  <RowStatusBadge check={check} />
                  {check.errors.length > 0 && (
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-danger-soft-foreground">
                      {check.errors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}
                  {check.warnings.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-xs text-warning-soft-foreground">
                      {check.warnings.map((w) => (
                        <li key={w} className="flex gap-1">
                          <WarningIcon className="mt-0.5 size-3 shrink-0" aria-hidden /> {w}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-3 text-right sm:pr-0">
                  <Button variant="danger-ghost" size="icon-sm" aria-label={`Remove row ${record.line}`} disabled={disabled} onClick={() => onRemove(record.id)}>
                    <TrashIcon />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
