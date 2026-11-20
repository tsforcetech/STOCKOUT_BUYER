import * as React from "react";
import { Link } from "react-router";
import { ArrowRightIcon, CaretRightIcon, LeafIcon, XIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";

/**
 * Sustainability messages shown between content (home, search results, listing page). Wording rule: only claims
 * the product backs (reuse instead of new, less waste, local collection). Never "carbon neutral", "zero emissions"
 * or "certified"; figures only from the backend's impact reports, never hard-coded.
 */
export interface ImpactMessage {
  id: string;
  title: string;
  body: string;
  cta: string;
  to: string;
}

export const IMPACT_MESSAGES: ImpactMessage[] = [
  { id: "reuse", title: "Reuse beats new", body: "Every surplus item bought here is one less made from scratch. Lower embodied carbon, less waste.", cta: "Browse surplus", to: "/search" },
  { id: "waste", title: "Less waste on site", body: "Buy just the quantity you need from sellers near you, and collect it today.", cta: "Find materials", to: "/search" },
  { id: "sell", title: "Leftover stock on your site?", body: "Sell it on StockOut instead of storing or scrapping it, and keep materials in use.", cta: "Start selling", to: "/sell" },
];

/** Stacked surplus materials (pipes, an I-beam, tiles) with a leaf sprig: drawn, so it works in both themes. */
function MaterialsArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 170" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="ib-steel" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#c9ced6" />
          <stop offset="1" stopColor="#8d949f" />
        </linearGradient>
        <linearGradient id="ib-pipe" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#eef1f4" />
          <stop offset="1" stopColor="#b9c0c9" />
        </linearGradient>
        <linearGradient id="ib-tile" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#e9d8c4" />
          <stop offset="1" stopColor="#c9ab8b" />
        </linearGradient>
        <linearGradient id="ib-leaf" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      {/* ground shadow */}
      <ellipse cx="110" cy="160" rx="96" ry="8" fill="#000" opacity="0.08" />
      {/* tiles stack (back right) */}
      <g>
        <path d="M128 98 L196 88 L208 100 L140 110 Z" fill="#f3e7d8" />
        <path d="M140 110 L208 100 L208 140 L140 150 Z" fill="url(#ib-tile)" />
        <path d="M128 98 L140 110 L140 150 L128 138 Z" fill="#b38f6c" />
        {[118, 126, 134, 142].map((y) => (
          <path key={y} d={`M140 ${y} L208 ${y - 10}`} stroke="#a98463" strokeWidth="1" opacity="0.55" />
        ))}
      </g>
      {/* I-beam (lying across) */}
      <g>
        <path d="M20 118 L150 96 L158 102 L28 124 Z" fill="#dfe3e8" />
        <path d="M28 124 L158 102 L158 108 L28 130 Z" fill="url(#ib-steel)" />
        <path d="M70 120 L148 107 L148 128 L70 141 Z" fill="#9aa1ab" />
        <path d="M20 136 L150 114 L158 120 L28 142 Z" fill="#d3d8de" />
        <path d="M28 142 L158 120 L158 126 L28 148 Z" fill="url(#ib-steel)" />
        <path d="M20 118 L28 124 L28 148 L20 142 Z" fill="#7c838d" />
        <path d="M24 125 L24 141" stroke="#6b727c" strokeWidth="4" />
      </g>
      {/* pipe bundle (front left) */}
      <g>
        {[
          [44, 92],
          [76, 92],
          [60, 66],
          [108, 92],
          [92, 66],
          [76, 40],
        ].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <path d={`M${cx} ${cy - 15} L${cx + 70} ${cy - 27} L${cx + 70} ${cy + 3} L${cx} ${cy + 15} Z`} fill="url(#ib-pipe)" />
            <ellipse cx={cx + 70} cy={cy - 12} rx="8" ry="15" fill="#c3c9d1" />
            <circle cx={cx} cy={cy} r="15" fill="#f7f8fa" stroke="#9aa2ad" strokeWidth="2" />
            <circle cx={cx} cy={cy} r="9.5" fill="#5d6470" />
            <circle cx={cx - 2} cy={cy - 2} r="9.5" fill="#717885" opacity="0.6" />
          </g>
        ))}
      </g>
      {/* leaf sprig */}
      <g>
        <path d="M168 86 C170 60 176 42 190 26" stroke="#047857" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M190 26 C206 22 214 8 212 0 C198 2 186 12 190 26 Z" fill="url(#ib-leaf)" />
        <path d="M178 50 C162 46 150 32 152 22 C166 22 178 34 178 50 Z" fill="url(#ib-leaf)" />
        <path d="M184 40 C198 42 210 34 214 24 C202 20 188 28 184 40 Z" fill="url(#ib-leaf)" opacity="0.9" />
        <path d="M172 66 C158 66 146 58 144 48 C156 46 170 54 172 66 Z" fill="url(#ib-leaf)" opacity="0.85" />
      </g>
    </svg>
  );
}

const TONE = "bg-[linear-gradient(100deg,var(--success-soft)_0%,var(--cream)_60%,var(--action-soft)_100%)]";

/** Session-only dismissal: closed banners stay closed for this visit. */
const KEY = "stockout.impactBanner.closed";
const isClosed = (id: string) => {
  try {
    return (JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as string[]).includes(id);
  } catch {
    return false;
  }
};
const close = (id: string) => {
  try {
    const all = JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as string[];
    sessionStorage.setItem(KEY, JSON.stringify([...new Set([...all, id])]));
  } catch {
    /* storage unavailable: it just shows again next time */
  }
};

/**
 * "wide": home band, artwork rising out of the top-left corner (like a hero card).
 * "inline": inside a results grid (col-span-full), same look, a little shorter.
 * "strip": one quiet line on the listing page, no artwork or close button.
 */
export function ImpactBanner({ message, variant = "wide", className }: { message: ImpactMessage; variant?: "wide" | "inline" | "strip"; className?: string }) {
  const [hidden, setHidden] = React.useState(() => variant !== "strip" && isClosed(message.id));
  if (hidden) return null;

  if (variant === "strip") {
    return (
      <Link
        to={message.to}
        className={cn("group flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5 text-sm transition-colors hover:border-foreground/30", TONE, className)}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
          <LeafIcon className="size-4" weight="fill" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 leading-5 text-body">
          <span className="font-semibold text-foreground">{message.title}.</span> {message.body}
        </span>
        <CaretRightIcon className="size-4 shrink-0 text-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    );
  }

  const wide = variant === "wide";
  return (
    <section aria-label={message.title} className={cn("relative", wide ? "pt-8 sm:pt-10" : "pt-6 sm:pt-8", className)}>
      <div className={cn("relative flex flex-col gap-4 rounded-2xl border border-border sm:flex-row sm:items-center sm:gap-6", TONE, wide ? "px-5 pb-5 pt-[88px] sm:py-7 sm:pl-[244px] sm:pr-7" : "px-5 pb-5 pt-[76px] sm:py-5 sm:pl-[212px] sm:pr-6")}>
        <MaterialsArt
          className={cn(
            "pointer-events-none absolute drop-shadow-sm",
            wide ? "-top-8 left-4 w-[150px] sm:-top-10 sm:left-5 sm:w-[210px]" : "-top-6 left-4 w-[130px] sm:-top-8 sm:left-4 sm:w-[180px]",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-success-soft-foreground">
            <LeafIcon className="size-3.5" weight="fill" aria-hidden /> Build greener
          </p>
          <h2 className={cn("mt-1 font-heading font-bold text-foreground", wide ? "text-xl leading-7 sm:text-2xl sm:leading-8" : "text-lg leading-6 sm:text-xl")}>{message.title}</h2>
          <p className="mt-1 text-sm leading-6 text-body sm:text-[15px]">{message.body}</p>
        </div>
        <Link
          to={message.to}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-surface px-6 text-[15px] font-semibold text-foreground shadow-raised ring-1 ring-border transition-colors hover:bg-surface-muted sm:self-center"
        >
          {message.cta} <ArrowRightIcon className="size-4" aria-hidden />
        </Link>
        <button
          type="button"
          aria-label="Close"
          onClick={() => {
            close(message.id);
            setHidden(true);
          }}
          className="absolute right-2 top-2 flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
    </section>
  );
}

/** One message per page view, different from the last one this visit, so repeat visits don't see the same banner. */
export function useImpactMessage(exclude?: string): ImpactMessage {
  return React.useMemo(() => {
    const pool = IMPACT_MESSAGES.filter((m) => m.id !== exclude);
    let n = 0;
    try {
      n = Number(sessionStorage.getItem("stockout.impactBanner.n") ?? "0") || 0;
      sessionStorage.setItem("stockout.impactBanner.n", String(n + 1));
    } catch {
      /* fixed first message */
    }
    return pool[n % pool.length];
  }, [exclude]);
}
