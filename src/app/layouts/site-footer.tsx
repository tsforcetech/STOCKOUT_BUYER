import { Link } from "react-router";
import { Logo } from "@/components/common/logo";

/** Figma home footer (dark band with link columns and oversized wordmark). Only links to pages that exist. */
export function SiteFooter() {
  const cols = [
    {
      title: "Marketplace",
      links: [
        ["Browse stock", "/search"],
        ["All categories", "/categories"],
        ["Saved listings", "/saved"],
        ["Cart", "/cart"],
      ],
    },
    {
      title: "For businesses",
      links: [
        ["Sell surplus", "/sell"],
        ["Open seller account", "/seller/onboarding"],
        ["Seller portal", "/seller"],
      ],
    },
    {
      title: "Account",
      links: [
        ["Log in", "/login"],
        ["Register", "/register"],
        ["Saved searches", "/account/saved-searches"],
      ],
    },
  ] as const;
  return (
    <footer className="bg-[#111110] text-white">
      <div className="mx-auto max-w-[1336px] px-4 pb-10 pt-14 sm:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-1">
            <p className="text-sm font-semibold text-action">Our mission</p>
            <p className="mt-3 max-w-xs text-sm leading-6 text-white/70">
              Usable materials shouldn't end up in landfill. StockOut connects
              the businesses that have surplus stock with the people who need
              it.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="text-sm font-semibold text-action">{c.title}</p>
              <ul className="mt-3 space-y-2.5 text-sm text-white/75">
                {c.links.map(([label, to]) => (
                  <li key={to}>
                    <Link to={to} className="transition-colors hover:text-white hover:underline underline-offset-4">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          className="mt-12 select-none font-heading text-[clamp(64px,16vw,128px)] font-bold leading-none tracking-tight text-white"
          aria-hidden
        >
          <span className="[&_*]:!text-white">
            <Logo className="!h-auto !text-[length:inherit] !text-white" />
          </span>
        </div>
        <p className="mt-6 border-t border-white/10 pt-6 text-xs text-white/50">
          © {new Date().getFullYear()} StockOut. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
