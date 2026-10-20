import {
  ArrowRightIcon,
  ClipboardTextIcon,
  FileArrowUpIcon,
  MagnifyingGlassIcon,
  SealCheckIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";
import { useRfq, type OpenRfqOptions } from "./rfq-dialog";

/** Small illustration: a quote sheet with a lime "verified quote" seal, drawn with icons so it works in both themes. */
function QuoteArt({ size = "lg" }: { size?: "lg" | "sm" }) {
  const lg = size === "lg";
  return (
    <span
      className={cn(
        "relative shrink-0",
        lg ? "h-[92px] w-[110px]" : "h-12 w-12",
      )}
      aria-hidden
    >
      <span
        className={cn(
          "absolute rounded-xl bg-surface shadow-raised ring-1 ring-border",
          lg ? "left-2 top-2 h-[78px] w-[64px] -rotate-6" : "inset-0 -rotate-6",
        )}
      />
      <span
        className={cn(
          "absolute flex flex-col gap-1.5 rounded-xl bg-surface p-2.5 shadow-raised ring-1 ring-border",
          lg
            ? "left-9 top-0 h-[84px] w-[68px] rotate-3"
            : "inset-0 rotate-3 items-center justify-center p-0",
        )}
      >
        {lg ? (
          <>
            <ClipboardTextIcon className="size-5 text-foreground" />
            <span className="h-1.5 w-10 rounded-full bg-border-strong" />
            <span className="h-1.5 w-8 rounded-full bg-border" />
            <span className="h-1.5 w-9 rounded-full bg-border" />
          </>
        ) : (
          <ClipboardTextIcon className="size-6 text-foreground" />
        )}
      </span>
      <span
        className={cn(
          "absolute flex items-center justify-center rounded-full bg-action text-action-foreground ring-4 ring-surface",
          lg ? "bottom-0 right-1 size-9" : "-bottom-1 -right-1 size-5 ring-2",
        )}
      >
        <SealCheckIcon className={lg ? "size-5" : "size-3"} weight="fill" />
      </span>
    </span>
  );
}

const TONE =
  "bg-[linear-gradient(100deg,var(--action-soft)_0%,var(--cream)_55%,var(--cream-strong)_100%)]";

type Variant =
  /** Home / categories: full-width marketing band (BOQ message). */
  | "wide"
  /** Search with no results: the main way forward. */
  | "empty"
  /** Inside search results, after the first rows. */
  | "inline"
  /** Cart, listing page: one compact row. */
  | "compact";

export function RfqBanner({
  variant,
  options,
  title,
  body,
  cta,
  className,
  beforeOpen,
}: {
  variant: Variant;
  options: OpenRfqOptions;
  title: string;
  body: string;
  cta?: string;
  className?: string;
  beforeOpen?: () => void;
}) {
  const openRfq = useRfq();
  const open = () => {
    beforeOpen?.();
    openRfq(options);
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={open}
        className={cn(
          "group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-foreground/30",
          TONE,
          className,
        )}
      >
        <QuoteArt size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            {title}
          </span>
          <span className="block text-xs leading-5 text-body">{body}</span>
        </span>
        <ArrowRightIcon className="size-4 shrink-0 text-foreground transition-transform group-hover:translate-x-0.5" />
      </button>
    );
  }

  const big = variant === "empty";
  return (
    <section
      aria-label="Request for quote"
      className={cn(
        "relative isolate flex flex-col items-center gap-5 overflow-hidden rounded-2xl border border-border text-center sm:flex-row sm:text-left",
        big ? "px-6 py-8 sm:px-8" : "px-5 py-5 sm:px-6",
        TONE,
        className,
      )}
    >
      <QuoteArt />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-heading font-bold text-foreground",
            big
              ? "text-[22px] leading-7 sm:text-[26px] sm:leading-8"
              : "text-lg leading-6 sm:text-xl",
          )}
        >
          {title}
        </p>
        <p className="mt-1.5 text-sm leading-6 text-body sm:text-[15px]">
          {body}
        </p>
        {big && (
          <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-medium text-foreground sm:justify-start">
            <li className="flex items-center gap-1.5">
              <MagnifyingGlassIcon className="size-4" /> We search verified
              sellers
            </li>
            <li className="flex items-center gap-1.5">
              <FileArrowUpIcon className="size-4" /> Type it or upload a BOQ
            </li>
            <li className="flex items-center gap-1.5">
              <SealCheckIcon className="size-4" /> Free, no obligation
            </li>
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={open}
        className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-ink-foreground shadow-raised transition-colors hover:bg-ink-hover"
      >
        {cta ?? "Share your RFQ"} <ArrowRightIcon className="size-4" />
      </button>
    </section>
  );
}
