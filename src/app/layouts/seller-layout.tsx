import * as React from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { ArrowLeftIcon, CaretUpDownIcon, IdentificationCardIcon, ListIcon, ListNumbersIcon, PlusIcon, SquaresFourIcon, UserIcon, XIcon } from "@phosphor-icons/react";
import { Logo } from "@/components/common/logo";
import { ErrorBoundary } from "@/components/feedback/error-boundary";
import { PageSkeleton } from "@/components/feedback/states";
import { StatusBadge } from "@/components/common/status-badge";
import { useSellerMode } from "@/lib/seller/seller-context";
import { cn } from "@/lib/utils/cn";
import { ThemeSwitch } from "./site-header";

const NAV = [
  { label: "Dashboard", to: "/seller", icon: SquaresFourIcon, end: true },
  { label: "Listings", to: "/seller/listings", icon: ListNumbersIcon },
  { label: "Business & verification", to: "/seller/business", icon: IdentificationCardIcon },
  { label: "My account", to: "/account", icon: UserIcon },
];

function SellerSwitcher() {
  const { sellers, activeSeller, setActiveSellerId } = useSellerMode();
  if (!activeSeller) return null;
  return (
    <div className="px-5 pb-3">
      <label className="relative block">
        <span className="sr-only">Seller account</span>
        <select
          value={activeSeller.sellerId}
          onChange={(e) => setActiveSellerId(e.target.value)}
          disabled={sellers.length < 2}
          className="h-12 w-full cursor-pointer appearance-none rounded-md border border-border bg-surface-muted pl-3 pr-8 text-left text-sm font-medium text-foreground disabled:cursor-default"
        >
          {sellers.map((s) => (
            <option key={s.sellerId} value={s.sellerId}>
              {s.displayName}
            </option>
          ))}
        </select>
        {sellers.length > 1 && <CaretUpDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" />}
      </label>
      <div className="mt-2 flex flex-wrap gap-1">
        <StatusBadge value={activeSeller.verificationStatus} />
        {activeSeller.status !== "ACTIVE" && <StatusBadge value={activeSeller.status} />}
      </div>
    </div>
  );
}

function SellerNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Seller" className="flex-1 px-5">
      <ul className="space-y-1.5">
        {NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex h-[34px] items-center gap-2 rounded-md border px-3 text-sm transition-colors",
                  isActive ? "border-action-border bg-action text-action-foreground" : "border-transparent text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                )
              }
            >
              <item.icon className="size-5" /> {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <Link to="/seller/listings/new" onClick={onNavigate} className="mt-6 flex h-10 items-center justify-center gap-2 rounded-md border border-action-border bg-action text-sm font-medium text-action-foreground hover:bg-action-hover">
        <PlusIcon className="size-4" /> New listing
      </Link>
    </nav>
  );
}

/** Seller portal shell: admin-console design system (white sidebar, grey canvas). */
export function SellerLayout() {
  const [open, setOpen] = React.useState(false);
  const location = useLocation();
  React.useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="sticky top-0 z-30 flex h-[64px] items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex size-9 cursor-pointer items-center justify-center rounded-md lg:hidden" aria-label="Seller menu" aria-expanded={open}>
          {open ? <XIcon className="size-6" /> : <ListIcon className="size-6" />}
        </button>
        <Link to="/seller" className="flex items-center gap-2">
          <Logo />
          <span className="rounded-sm bg-foreground px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-action">Seller</span>
        </Link>
        <Link to="/" className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-secondary-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted">
          <ArrowLeftIcon className="size-4" /> <span className="hidden sm:inline">Back to marketplace</span><span className="sm:hidden">Shop</span>
        </Link>
      </header>
      <div className="flex flex-1">
        <aside className={cn("w-[250px] shrink-0 flex-col border-r border-border bg-surface pt-5 lg:sticky lg:top-[64px] lg:flex lg:h-[calc(100dvh-64px)]", open ? "fixed inset-y-[64px] left-0 z-30 flex shadow-raised" : "hidden")}>
          <SellerSwitcher />
          <SellerNav onNavigate={() => setOpen(false)} />
          <div className="mt-auto border-t border-border p-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Theme</p>
            <ThemeSwitch />
          </div>
        </aside>
        <main id="main" className="min-w-0 flex-1 bg-surface-muted px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1200px]">
            <ErrorBoundary resetKey={location.pathname}>
              <React.Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </React.Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
