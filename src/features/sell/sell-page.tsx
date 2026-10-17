import { Link } from "react-router";
import { CheckCircleIcon, IdentificationCardIcon, ListPlusIcon, MagnifyingGlassIcon, SealCheckIcon } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth/auth-context";

const STEPS = [
  { icon: IdentificationCardIcon, title: "Open a seller account", text: "Register as a business or an individual. It takes a couple of minutes." },
  { icon: SealCheckIcon, title: "Get verified", text: "Upload your verification documents. Our team reviews them before your listings go live." },
  { icon: ListPlusIcon, title: "List your surplus", text: "Add photos, specifications, quantity and price. Listings are reviewed — some categories are physically inspected." },
  { icon: MagnifyingGlassIcon, title: "Get discovered", text: "Published listings appear in search for buyers across the UAE." },
];

/** Landing for the Figma "Sell a Product" entry points. Describes only the flow the platform supports today. */
export default function SellPage() {
  const { status, actor } = useAuth();
  const hasSeller = (actor?.sellerContexts.length ?? 0) > 0;
  const cta = status === "authenticated" && hasSeller ? { to: "/seller", label: "Go to seller portal" } : { to: "/seller/onboarding", label: "Create seller account" };
  return (
    <>
      <section className="bg-cream">
        <div className="mx-auto max-w-[1336px] px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-eyebrow text-foreground">Sell on StockOut</p>
          <h1 className="mt-2 max-w-3xl font-heading text-[40px] font-bold leading-[44px] text-foreground sm:text-[56px] sm:leading-[60px]">Someone needs what you don't.</h1>
          <p className="mt-4 max-w-xl text-base text-body">Turn surplus construction and industrial materials into revenue — and keep them out of landfill.</p>
          <Link to={cta.to} className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-7 text-base font-medium text-primary-foreground hover:bg-primary-hover">
            {cta.label}
          </Link>
        </div>
      </section>
      <section className="mx-auto max-w-[1336px] px-4 py-16 sm:px-6">
        <h2 className="font-heading text-2xl font-bold text-foreground sm:text-[32px]">How it works</h2>
        <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-border p-6">
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
