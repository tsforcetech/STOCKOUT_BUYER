import * as React from "react";
import {
  ArrowRightIcon,
  ClipboardTextIcon,
  EnvelopeSimpleIcon,
  LockSimpleIcon,
  MapPinIcon,
  SealCheckIcon,
  StorefrontIcon,
} from "@phosphor-icons/react";
import { Logo } from "@/components/common/logo";
import { homeHeroUrl } from "@/assets/brand";
import { CONTACT_EMAIL } from "@/lib/launch";
import { useSeo } from "@/lib/seo/use-seo";

const WORDS = [
  "steel beams",
  "PPR pipes",
  "copper cable",
  "porcelain tiles",
  "cement",
  "gate valves",
  "gypsum board",
];

/** Teaser lots on the stock board: names only; quantities and prices stay locked until launch. */
const LOTS = [
  { lot: "LOT 0147", item: "UNIVERSAL BEAM 305x165", place: "DUBAI" },
  { lot: "LOT 0212", item: "PPR PIPE PN20 25MM", place: "SHARJAH" },
  { lot: "LOT 0389", item: "XLPE CABLE 4C 95MM2", place: "ABU DHABI" },
  { lot: "LOT 0455", item: "PORCELAIN TILE 60x60", place: "AJMAN" },
  { lot: "LOT 0518", item: "OPC CEMENT 42.5N", place: "RAS AL KHAIMAH" },
];

const mailto = (subject: string, body: string) =>
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
const EARLY = mailto(
  "Early access to StockOut",
  "Hi StockOut team,\n\nPlease let me know when StockOut opens.\n\nName:\nCompany:\nWhat I'm looking for:\n",
);
const SELL = mailto(
  "Selling surplus stock on StockOut",
  "Hi StockOut team,\n\nI have surplus stock I'd like to sell on StockOut.\n\nName:\nCompany:\nWhat I have (items, quantity, location):\n",
);

const reducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

/** Split-flap style text: cycles random characters, then settles left to right on the real text. */
function Flap({
  text,
  delay = 0,
  run,
}: {
  text: string;
  delay?: number;
  run: number;
}) {
  const [shown, setShown] = React.useState(text);
  React.useEffect(() => {
    if (reducedMotion()) return setShown(text);
    let frame = 0;
    let timer: number | undefined;
    const start = window.setTimeout(function tick() {
      frame += 1;
      const settled = Math.floor(frame / 2);
      setShown(
        text
          .split("")
          .map((ch, i) =>
            ch === " " || i < settled
              ? ch
              : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          )
          .join(""),
      );
      if (settled < text.length) timer = window.setTimeout(tick, 28);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(timer);
    };
  }, [text, delay, run]);
  return <span aria-hidden>{shown}</span>;
}

/** A locked value: digits flicker briefly, then a redacted bar with a slow shimmer. */
function Locked({
  width,
  delay,
  run,
}: {
  width: string;
  delay: number;
  run: number;
}) {
  const [digits, setDigits] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (reducedMotion()) return;
    let n = 0;
    let timer: number | undefined;
    const start = window.setTimeout(function tick() {
      n += 1;
      setDigits(
        n < 14 ? String(Math.floor(Math.random() * 90000) + 1000) : null,
      );
      if (n < 14) timer = window.setTimeout(tick, 45);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(timer);
    };
  }, [delay, run]);
  if (digits) return <span className="tabular-nums text-action">{digits}</span>;
  return (
    <span
      className={`so-redacted inline-block h-3 rounded-sm align-middle ${width}`}
      aria-label="Hidden until launch"
    />
  );
}

function RotatingWord() {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (reducedMotion()) return;
    const t = window.setInterval(
      () => setI((n) => (n + 1) % WORDS.length),
      2400,
    );
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className="relative inline-block text-action">
      <span key={i} className="so-rise inline-block whitespace-nowrap">
        {WORDS[i]},
      </span>
    </span>
  );
}

function StockBoard() {
  // Every few seconds one row "updates", like a departures board.
  const [runs, setRuns] = React.useState(() => LOTS.map(() => 0));
  React.useEffect(() => {
    if (reducedMotion()) return;
    const t = window.setInterval(() => {
      const row = Math.floor(Math.random() * LOTS.length);
      setRuns((r) => r.map((v, i) => (i === row ? v + 1 : v)));
    }, 2600);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-5">
      <div className="mb-4 flex items-center justify-between font-mono text-[11px] tracking-[0.18em] text-white/55">
        <span className="inline-flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-action/70" />
            <span className="relative inline-flex size-2 rounded-full bg-action" />
          </span>
          LOTS BEING LISTED
        </span>
        <span className="inline-flex items-center gap-1.5">
          <LockSimpleIcon className="size-3.5" aria-hidden /> LOCKED
        </span>
      </div>
      <ul
        className="divide-y divide-white/[0.07] font-mono text-[12px] sm:text-[13px]"
        aria-label="A preview of stock coming to StockOut"
      >
        {LOTS.map((l, i) => (
          <li
            key={l.lot}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3"
          >
            <span className="sr-only">
              {l.item}, {l.place}. Quantity and price shown at launch.
            </span>
            <span className="min-w-0 truncate text-white/90">
              <span className="mr-2 text-white/35">{l.lot.slice(4)}</span>
              <Flap text={l.item} delay={250 + i * 160} run={runs[i]} />
            </span>
            <span className="text-right text-white/60">
              AED <Locked width="w-12" delay={500 + i * 160} run={runs[i]} />
            </span>
            <span className="text-[11px] tracking-wider text-white/40">
              <Flap text={l.place} delay={400 + i * 160} run={runs[i]} />
            </span>
            <span className="text-right text-[11px] text-white/40">
              QTY <Locked width="w-8" delay={650 + i * 160} run={runs[i]} />
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="so-stripes h-full w-[78%] rounded-full bg-action" />
        </div>
        <p className="mt-2 flex justify-between font-mono text-[11px] tracking-wider text-white/45">
          <span>PRICES UNLOCK AT LAUNCH</span>
          <span>78%</span>
        </p>
      </div>
    </div>
  );
}

const FACTS = [
  {
    icon: SealCheckIcon,
    title: "Verified sellers",
    text: "Every business is checked before it can sell.",
  },
  {
    icon: ClipboardTextIcon,
    title: "Inspected stock",
    text: "Independent inspections on the lots that matter.",
  },
  {
    icon: MapPinIcon,
    title: "Across the UAE",
    text: "Surplus from all seven emirates, in one place.",
  },
];

/** Pre-launch home page: full-screen teaser with contact links and a prominent way into the marketplace preview. */
export function LaunchCover({ onExplore }: { onExplore: () => void }) {
  useSeo({
    title: "StockOut – Launching soon | Surplus Stock Marketplace in UAE",
    description:
      "StockOut, the UAE marketplace for verified surplus and excess stock, is launching soon. Contact info@stockoutme.com for early access.",
    path: "/",
  });
  // The page is dark edge to edge (including the space under it while the cookie banner shows, and overscroll).
  React.useLayoutEffect(() => {
    const html = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    const prev = {
      bg: html.style.backgroundColor,
      body: document.body.style.backgroundColor,
      theme: meta?.content,
    };
    html.style.backgroundColor = document.body.style.backgroundColor =
      "#0c0c0b";
    meta?.setAttribute("content", "#0c0c0b");
    return () => {
      html.style.backgroundColor = prev.bg;
      document.body.style.backgroundColor = prev.body;
      if (meta && prev.theme) meta.setAttribute("content", prev.theme);
    };
  }, []);
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#0c0c0b] text-white">
      <style>{`
        @keyframes so-rise { from { opacity: 0; transform: translateY(0.45em); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
        .so-rise { animation: so-rise 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
        @keyframes so-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        .so-redacted { background: linear-gradient(90deg, rgb(255 255 255 / 0.14) 0%, rgb(255 255 255 / 0.32) 50%, rgb(255 255 255 / 0.14) 100%); background-size: 200% 100%; animation: so-shimmer 2.8s linear infinite; }
        @keyframes so-stripes { from { background-position: 0 0; } to { background-position: 24px 0; } }
        .so-stripes { background-image: repeating-linear-gradient(135deg, transparent 0 6px, rgb(0 0 0 / 0.18) 6px 12px); animation: so-stripes 1s linear infinite; }
        @keyframes so-fade { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .so-fade { animation: so-fade 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
        @media (prefers-reduced-motion: reduce) { .so-rise, .so-redacted, .so-stripes, .so-fade { animation: none; } }
      `}</style>

      {/* Backdrop: warehouse photo, darkened; fine grid; a single yellow glow. */}
      {homeHeroUrl && (
        <img
          src={homeHeroUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-20 size-full object-cover opacity-[0.16] grayscale"
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0c0c0b]/60 via-[#0c0c0b]/85 to-[#0c0c0b]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />
      <div
        aria-hidden
        className="absolute -right-40 -top-40 -z-10 size-[520px] rounded-full bg-action/20 blur-[120px]"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Logo tone="light" className="h-7 sm:h-8" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExplore}
            className="hidden min-h-10 cursor-pointer items-center gap-2 rounded-full border border-action/60 px-4 text-sm font-semibold text-action transition hover:bg-action hover:text-action-foreground md:inline-flex"
          >
            Explore marketplace{" "}
            <ArrowRightIcon className="size-4" aria-hidden />
          </button>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-3.5 text-sm text-white/80 transition hover:border-white/40 hover:text-white"
          >
            <EnvelopeSimpleIcon className="size-4" aria-hidden />
            <span className="hidden sm:inline">{CONTACT_EMAIL}</span>
            <span className="sm:hidden">Contact</span>
          </a>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 pb-12 pt-6 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:pb-16">
        <section className="so-fade">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-white/75">
            <span className="size-1.5 rounded-full bg-action" aria-hidden />{" "}
            Launching soon · UAE
          </p>
          <h1 className="mt-6 font-heading text-white text-[42px] font-bold leading-[1.04] tracking-tight sm:text-6xl lg:text-[76px]">
            <span className="sr-only">Surplus stock, priced to move.</span>
            <span aria-hidden>
              Surplus <RotatingWord />
              <br />
              priced to move.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
            Somewhere in the UAE, a warehouse is full of materials nobody&apos;s
            selling. StockOut is about to change that: a marketplace for
            verified surplus and excess stock, from real sellers, at prices you
            won&apos;t find in a catalogue.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onExplore}
              className="group inline-flex min-h-14 cursor-pointer items-center justify-center gap-2.5 rounded-full bg-action px-7 text-lg font-bold text-action-foreground shadow-[0_0_40px_-6px] shadow-action/60 transition hover:bg-action-hover"
            >
              <StorefrontIcon className="size-5" weight="bold" aria-hidden />{" "}
              Explore marketplace
              <ArrowRightIcon
                className="size-5 transition group-hover:translate-x-1"
                weight="bold"
                aria-hidden
              />
            </button>
            <a
              href={EARLY}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/25 px-7 font-medium text-white transition hover:border-white/50 hover:bg-white/[0.06]"
            >
              <EnvelopeSimpleIcon className="size-4" aria-hidden /> Get early
              access
            </a>
          </div>
          <p className="mt-3 text-sm text-white/50">
            Preview is open now. Full launch coming soon.
          </p>
          <p className="mt-4 text-sm text-white/45">
            Have surplus to sell?{" "}
            <a
              href={SELL}
              className="text-white/80 underline decoration-white/30 underline-offset-4 hover:decoration-action"
            >
              Tell us
            </a>{" "}
            · Questions?{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-white/80 underline decoration-white/30 underline-offset-4 hover:decoration-action"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

        <section
          className="so-fade [animation-delay:150ms]"
          aria-label="Coming soon to StockOut"
        >
          <StockBoard />
        </section>
      </main>

      <section
        className="mx-auto grid w-full max-w-6xl gap-px overflow-hidden border-y border-white/10 bg-white/10 sm:grid-cols-3"
        aria-label="What to expect"
      >
        {FACTS.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="flex gap-3 bg-[#0c0c0b] px-4 py-5 sm:px-8"
          >
            <Icon className="mt-0.5 size-5 shrink-0 text-action" aria-hidden />
            <div>
              <p className="font-heading font-semibold text-white">{title}</p>
              <p className="mt-0.5 text-sm text-white/50">{text}</p>
            </div>
          </div>
        ))}
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-white/40 sm:flex-row sm:px-8">
        <p>© {new Date().getFullYear()} StockOut. All rights reserved.</p>
        <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white">
          {CONTACT_EMAIL}
        </a>
      </footer>
    </div>
  );
}
