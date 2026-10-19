import { Link } from "react-router";
import { ArrowRightIcon, CheckCircleIcon, IdentificationCardIcon, ListPlusIcon, MagnifyingGlassIcon, SealCheckIcon, StackIcon, StorefrontIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth/auth-context";

const STEPS = [
  { icon: IdentificationCardIcon, title: "Open a seller account", text: "Register as a business or an individual. It takes a couple of minutes." },
  { icon: SealCheckIcon, title: "Get verified", text: "Upload your verification documents. Our team reviews them before your listings go live." },
  { icon: ListPlusIcon, title: "List your surplus", text: "Add photos, specifications, quantity and price. Listings are reviewed — some categories are physically inspected." },
  { icon: MagnifyingGlassIcon, title: "Get discovered", text: "Published listings appear in search for buyers across the UAE." },
];

/** What sellers get, limited to features the seller portal has today. */
const PERKS = [
  { icon: StackIcon, title: "List one item or hundreds", text: "Create listings one by one, or bulk upload a whole stock list." },
  { icon: SealCheckIcon, title: "A verified badge", text: "Verified sellers are marked on every listing and in search." },
  { icon: UsersThreeIcon, title: "Buyers across the UAE", text: "Buyers find you by category, emirate, brand and specification." },
];

/** Landing for the Figma "Sell a Product" entry points. Describes only the flow the platform supports today. */
export default function SellPage() {
  const { status, actor } = useAuth();
  const hasSeller = (actor?.sellerContexts.length ?? 0) > 0;
  const cta = status === "authenticated" && hasSeller ? { to: "/seller", label: "Go to seller portal" } : { to: "/seller/onboarding", label: "Create seller account" };
  return (
    <>
      <section className="mx-auto max-w-[1336px] px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="relative isolate grid items-center gap-10 overflow-hidden rounded-[28px] bg-[#141413] px-6 py-12 text-white sm:px-10 sm:py-16 lg:grid-cols-[1.2fr_1fr]">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(90%_120%_at_85%_10%,#3d3d36_0%,#1d1d1b_45%,#111110_100%)]" />
          <div aria-hidden className="absolute -right-24 -top-24 -z-10 size-[420px] rounded-full bg-[#f8ff2c]/10 blur-3xl" />
          <div>
            <p className="flex items-center gap-2 text-eyebrow font-bold uppercase tracking-[0.18em] text-action">
              <StorefrontIcon className="size-5" /> Sell on StockOut
            </p>
            <h1 className="mt-3 max-w-3xl font-heading text-[38px] font-bold leading-[42px] tracking-tight text-white sm:text-[56px] sm:leading-[60px]">
              Someone needs <span className="text-action">what you don’t.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-white/75">Turn surplus construction and industrial materials into revenue — and keep them out of landfill.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to={cta.to} className="inline-flex h-12 items-center gap-2 rounded-full bg-action px-7 text-base font-semibold text-action-foreground transition-colors hover:bg-action-hover">
                {cta.label} <ArrowRightIcon className="size-5" />
              </Link>
              <a href="#how-it-works" className="text-sm font-medium text-white/80 underline underline-offset-4 hover:text-white">
                How it works
              </a>
            </div>
          </div>
          <ul className="grid gap-3">
            {PERKS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-action text-action-foreground">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-heading text-base font-bold">{title}</span>
                  <span className="mt-0.5 block text-sm text-white/70">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section id="how-it-works" className="mx-auto max-w-[1336px] scroll-mt-40 px-4 py-16 sm:px-6">
        <h2 className="font-heading text-2xl font-bold text-foreground sm:text-[32px]">How it works</h2>
        <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-action-soft ring-1 ring-action-border/30">
                  <s.icon className="size-5" />
                </span>
                <span className="text-sm text-muted-foreground">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 font-heading text-lg font-bold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm text-body">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex items-start gap-3 rounded-xl bg-surface-muted p-5 text-sm text-body">
          <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-success" />
          <p>Already buying on StockOut? Use the same account — seller mode is added to your existing login.</p>
        </div>
      </section>
    </>
  );
}
