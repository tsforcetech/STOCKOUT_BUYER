import { CaretDownIcon, ShieldCheckIcon } from "@phosphor-icons/react";

const TIPS = [
  "Inspect the stock in person before you collect or accept delivery.",
  "Pay only through StockOut once online checkout is live — never by bank transfer or cash to a stranger.",
  "Never share one-time passwords (OTPs) or login codes with anyone, including people claiming to be StockOut.",
];

/** Collapsible buyer safety tips. */
export function ListingSafetyTips({ className }: { className?: string }) {
  return (
    <details className={`group rounded-xl border border-border bg-cream ${className ?? ""}`}>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
          <ShieldCheckIcon className="size-5" weight="fill" />
        </span>
        <span className="flex-1 text-sm font-medium text-foreground">Safety tips for buyers</span>
        <CaretDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="space-y-2 px-4 pb-4 pl-16 text-sm text-body">
        {TIPS.map((t) => (
          <li key={t} className="list-disc">
            {t}
          </li>
        ))}
      </ul>
    </details>
  );
}
