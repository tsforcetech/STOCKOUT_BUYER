import type * as React from "react";
import { Link } from "react-router";
import { ArrowLeftIcon, MapPinIcon, RecycleIcon, SealCheckIcon } from "@phosphor-icons/react";
import { Logo } from "@/components/common/logo";
import { loginHeroUrl } from "@/assets/brand";

const POINTS = [
  { icon: SealCheckIcon, text: "Buy from KYC-verified sellers" },
  { icon: MapPinIcon, text: "Surplus stock across all 7 emirates" },
  { icon: RecycleIcon, text: "Keep usable materials out of landfill" },
] as const;

/**
 * Auth screens: a dark brand panel on the left (desktop) and the form on a clean white page.
 * The panel uses src/assets/brand/login-hero.png when that photo is exported; otherwise its text treatment only.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-surface lg:p-4">
      <aside className="relative isolate hidden w-[44%] max-w-[680px] shrink-0 flex-col overflow-hidden rounded-[28px] bg-[#141413] p-12 text-white lg:flex" aria-hidden>
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(80%_70%_at_90%_0%,#3d3d36_0%,#1d1d1b_50%,#111110_100%)]" />
        <div className="absolute -bottom-32 -left-24 -z-10 size-[420px] rounded-full bg-[#f8ff2c]/10 blur-3xl" />
        {loginHeroUrl && <img src={loginHeroUrl} alt="" className="pointer-events-none absolute inset-0 -z-10 size-full object-cover opacity-40" />}
        <Logo tone="light" className="h-8" />
        <div className="mt-auto max-w-[460px]">
          <p className="font-heading text-[44px] font-bold leading-[48px] tracking-tight">
            Find surplus stock.
            <br />
            <span className="text-action">Verified for reuse.</span>
          </p>
          <p className="mt-4 text-base text-white/70">Buy what&apos;s already made, or list what you no longer need.</p>
          <ul className="mt-8 space-y-3">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/85">
                <span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-action">
                  <Icon className="size-4" weight="bold" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-4 px-5 pt-6 sm:px-10 sm:pt-8">
          <Link to="/" aria-label="StockOut home" className="lg:invisible">
            <Logo className="h-7" />
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground">
            <ArrowLeftIcon className="size-4" /> Back to marketplace
          </Link>
        </div>
        <div className="flex flex-1 items-start justify-center px-5 py-10 sm:items-center sm:px-8">{children}</div>
        <footer className="pb-6 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} StockOut. All rights reserved.</p>
        </footer>
      </section>
    </div>
  );
}

/** Form column: left-aligned heading + subtitle above the form (no nested card frame). */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[440px]">
      <div className="mb-8">
        <h1 className="font-heading text-[28px] font-bold leading-9 tracking-tight text-foreground sm:text-[34px] sm:leading-[42px]">{title}</h1>
        {subtitle && <p className="mt-2 text-base leading-6 text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Full-page frame for the shared auth forms (see auth-forms.tsx). */
export function PageFrame({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <AuthShell>
      <AuthCard title={title} subtitle={subtitle}>
        {children}
      </AuthCard>
    </AuthShell>
  );
}
