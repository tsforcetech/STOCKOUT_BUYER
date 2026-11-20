import * as React from "react";
import { Link } from "react-router";
import { ArrowRightIcon, CaretRightIcon, LeafIcon, XIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";
import { env } from "@/config/env";
import { homeHeroUrl, impactPhotoUrl } from "@/assets/brand";


/** Pages place banners only while this is on (VITE_IMPACT_BANNERS=on). */
export const IMPACT_BANNERS = env.impactBannersEnabled;

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
  /** Which part of the photo to show (CSS object-position), so each message frames different materials. */
  focus: string;
}

export const IMPACT_MESSAGES: ImpactMessage[] = [
  { id: "reuse", title: "Reuse beats new", body: "Every surplus item bought here is one less made from scratch. Lower embodied carbon, less waste.", cta: "Browse surplus", to: "/search", focus: "60% 47%" },
  { id: "waste", title: "Less waste on site", body: "Buy just the quantity you need from sellers near you, and collect it today.", cta: "Find materials", to: "/search", focus: "96% 52%" },
  { id: "sell", title: "Leftover stock on your site?", body: "Sell it on StockOut instead of storing or scrapping it, and keep materials in use.", cta: "Start selling", to: "/sell", focus: "76% 50%" },
];

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
 * "wide": home band: light card, brand photo on the right fading into it, dark action.
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
  const photo = impactPhotoUrl(message.id) ?? homeHeroUrl;
  return (
    <section aria-label={message.title} className={cn("relative isolate overflow-hidden rounded-[24px] border border-border", TONE, className)}>
      {/* The photo sits on the right (top on phones) and fades into the light card, so the text stays on a light ground. */}
      {photo && (
        <img
          src={photo}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-x-0 top-0 -z-10 h-40 w-full object-cover [mask-image:linear-gradient(180deg,black_45%,transparent)] sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[52%] sm:[mask-image:linear-gradient(90deg,transparent,black_38%)]"
          style={{ objectPosition: message.focus }}
        />
      )}
      <div className={cn("flex flex-col gap-4 sm:max-w-[54%]", wide ? "px-5 pb-6 pt-36 sm:px-10 sm:py-10" : "px-5 pb-5 pt-32 sm:px-8 sm:py-7")}>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-eyebrow font-bold tracking-[0.18em] text-success-soft-foreground">
            <LeafIcon className="size-4" weight="fill" aria-hidden /> Build greener
          </p>
          <h2 className={cn("mt-2 font-heading font-bold tracking-tight text-foreground", wide ? "text-[26px] leading-8 sm:text-[34px] sm:leading-[40px]" : "text-[22px] leading-7 sm:text-[26px] sm:leading-8")}>{message.title}</h2>
          <p className="mt-2 text-sm leading-6 text-body sm:text-base">{message.body}</p>
        </div>
        <Link
          to={message.to}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-ink px-6 text-[15px] font-semibold text-ink-foreground shadow-raised transition-colors hover:bg-ink-hover"
        >
          {message.cta} <ArrowRightIcon className="size-4" weight="bold" aria-hidden />
        </Link>
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={() => {
          close(message.id);
          setHidden(true);
        }}
        className="absolute right-3 top-3 flex size-8 cursor-pointer items-center justify-center rounded-full bg-surface/80 text-foreground shadow-raised backdrop-blur-sm transition-colors hover:bg-surface"
      >
        <XIcon className="size-4" />
      </button>
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
