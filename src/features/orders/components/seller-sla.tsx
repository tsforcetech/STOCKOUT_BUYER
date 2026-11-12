import * as React from "react";
import { HourglassMediumIcon, SirenIcon, WarningIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";
import type { SellerSubOrderDto } from "@/api/types/orders";

/** "PENDINGCONFIRMATION" / "PENDING_CONFIRMATION" / "PendingConfirmation" all mean awaiting the seller. */
export const isPendingConfirmation = (status: string | null | undefined) => (status ?? "").replace(/[^a-z]/gi, "").toUpperCase() === "PENDINGCONFIRMATION";

/** The server's deadline is UTC; ISO without a zone is treated as UTC. */
const parseUtc = (iso: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).getTime();

function useNow(intervalMs = 30_000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export type SlaState = { kind: "due"; ms: number } | { kind: "expired" } | { kind: "escalated" } | null;

/** Stage 8C.9 seller SLA state, only from server fields (never computed from order creation). */
export function slaState(sub: Pick<SellerSubOrderDto, "status" | "confirmationDeadlineUtc" | "isEscalated">, now: number): SlaState {
  if (!isPendingConfirmation(sub.status)) return null;
  if (sub.isEscalated) return { kind: "escalated" };
  if (!sub.confirmationDeadlineUtc) return null;
  const ms = parseUtc(sub.confirmationDeadlineUtc) - now;
  return ms > 0 ? { kind: "due", ms } : { kind: "expired" };
}

const dur = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} h ${m % 60} min` : `${m} min`;
};

/** Countdown / expired / escalated badge for a seller suborder awaiting confirmation. */
export function SellerSlaBadge({ sub, detailed = false }: { sub: SellerSubOrderDto; detailed?: boolean }) {
  const now = useNow();
  const st = slaState(sub, now);
  if (!st) return null;
  const urgent = st.kind === "due" && st.ms < 6 * 3_600_000;
  const cls =
    st.kind === "escalated"
      ? "bg-danger-soft text-danger-soft-foreground"
      : st.kind === "expired"
        ? "bg-warning-soft text-warning-soft-foreground"
        : urgent
          ? "bg-warning-soft text-warning-soft-foreground"
          : "bg-success-soft text-success-soft-foreground";
  const Icon = st.kind === "escalated" ? SirenIcon : st.kind === "expired" ? WarningIcon : HourglassMediumIcon;
  const text =
    st.kind === "escalated"
      ? "Overdue. Under StockOut review: confirm or reject now"
      : st.kind === "expired"
        ? "Confirmation time has passed. Escalation in progress"
        : `Confirm within ${dur(st.ms)}`;
  return (
    <span className={cn("inline-flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium", cls)} role="status">
      <Icon className="mt-px size-4 shrink-0" weight="fill" aria-hidden />
      <span>
        {text}
        {detailed && sub.confirmationDeadlineUtc && <span className="block font-normal opacity-80">Deadline {formatDateTime(sub.confirmationDeadlineUtc)}</span>}
      </span>
    </span>
  );
}
