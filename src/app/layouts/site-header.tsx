import * as React from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Popover as PopoverPrimitive } from "radix-ui";
import {
  ArrowRightIcon,
  LeafIcon,
  BookmarkSimpleIcon,
  ReceiptIcon,
  ShoppingCartSimpleIcon,
  HeartIcon,
  PlusIcon,
  CaretRightIcon,
  CaretDownIcon,
  ListIcon,
  MapPinIcon,
  MonitorIcon,
  MoonIcon,
  SealCheckIcon,
  SignOutIcon,
  StorefrontIcon,
  SunIcon,
  UserIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { useTheme } from "@/app/providers/theme";
import { useCart } from "@/lib/cart/cart-context";
import { useFavorites } from "@/lib/favorites/favorites-context";
import { useSellerMode } from "@/lib/seller/seller-context";
import { catalogService } from "@/services/catalog.service";
import { cn } from "@/lib/utils/cn";
import { initials } from "@/lib/utils/format";
import { searchHref } from "@/features/search/lib/search-params";
import { SearchBox } from "@/features/search/components/search-box";
import { EMIRATES } from "@/features/search/lib/search-params";

function useCategoryTree() {
  return useQuery({ queryKey: ["catalog", "tree"], queryFn: ({ signal }) => catalogService.categoryTree(signal), staleTime: 10 * 60_000 });
}

/** Figma "Buyer Nav Marketplace" mega menu: top-level categories + promo card. */
/**
 * Category mega menu (reference design): dark panel with the selected top-level category on the left,
 * its subcategories as a two-column grid on the right. Driven by the live category tree.
 */
function MarketplaceMenu({ onNavigate, onClose }: { onNavigate: () => void; onClose: () => void }) {
  const tree = useCategoryTree();
  const roots = tree.data ?? [];
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = roots.find((r) => r.categoryId === selectedId) ?? roots[0];

  if (tree.isLoading || tree.error || !selected) {
    return (
      <div className="mx-auto max-w-[1336px] px-6 py-10 text-sm text-muted-foreground">
        {tree.isLoading ? "Loading categories…" : tree.error ? "Categories are unavailable right now." : "No categories yet."}
      </div>
    );
  }

  const subs = selected.children ?? [];
  return (
    <div className="mx-auto max-w-[1336px] px-4 py-5 sm:px-6">
      <div className="grid overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-[400px_1fr]">
        <div className="bg-[#1a1a19] p-8 text-white">
          <p className="text-eyebrow font-bold tracking-[0.18em] text-action">Category</p>
          <p className="mt-3 font-heading text-[40px] font-bold leading-[44px] text-white">{selected.name}</p>
          <p className="mt-3 text-base leading-6 text-white/75">Browse available surplus inventory by material type.</p>
          <Link to={searchHref({ categoryId: selected.categoryId })} onClick={onNavigate} className="mt-6 inline-flex items-center gap-2 font-heading text-lg font-bold text-action hover:underline">
            View all {(selected.name ?? "").toLowerCase()} <ArrowRightIcon className="size-5" />
          </Link>
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Categories">
            {roots.map((r) => (
              <li key={r.categoryId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.categoryId)}
                  onMouseEnter={() => setSelectedId(r.categoryId)}
                  aria-pressed={r.categoryId === selected.categoryId}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1 text-sm",
                    r.categoryId === selected.categoryId ? "border-action bg-action text-action-foreground" : "border-white/25 text-white/85 hover:border-white",
                  )}
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-border pb-5">
            <p className="font-heading text-xl font-bold text-foreground">{subs.length ? `${selected.name} subcategories` : selected.name}</p>
            <button type="button" onClick={onClose} aria-label="Close menu" className="cursor-pointer rounded-md p-1 hover:bg-surface-muted">
              <XIcon className="size-6" />
            </button>
          </div>
          {subs.length ? (
            <ul className="mt-2 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
              {subs.map((c) => (
                <li key={c.categoryId}>
                  <Link to={searchHref({ categoryId: c.categoryId })} onClick={onNavigate} className="group flex items-center justify-between gap-4 rounded-lg px-3 py-4 hover:bg-surface-muted">
                    <span>
                      <span className="block font-heading text-lg font-bold text-foreground">{c.name}</span>
                      <span className="block text-sm text-muted-foreground">Browse available stock</span>
                    </span>
                    <CaretRightIcon className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Link to={searchHref({ categoryId: selected.categoryId })} onClick={onNavigate} className="mt-6 inline-flex items-center gap-2 text-sm text-foreground underline">
              Browse all {selected.name} stock <ArrowRightIcon className="size-4" />
            </Link>
          )}
          <div className="mt-4 border-t border-border pt-4 text-sm">
            <Link to="/categories" onClick={onNavigate} className="text-foreground underline underline-offset-4">
              Browse all categories
            </Link>
          </div>
        </div>
      </div>
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

/** dubizzle-style "Place your ad": always-visible lime call to action for selling. */
export function sellHref(status: string, hasSeller: boolean): string {
  if (status !== "authenticated") return "/login?next=%2Fseller%2Fonboarding";
  return hasSeller ? "/seller/listings/new" : "/seller/onboarding";
}

function SellButton() {
  const { status, actor } = useAuth();
  const hasSeller = (actor?.sellerContexts.length ?? 0) > 0;
  return (
    <Link
      to={sellHref(status, hasSeller)}
      className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-action px-4 font-heading text-sm font-bold text-action-foreground transition-colors hover:bg-action-hover"
    >
      <PlusIcon className="size-4" weight="bold" /> Sell
    </Link>
  );
}

function SavedButton() {
  const { favorites } = useFavorites();
  const n = favorites.length;
  return (
    <NavLink
      to="/saved"
      aria-label={n ? `Saved listings, ${n}` : "Saved listings"}
      className={({ isActive }) =>
        cn(
          "relative flex size-10 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-foreground transition-colors hover:border-foreground",
          isActive && "border-foreground",
        )
      }
    >
      <HeartIcon className="size-5" />
      {n > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e0245e] px-1 text-[11px] font-bold text-white ring-2 ring-cream" aria-hidden>
          {n > 99 ? "99+" : n}
        </span>
      )}
    </NavLink>
  );
}

function CartButton() {
  const { count, setOpen } = useCart();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}
      className="relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-surface text-foreground transition-colors hover:border-foreground"
    >
      <ShoppingCartSimpleIcon className="size-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-action px-1 text-[11px] font-bold text-action-foreground ring-2 ring-cream" aria-hidden>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

function LoginButton() {
  return (
    <Button asChild size="sm" className="h-10 px-6">
      <Link to="/login">Login</Link>
    </Button>
  );
}

function SellerEntry({ compact = false }: { compact?: boolean }) {
  const { status, actor } = useAuth();
  const hasSeller = (actor?.sellerContexts.length ?? 0) > 0;
  // Selling is a mode of the signed-in account: visitors just log in first.
  // Non-sellers use the "+ Sell" button; this link is the way back into an existing seller portal.
  if (status !== "authenticated" || (!hasSeller && !compact)) return null;
  const target = hasSeller ? { to: "/seller", label: "Seller portal" } : { to: "/seller/onboarding", label: "Start selling" };
  return (
    <Link
      to={target.to}
      className={cn(
        "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-3 font-heading text-[15px] font-bold text-foreground transition-colors hover:bg-cream-strong",
        compact && "w-full justify-center border border-foreground",
      )}
    >
      <StorefrontIcon className="size-5" /> {target.label}
    </Link>
  );
}

const THEMES = [
  ["light", "Light", SunIcon],
  ["dark", "Dark", MoonIcon],
  ["system", "System", MonitorIcon],
] as const;

/** Light / Dark / System segmented control, used in the account menu and the seller sidebar. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("grid grid-cols-3 gap-1 rounded-md bg-cream-strong p-1", className)}>
      {THEMES.map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            "flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-sm text-xs font-medium transition-colors",
            theme === value ? "bg-action text-action-foreground shadow-raised" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" /> {label}
        </button>
      ))}
    </div>
  );
}

/** Compact light/dark toggle for signed-out visitors (signed-in users get the full switch in the account menu). */
function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      className="flex size-10 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-surface text-foreground hover:border-foreground"
    >
      {resolved === "dark" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </button>
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
        <button type="button" className="flex cursor-pointer items-center gap-2.5 rounded-full py-0.5 pl-0.5 pr-2 text-left hover:bg-cream-strong" aria-label="Account menu">
          <span className="flex size-10 items-center justify-center rounded-full bg-[#1a1a19] font-heading text-sm font-bold text-action ring-2 ring-action ring-offset-2 ring-offset-cream" aria-hidden>
            {initials(user?.displayName || name)}
          </span>
          <span className="hidden leading-tight md:block">
            <span className="block text-xs text-muted-foreground">Welcome back</span>
            <span className="block max-w-32 truncate font-heading text-base font-bold text-foreground">{name}</span>
          </span>
          <CaretDownIcon className="size-4 text-foreground" />
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
            { label: "My orders", to: "/account/orders", icon: ReceiptIcon },
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
          <p className="px-2 pb-1.5 pt-1 text-xs font-medium text-muted-foreground">Theme</p>
          <ThemeSwitch className="mx-1 mb-1" />
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

/**
 * Green Points (sustainability rewards). The backend has no Green Points API yet (planned in
 * stockout docs/planning), so this shows what it is and that it's coming — never a made-up balance.
 */
function GreenPoints() {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full bg-success-soft py-1 pl-1 pr-3 text-sm font-bold text-success-soft-foreground transition-colors hover:brightness-95"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-success text-white">
            <LeafIcon className="size-[18px]" weight="fill" />
          </span>
          <span className="font-heading">Green Points</span>
          <span className="hidden rounded-full bg-surface px-1.5 py-0.5 text-[10px] 2xl:inline font-semibold uppercase tracking-wide text-muted-foreground">Soon</span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" sideOffset={10} className="z-50 w-72 rounded-lg bg-cream p-4 text-sm shadow-raised focus:outline-none">
          <p className="flex items-center gap-2 font-heading text-base font-bold text-foreground">
            <LeafIcon className="size-5 text-success" weight="fill" /> Green Points
          </p>
          <p className="mt-2 text-body">Earn points for every material you buy or sell instead of sending it to landfill, and see the impact of your reuse.</p>
          <p className="mt-3 rounded-md bg-surface px-3 py-2 text-xs text-muted-foreground">Coming soon. Your balance will appear here once Green Points is live.</p>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
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
      className={cn(
        "inline-flex h-10 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-3 text-sm font-medium text-foreground transition-colors hover:bg-cream-strong",
        menu === key && "bg-foreground text-surface hover:bg-foreground",
      )}
    >
      {label}
      <CaretDownIcon className={cn("size-3.5 transition-transform", menu === key && "rotate-180")} />
    </button>
  );

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-[#141413] text-white">
        <div className="mx-auto flex h-9 max-w-[1336px] items-center justify-between gap-4 px-4 text-xs sm:px-6">
          <p className="flex min-w-0 items-center gap-2 truncate">
            <SealCheckIcon className="size-4 shrink-0 text-action" weight="fill" />
            <span className="truncate">
              <span className="font-semibold text-action">Verified surplus marketplace</span>
              <span className="hidden text-white/70 sm:inline"> · Inspection-backed industrial stock across the UAE</span>
            </span>
          </p>
          <Link to="/sell" className="hidden shrink-0 items-center gap-1 font-medium text-white/85 hover:text-action sm:inline-flex">
            Sell your surplus <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
      </div>
      <div className="border-b border-border-strong bg-cream">
        <div className="mx-auto flex h-[72px] max-w-[1336px] items-center gap-4 px-4 sm:px-6">
          <button type="button" className="flex size-9 cursor-pointer items-center justify-center rounded-md lg:hidden" onClick={() => setMobileOpen((o) => !o)} aria-label="Menu" aria-expanded={mobileOpen}>
            {mobileOpen ? <XIcon className="size-6" /> : <ListIcon className="size-6" />}
          </button>
          <Link to="/" aria-label="StockOut home" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <div className="ml-2 hidden min-w-0 max-w-[400px] flex-1 lg:block">
            <SearchBox variant="header" />
          </div>
          <nav aria-label="Primary" className="ml-1 hidden items-center gap-1 lg:flex">
            {navItem("market", "Marketplace")}
            {navItem("sell", "Sell a Product")}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            {status === "authenticated" && (
              <span className="hidden xl:inline-flex">
                <GreenPoints />
              </span>
            )}
            {status !== "initializing" && (
              <span className="hidden md:inline-flex">
                <SellerEntry />
              </span>
            )}
            <span className="hidden md:inline-flex">
              <SellButton />
            </span>
            {status === "anonymous" && <ThemeToggle />}
            <span className="hidden sm:inline-flex">
              <SavedButton />
            </span>
            <CartButton />
            {status === "authenticated" ? <AccountMenu /> : status === "anonymous" ? <LoginButton /> : <span className="h-8 w-20 animate-pulse rounded-full bg-cream-strong" />}
          </div>
        </div>
      </div>
      {menu && (
        <>
          <div className="absolute inset-x-0 top-full z-10 border-b border-border-strong bg-cream shadow-raised">{menu === "market" ? <MarketplaceMenu onNavigate={() => setMenu(null)} onClose={() => setMenu(null)} /> : <SellMenu onNavigate={() => setMenu(null)} />}</div>
          <button type="button" aria-label="Close menu" className="fixed inset-0 top-[108px] -z-10 cursor-default" onClick={() => setMenu(null)} />
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
