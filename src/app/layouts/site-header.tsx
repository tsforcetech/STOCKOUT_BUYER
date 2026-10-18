import * as React from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Popover as PopoverPrimitive } from "radix-ui";
import {
  BookmarkSimpleIcon,
  CaretDownIcon,
  ListIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  SignOutIcon,
  StorefrontIcon,
  UserIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { useSellerMode } from "@/lib/seller/seller-context";
import { catalogService } from "@/services/catalog.service";
import { cn } from "@/lib/utils/cn";
import { SearchBox } from "@/features/search/components/search-box";
import { EMIRATES } from "@/features/search/lib/search-params";

function useCategoryTree() {
  return useQuery({ queryKey: ["catalog", "tree"], queryFn: ({ signal }) => catalogService.categoryTree(signal), staleTime: 10 * 60_000 });
}

/** Figma "Buyer Nav Marketplace" mega menu: top-level categories + promo card. */
function MarketplaceMenu({ onNavigate }: { onNavigate: () => void }) {
  const tree = useCategoryTree();
  const roots = tree.data ?? [];
  return (
    <div className="mx-auto grid max-w-[1336px] grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[1fr_auto]">
      <div className="flex min-h-[260px] flex-col">
        {tree.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading categories…</p>
        ) : tree.error ? (
          <p className="text-sm text-muted-foreground">Categories are unavailable right now.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-10 gap-y-2 sm:grid-cols-2">
            {roots.map((c) => (
              <li key={c.categoryId}>
                <Link to={`/search?categoryId=${c.categoryId}`} onClick={onNavigate} className="text-lg text-foreground hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto border-t border-border-strong pt-4">
          <Link to="/categories" onClick={onNavigate} className="font-heading text-3xl text-foreground hover:underline">
            Browse all categories
          </Link>
        </div>
      </div>
      <Link to="/search" onClick={onNavigate} className="group flex w-full flex-col justify-between rounded-lg bg-cream-strong p-5 lg:w-[208px]">
        <div>
          <p className="text-xl leading-6 text-foreground">Looking for something specific?</p>
          <p className="mt-2 text-xs text-body">Go through our entire product list and find what you need.</p>
        </div>
        <span className="mt-8 border-t border-border-strong pt-3 text-base font-medium text-foreground group-hover:underline">Explore</span>
      </Link>
    </div>
  );
}

/** Figma "Buyer Nav Sell" mega menu: seller entry points that exist in the product. */
function SellMenu({ onNavigate }: { onNavigate: () => void }) {
  const cards = [
    { title: "List an item", cta: "Start listing", to: "/seller/listings/new" },
    { title: "Get verified", cta: "Open seller account", to: "/seller/onboarding" },
    { title: "How selling works", cta: "Learn more", to: "/sell" },
  ];
  return (
    <div className="mx-auto grid max-w-[1336px] grid-cols-1 gap-4 px-6 py-8 sm:grid-cols-3">
      {cards.map((c) => (
        <Link key={c.title} to={c.to} onClick={onNavigate} className="group flex h-[220px] flex-col justify-between rounded-lg bg-[linear-gradient(160deg,#2d2d2b,#111110)] p-5 text-white">
          <span className="font-heading text-2xl leading-7">{c.title}</span>
          <span className="border-t border-white/30 pt-3 text-base group-hover:underline">{c.cta}</span>
        </Link>
      ))}
    </div>
  );
}

/** Figma "Buyer Login" popover: Shop (buyer) / C2C Portal (seller) tabs. */
function LoginPopover() {
  const [tab, setTab] = React.useState<"shop" | "c2c">("shop");
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <Button size="sm" className="h-8 gap-1 px-3">
          Login <CaretDownIcon />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" sideOffset={10} className="z-50 w-[250px] rounded-lg bg-cream p-5 shadow-raised focus:outline-none">
          <div className="mb-3 grid grid-cols-2 border-b border-border-strong text-sm" role="tablist">
            {(
              [
                ["shop", "Shop"],
                ["c2c", "C2C Portal"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                type="button"
                onClick={() => setTab(key)}
                className={cn("-mb-px cursor-pointer border-b-2 pb-1.5", tab === key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "shop" ? (
            <>
              <p className="text-sm text-foreground">Log in to search, save searches and contact verified sellers.</p>
              <Button asChild className="mt-3 h-9 w-full">
                <Link to="/login">Login</Link>
              </Button>
              <p className="mt-2 text-xs text-foreground">
                Don't have an account?{" "}
                <Link to="/register" className="underline">
                  Register here
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-foreground">Sell your surplus materials by getting a verified seller account.</p>
              <Button asChild className="mt-3 h-9 w-full">
                <Link to="/login?as=seller&next=%2Fseller">Seller login</Link>
              </Button>
              <p className="mt-2 text-xs text-foreground">
                Want to find out more?{" "}
                <Link to="/sell" className="underline">
                  Click here
                </Link>
              </p>
            </>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Always-visible seller entry point in the header (easy seller login). */
function SellerEntry({ compact = false }: { compact?: boolean }) {
  const { status, actor } = useAuth();
  const hasSeller = (actor?.sellerContexts.length ?? 0) > 0;
  const target =
    status === "authenticated"
      ? hasSeller
        ? { to: "/seller", label: "Seller portal" }
        : { to: "/seller/onboarding", label: "Start selling" }
      : { to: "/login?as=seller&next=%2Fseller", label: "Seller login" };
  return (
    <Link
      to={target.to}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-foreground px-3 text-sm text-foreground transition-colors hover:bg-foreground hover:text-surface",
        compact && "w-full justify-center",
      )}
    >
      <StorefrontIcon className="size-4" /> {target.label}
    </Link>
  );
}

function AccountMenu() {
  const { user, signOut } = useAuth();
  const { activeSeller } = useSellerMode();
  const navigate = useNavigate();
  const name = user?.firstName || user?.displayName || "Account";
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3 text-sm text-primary-foreground" aria-label="Account menu">
          <UserIcon className="size-4" /> <span className="max-w-28 truncate">{name}</span> <CaretDownIcon className="size-3.5" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" sideOffset={10} className="z-50 w-60 rounded-lg bg-cream p-2 text-sm shadow-raised focus:outline-none">
          <div className="px-2 py-2">
            <p className="truncate font-medium text-foreground">{user?.displayName || name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <div className="my-1 h-px bg-border-strong" />
          {[
            { label: activeSeller ? "Seller portal" : "Start selling", to: activeSeller ? "/seller" : "/seller/onboarding", icon: StorefrontIcon },
            { label: "Saved searches", to: "/account/saved-searches", icon: BookmarkSimpleIcon },
            { label: "My account", to: "/account", icon: UserIcon },
          ].map((i) => (
            <PopoverPrimitive.Close asChild key={i.to}>
              <button type="button" onClick={() => navigate(i.to)} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-foreground hover:bg-cream-strong">
                <i.icon className="size-[18px]" /> {i.label}
              </button>
            </PopoverPrimitive.Close>
          ))}
          <div className="my-1 h-px bg-border-strong" />
          <button type="button" onClick={() => void signOut()} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-danger-soft-foreground hover:bg-danger-soft">
            <SignOutIcon className="size-[18px]" /> Sign out
          </button>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Location chip (Figma: "Dubai · 20 km radius"). The search API filters by emirate; distance is not supported. */
export function LocationPicker({ value, onChange, className }: { value: string; onChange: (emirate: string) => void; className?: string }) {
  return (
    <label className={cn("relative flex shrink-0 items-center gap-2 pl-3 pr-1", className)}>
      <MapPinIcon className="size-5 text-foreground" aria-hidden />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Location"
        className="cursor-pointer appearance-none bg-transparent pr-5 text-sm text-foreground outline-none"
      >
        <option value="">All UAE</option>
        {EMIRATES.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </select>
      <CaretDownIcon className="pointer-events-none absolute right-1 size-3.5" aria-hidden />
    </label>
  );
}

export function SiteHeader() {
  const { status } = useAuth();
  const [menu, setMenu] = React.useState<"market" | "sell" | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    setMenu(null);
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  React.useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  const navItem = (key: "market" | "sell", label: string) => (
    <button
      type="button"
      aria-expanded={menu === key}
      aria-haspopup="true"
      onClick={() => setMenu((m) => (m === key ? null : key))}
      className={cn("relative h-full cursor-pointer px-2.5 text-sm text-foreground", menu === key && "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground")}
    >
      {label}
    </button>
  );

  return (
    <header className="sticky top-0 z-40">
      <div className="border-b border-border-strong bg-cream">
        <div className="mx-auto flex h-[62px] max-w-[1336px] items-center gap-4 px-4 sm:px-6">
          <button type="button" className="flex size-9 cursor-pointer items-center justify-center rounded-md lg:hidden" onClick={() => setMobileOpen((o) => !o)} aria-label="Menu" aria-expanded={mobileOpen}>
            {mobileOpen ? <XIcon className="size-6" /> : <ListIcon className="size-6" />}
          </button>
          <Link to="/" aria-label="StockOut home" className="shrink-0">
            <Logo />
          </Link>
          <div className="ml-4 hidden w-[400px] lg:block">
            <SearchBox variant="header" />
          </div>
          <nav aria-label="Primary" className="ml-2 hidden h-full items-stretch lg:flex">
            {navItem("market", "Marketplace")}
            {navItem("sell", "Sell a Product")}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <NavLink to="/search" className="flex size-8 items-center justify-center rounded-sm border border-foreground lg:hidden" aria-label="Search">
              <MagnifyingGlassIcon className="size-4" />
            </NavLink>
            {status !== "initializing" && (
              <span className="hidden sm:inline-flex">
                <SellerEntry />
              </span>
            )}
            {status === "authenticated" ? <AccountMenu /> : status === "anonymous" ? <LoginPopover /> : <span className="h-8 w-20 animate-pulse rounded-full bg-cream-strong" />}
          </div>
        </div>
      </div>
      {menu && (
        <>
          <div className="absolute inset-x-0 top-full z-10 border-b border-border-strong bg-cream shadow-raised">{menu === "market" ? <MarketplaceMenu onNavigate={() => setMenu(null)} /> : <SellMenu onNavigate={() => setMenu(null)} />}</div>
          <button type="button" aria-label="Close menu" className="fixed inset-0 top-[62px] -z-10 cursor-default" onClick={() => setMenu(null)} />
        </>
      )}
      {mobileOpen && (
        <div className="border-b border-border-strong bg-cream px-4 py-4 lg:hidden">
          <SearchBox variant="header" />
          <nav aria-label="Mobile" className="mt-4 flex flex-col gap-1 text-base">
            <Link to="/categories" className="rounded-md px-2 py-2 hover:bg-cream-strong">Marketplace</Link>
            <Link to="/sell" className="rounded-md px-2 py-2 hover:bg-cream-strong">Sell a Product</Link>
            <div className="mt-2 sm:hidden">
              <SellerEntry compact />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
