import { Link } from "react-router";
import { Logo } from "@/components/common/logo";

/** Figma home footer (dark band with link columns and oversized wordmark). Only links to pages that exist. */
export function SiteFooter() {
  const cols = [
    { title: "Marketplace", links: [["Browse stock", "/search"], ["All categories", "/categories"]] },
    { title: "For Businesses", links: [["Sell surplus", "/sell"], ["Open seller account", "/seller/onboarding"], ["Seller portal", "/seller"]] },
    { title: "Account", links: [["Log in", "/login"], ["Register", "/register"], ["Saved searches", "/account/saved-searches"]] },
  ] as const;
  return (
    <footer className="bg-[#111110] text-white">
      <div className="mx-auto max-w-[1336px] px-4 pb-10 pt-14 sm:px-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm font-medium text-action">Our Mission</p>
            <p className="mt-3 max-w-xs text-xs leading-5 text-white/70">
              Usable materials shouldn't end up in landfill. StockOut connects the businesses that have surplus stock with the people who need it.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="text-sm font-medium text-action">{c.title}</p>
              <ul className="mt-3 space-y-2 text-xs text-white/80">
                {c.links.map(([label, to]) => (
                  <li key={to}>
                    <Link to={to} className="hover:text-white hover:underline">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 select-none font-heading text-[clamp(64px,16vw,220px)] font-bold leading-none tracking-tight text-white" aria-hidden>
          <span className="[&_*]:!text-white">
            <Logo className="!h-auto !text-[length:inherit] !text-white" />
          </span>
        </div>
        <p className="mt-6 text-xs text-white/50">© {new Date().getFullYear()} StockOut. All rights reserved.</p>
      </div>
    </footer>
  );
}
