import { Link } from "react-router";
import { ArrowSquareOutIcon, CheckCircleIcon, CircleNotchIcon, ClockIcon, ProhibitIcon, XCircleIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/misc";
import { STEP_LABELS, type RunState } from "./runner";

export interface ProgressRow {
  id: string;
  line: number;
  title: string;
  state: RunState;
}

export function RunStatusBadge({ state }: { state: RunState }) {
  switch (state.status) {
    case "pending":
      return (
        <Badge tone="neutral">
          <ClockIcon className="size-3.5" aria-hidden /> Pending
        </Badge>
      );
    case "creating":
      return (
        <Badge tone="primary">
          <CircleNotchIcon className="size-3 animate-spin" aria-hidden /> {state.step ? STEP_LABELS[state.step] : "Creating"}…
        </Badge>
      );
    case "done":
      return (
        <Badge tone="success">
          <CheckCircleIcon className="size-3.5" aria-hidden /> {state.submitted ? "Submitted" : "Draft created"}
        </Badge>
      );
    case "failed":
      return (
        <Badge tone="danger">
          <XCircleIcon className="size-3.5" aria-hidden /> Failed
        </Badge>
      );
    case "cancelled":
      return (
        <Badge tone="warning">
          <ProhibitIcon className="size-3.5" aria-hidden /> Cancelled
        </Badge>
      );
  }
}

export function ProgressTable({ rows }: { rows: ProgressRow[] }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[620px] text-left text-sm">
        <caption className="sr-only">Creation progress</caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-2 font-medium sm:pl-0">
              Row
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Listing
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-2 font-medium sm:pr-0">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody aria-live="polite">
          {rows.map(({ id, line, title, state }) => (
            <tr key={id} className="border-b border-border align-top last:border-0" data-testid={`progress-row-${line}`}>
              <td className="px-4 py-3 tabular-nums text-muted-foreground sm:pl-0">{line}</td>
              <td className="max-w-[320px] break-words px-3 py-3 font-medium text-foreground">{title}</td>
              <td className="min-w-[220px] px-3 py-3">
                <RunStatusBadge state={state} />
                {state.error && <p className="mt-1 text-xs text-danger-soft-foreground">{state.error}</p>}
                {state.note && <p className="mt-1 text-xs text-muted-foreground">{state.note}</p>}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right sm:pr-0">
                {state.listingId && (
                  <Link to={`/seller/listings/${state.listingId}`} className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground">
                    {state.status === "failed" || state.status === "cancelled" ? "Fix in editor" : "Open"} <ArrowSquareOutIcon className="size-4" aria-hidden />
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
