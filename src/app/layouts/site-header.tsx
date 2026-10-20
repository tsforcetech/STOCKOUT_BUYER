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
  CaretRightIcon,
  CaretDownIcon,
  ListIcon,
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
import { useAuthDialog } from "@/features/auth/auth-dialog";
import { useTheme } from "@/app/providers/theme";
import { useCart } from "@/lib/cart/cart-context";
import { useFavorites } from "@/lib/favorites/favorites-context";
import { useSellerMode } from "@/lib/seller/seller-context";
import { catalogService } from "@/services/catalog.service";
import { cn } from "@/lib/utils/cn";
import { initials } from "@/lib/utils/format";
import { searchHref } from "@/features/search/lib/search-params";
import { SearchBox } from "@/features/search/components/search-box";
import { categoryIcon } from "@/features/categories/category-icon";

function useCategoryTree() {
  return useQuery({
    queryKey: ["catalog", "tree"],
    queryFn: ({ signal }) => catalogService.categoryTree(signal),
    staleTime: 10 * 60_000,
  });
}

type CategoryNode = {
  categoryId: string;
  name: string;
  children?: CategoryNode[] | null;
};

/** Width of a category tab's dropdown (the "All categories" panel spans the whole bar). */
const PANEL_WIDTH = 940;

/**
 * dubizzle-style category dropdown. Left column: `items` as bold rows (hover/focus picks one). Right: the picked
 * item's children in two columns under a "View all" header. Our catalog is mostly two levels deep, so when the
 * picked item is a leaf the right side lists its siblings ("More in <parent>") instead of an empty box.
 */
function CategoryPanel({
  parent,
  items,
  onNavigate,
}: {
  /** The tab's root category; undefined for "All categories" (items are then the roots). */
  parent?: CategoryNode;
  items: CategoryNode[];
  onNavigate: () => void;
}) {
  const [activeId, setActiveId] = React.useState(items[0]?.categoryId);
  const active = items.find((i) => i.categoryId === activeId) ?? items[0];
  if (!active) return null;
  const children = active.children ?? [];
  const isLeaf = children.length === 0;
  const list = isLeaf ? items : children;
  const ActiveIcon = categoryIcon((parent ?? active).name);
  const linkCls =
    "inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-foreground underline-offset-4 hover:underline";
  return (
    <div className="grid max-h-[min(560px,calc(100dvh-180px))] grid-cols-[minmax(0,300px)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-surface shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18),0_4px_12px_-4px_rgba(0,0,0,0.08)]">
      <ul
        className="min-h-0 overflow-y-auto overscroll-contain border-r border-border p-2"
        aria-label={parent ? `${parent.name} subcategories` : "All categories"}
      >
        {items.map((i) => {
          const on = i.categoryId === active.categoryId;
          return (
            <li key={i.categoryId}>
              <Link
                to={searchHref({ categoryId: i.categoryId })}
                onClick={onNavigate}
                onMouseEnter={() => setActiveId(i.categoryId)}
                onFocus={() => setActiveId(i.categoryId)}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-[15px] font-semibold text-foreground transition-colors",
                  on ? "bg-surface-muted" : "hover:bg-surface-muted/70",
                )}
              >
                <span className="min-w-0">{i.name}</span>
                <CaretRightIcon
                  className={cn("size-4 shrink-0 transition-opacity", on ? "opacity-100" : "opacity-0")}
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="flex min-h-0 flex-col overflow-y-auto overscroll-contain px-7 py-5">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
          <p className="min-w-0 font-heading text-lg font-bold text-foreground">
            {isLeaf && parent ? `More in ${parent.name}` : active.name}
          </p>
          <Link
            to={searchHref({ categoryId: (isLeaf && parent ? parent : active).categoryId })}
            onClick={onNavigate}
            className={linkCls}
          >
            View all <ArrowRightIcon className="size-4" />
          </Link>
        </div>
        {list.length > 0 && (
          <ul className="mt-3 grid grid-cols-2 gap-x-8">
            {list.map((c) => (
              <li key={c.categoryId}>
                <Link
                  to={searchHref({ categoryId: c.categoryId })}
                  onClick={onNavigate}
                  className={cn(
                    "-mx-2 flex min-h-[34px] items-center rounded-md px-2 py-1.5 text-[15px] leading-5 transition-colors hover:bg-surface-muted hover:text-foreground",
                    isLeaf && c.categoryId === active.categoryId ? "font-semibold text-foreground" : "text-body",
                  )}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto pt-5">
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-muted px-4 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface text-foreground">
              <ActiveIcon className="size-5" />
            </span>
            <p className="min-w-0 flex-1 text-sm text-body">
              {isLeaf ? "Looking for " : "Everything in "}
              <span className="font-semibold text-foreground">{active.name}</span>
              {isLeaf ? "?" : ""}
            </p>
            <Link to={searchHref({ categoryId: active.categoryId })} onClick={onNavigate} className={linkCls}>
              {isLeaf ? `Shop ${active.name}` : "Shop all"} <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Figma "Buyer Nav Sell" mega menu: seller entry points that exist in the product. */
/** dubizzle-style "Place your ad": always-visible lime call to action for selling. */
export function sellHref(status: string, hasSeller: boolean): string {
  if (status !== "authenticated") return "/seller/onboarding";
  return hasSeller ? "/seller/listings/new" : "/seller/onboarding";
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
        <span
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e0245e] px-1 text-[11px] font-bold text-white ring-2 ring-surface"
          aria-hidden
        >
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
      aria-label={
        count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"
      }
      className="relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-surface text-foreground transition-colors hover:border-foreground"
    >
      <ShoppingCartSimpleIcon className="size-5" />
      {count > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-action px-1 text-[11px] font-bold text-action-foreground ring-2 ring-surface"
          aria-hidden
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

function LoginButton() {
  const { openAuth } = useAuthDialog();
  return (
    <Button size="sm" className="h-10 px-6" onClick={() => openAuth()}>
      Log in
    </Button>
  );
}

function SellerEntry({ compact = false }: { compact?: boolean }) {
  const { status, actor } = useAuth();
  const { guardLink } = useAuthDialog();
  const hasSeller = (actor?.sellerContexts.length ?? 0) > 0;
  // Selling is a mode of the signed-in account: visitors log in (popup) first, then continue to the seller portal.
  if (status === "initializing") return null;
  const target =
    status !== "authenticated"
      ? { to: "/seller", label: "Start selling" }
      : hasSeller
        ? { to: "/seller", label: "Seller portal" }
        : { to: "/seller/onboarding", label: "Start selling" };
  return (
    <Link
      to={target.to}
      onClick={guardLink(target.to, "Log in or create a free account to start selling.")}
      className={cn(
        "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-3 font-heading text-[15px] font-bold text-foreground transition-colors hover:bg-surface-muted",
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
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "grid grid-cols-3 gap-1 rounded-md bg-cream-strong p-1",
        className,
      )}
    >
      {THEMES.map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            "flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-sm text-xs font-medium transition-colors",
            theme === value
              ? "bg-action text-action-foreground shadow-raised"
              : "text-muted-foreground hover:text-foreground",
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
      className="flex size-6 cursor-pointer items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
    >
      {resolved === "dark" ? (
        <SunIcon className="size-3.5" />
      ) : (
        <MoonIcon className="size-3.5" />
      )}
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
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2.5 rounded-full py-0.5 pl-0.5 pr-2 text-left hover:bg-surface-muted"
          aria-label="Account menu"
        >
          <span
            className="flex size-10 items-center justify-center rounded-full bg-[#1a1a19] font-heading text-sm font-bold text-action ring-2 ring-action ring-offset-2 ring-offset-surface"
            aria-hidden
          >
            {initials(user?.displayName || name)}
          </span>
          <span className="hidden leading-tight md:block">
            <span className="block text-xs text-muted-foreground">
              Welcome back
            </span>
            <span className="block max-w-32 truncate font-heading text-base font-bold text-foreground">
              {name}
            </span>
          </span>
          <CaretDownIcon className="size-4 text-foreground" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={10}
          className="z-50 w-64 rounded-xl border border-border bg-surface p-2 text-sm shadow-raised focus:outline-none"
        >
          <div className="px-2 py-2">
            <p className="truncate font-medium text-foreground">
              {user?.displayName || name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>
          <div className="my-1 h-px bg-border-strong" />
          {[
            {
              label: activeSeller ? "Seller portal" : "Start selling",
              to: activeSeller ? "/seller" : "/seller/onboarding",
              icon: StorefrontIcon,
            },
            { label: "My orders", to: "/account/orders", icon: ReceiptIcon },
            {
              label: "Saved searches",
              to: "/account/saved-searches",
              icon: BookmarkSimpleIcon,
            },
            { label: "My account", to: "/account", icon: UserIcon },
          ].map((i) => (
            <PopoverPrimitive.Close asChild key={i.to}>
              <button
                type="button"
                onClick={() => navigate(i.to)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-foreground hover:bg-surface-muted"
              >
                <i.icon className="size-[18px]" /> {i.label}
              </button>
            </PopoverPrimitive.Close>
          ))}
          <div className="my-1 h-px bg-border-strong" />
          <p className="px-2 pb-1.5 pt-1 text-xs font-medium text-muted-foreground">
            Theme
          </p>
          <ThemeSwitch className="mx-1 mb-1" />
          <div className="my-1 h-px bg-border-strong" />
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-danger-soft-foreground hover:bg-danger-soft"
          >
            <SignOutIcon className="size-[18px]" /> Sign out
          </button>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
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
          className="inline-flex h-6 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
        >
          <LeafIcon className="size-3.5 text-[#4ade80]" weight="fill" />
          Green Points
          <span className="rounded-full bg-white/15 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-white/80">
            Soon
          </span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={10}
          className="z-50 w-72 rounded-xl border border-border bg-surface p-4 text-sm shadow-raised focus:outline-none"
        >
          <p className="flex items-center gap-2 font-heading text-base font-bold text-foreground">
            <LeafIcon className="size-5 text-success" weight="fill" /> Green
            Points
          </p>
          <p className="mt-2 text-body">
            Earn points for every material you buy or sell instead of sending it
            to landfill, and see the impact of your reuse.
          </p>
          <p className="mt-3 rounded-md bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
            Coming soon. Your balance will appear here once Green Points is
            live.
          </p>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export function SiteHeader() {
  const { status } = useAuth();
  const tree = useCategoryTree();
  /** null = closed, "all" = every top-level category, otherwise a top-level categoryId. */
  const [menu, setMenu] = React.useState<string | null>(null);
  /** Left offset (px) of the open panel inside the category bar, so it hangs under its tab. */
  const [anchor, setAnchor] = React.useState(0);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const location = useLocation();
  const hoverTimer = React.useRef<number | undefined>(undefined);
  const barRef = React.useRef<HTMLDivElement>(null);
  const isHome = location.pathname === "/";

  React.useEffect(() => {
    setMenu(null);
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  React.useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  React.useEffect(() => {
    return () => window.clearTimeout(hoverTimer.current);
  }, []);

  /** Places the panel under `tab`, clamped so it never runs past the bar's right edge. */
  const anchorTo = (key: string, tab: HTMLElement) => {
    const bar = barRef.current;
    if (!bar || key === "all") {
      setAnchor(0);
      return;
    }
    // The bar row has 24px side padding (px-6); the panel lives in the same padded box.
    const box = bar.getBoundingClientRect();
    const inner = box.width - 48;
    const width = Math.min(PANEL_WIDTH, inner);
    const left = tab.getBoundingClientRect().left - (box.left + 24);
    setAnchor(Math.max(0, Math.min(left, inner - width)));
  };
  const openMenu = (key: string, tab: HTMLElement) => {
    anchorTo(key, tab);
    setMenu(key);
  };

  // Hover intent: open after a short pause, close after leaving the bar + panel.
  const hoverOpen = (key: string, tab: HTMLElement) => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => openMenu(key, tab), menu ? 0 : 120);
  };
  const hoverClose = () => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setMenu(null), 180);
  };
  const toggleMenu = (key: string, tab: HTMLElement) => {
    window.clearTimeout(hoverTimer.current);
    if (menu === key) setMenu(null);
    else openMenu(key, tab);
  };

  const roots = tree.data ?? [];
  const openRoot = menu && menu !== "all" ? roots.find((r) => r.categoryId === menu) : undefined;
  const panel =
    menu === "all" ? (
      roots.length > 0 && <CategoryPanel key="all" items={roots} onNavigate={() => setMenu(null)} />
    ) : openRoot && (openRoot.children?.length ?? 0) > 0 ? (
      <CategoryPanel key={openRoot.categoryId} parent={openRoot} items={openRoot.children ?? []} onNavigate={() => setMenu(null)} />
    ) : null;

  // Weight never changes between states, so opening a tab doesn't nudge its neighbours.
  const tabClass = (open: boolean) =>
    cn(
      "relative inline-flex h-full shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
      "after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:origin-center after:rounded-t-full after:bg-foreground after:transition-transform",
      open ? "text-foreground after:scale-x-100" : "text-body after:scale-x-0 hover:text-foreground",
    );

  return (
    <header className="sticky top-0 z-40">
      {/* Slim strip: trust message + secondary utilities (Green Points, theme). */}
      <div className="bg-[#141413] text-white">
        <div className="mx-auto flex h-9 max-w-[1336px] items-center justify-between gap-4 px-4 text-xs sm:px-6">
          <p className="flex min-w-0 items-center gap-2 truncate">
            <SealCheckIcon className="size-4 shrink-0 text-action" weight="fill" />
            <span className="truncate">
              <span className="font-semibold text-action">Verified surplus marketplace</span>
              <span className="hidden text-white/70 sm:inline"> · Inspection-backed industrial stock across the UAE</span>
            </span>
          </p>
          <div className="flex shrink-0 items-center gap-3">
            {status === "authenticated" && <GreenPoints />}
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="relative border-b border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {/* Main row: logo · search (hidden on home, which has the big hero search) · saved · cart · account · seller. */}
        <div className="mx-auto flex h-[72px] max-w-[1336px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
          <button
            type="button"
            className="-ml-1.5 flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-surface-muted lg:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <XIcon className="size-6" /> : <ListIcon className="size-6" />}
          </button>
          <Link to="/" aria-label="StockOut home" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <div className="mx-2 hidden min-w-0 flex-1 lg:block xl:mx-6">{!isHome && <SearchBox variant="header" animatedPlaceholder />}</div>
          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
            <span className="hidden md:inline-flex">
              <SellerEntry />
            </span>
            <span className="hidden sm:inline-flex">
              <SavedButton />
            </span>
            <CartButton />
            {status === "authenticated" ? (
              <AccountMenu />
            ) : status === "anonymous" ? (
              <LoginButton />
            ) : (
              <span className="h-10 w-20 animate-pulse rounded-full bg-surface-muted" />
            )}
          </div>
        </div>

        {/* Category bar (desktop), dubizzle-style: each tab opens its subcategories on hover or click. */}
        <nav
          aria-label="Categories"
          className="hidden border-t border-border lg:block"
          onMouseLeave={hoverClose}
          onMouseEnter={() => window.clearTimeout(hoverTimer.current)}
        >
          <div ref={barRef} className="mx-auto flex h-12 max-w-[1336px] items-stretch px-6">
            <button
              type="button"
              aria-expanded={menu === "all"}
              aria-haspopup="true"
              onClick={(e) => toggleMenu("all", e.currentTarget)}
              onMouseEnter={(e) => hoverOpen("all", e.currentTarget)}
              className={cn(tabClass(menu === "all"), "-ml-3 font-semibold text-foreground")}
            >
              <ListIcon className="size-4" /> All categories
            </button>
            <span className="mx-1 my-3 w-px bg-border-strong" aria-hidden />
            {/* Tabs that don't fully fit wrap onto a hidden second row (no half-cut labels); all are under "All categories". */}
            <div className="flex h-12 min-w-0 flex-1 flex-wrap items-stretch overflow-hidden [&>*]:h-12">
              {roots.map((c) =>
                (c.children?.length ?? 0) > 0 ? (
                  <button
                    key={c.categoryId}
                    type="button"
                    aria-expanded={menu === c.categoryId}
                    aria-haspopup="true"
                    onClick={(e) => toggleMenu(c.categoryId, e.currentTarget)}
                    onMouseEnter={(e) => hoverOpen(c.categoryId, e.currentTarget)}
                    className={tabClass(menu === c.categoryId)}
                  >
                    {c.name}
                  </button>
                ) : (
                  <Link key={c.categoryId} to={searchHref({ categoryId: c.categoryId })} onMouseEnter={hoverClose} className={tabClass(false)}>
                    {c.name}
                  </Link>
                ),
              )}
            </div>
            <Link
              to="/categories"
              onMouseEnter={hoverClose}
              className="ml-2 inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-foreground underline-offset-4 hover:underline"
            >
              Browse all <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
          {panel && (
            <div className="pointer-events-none absolute inset-x-0 top-full z-10">
              <div className="mx-auto max-w-[1336px] px-6 pt-2">
                <div
                  className="pointer-events-auto relative max-w-[940px]"
                  style={{ left: anchor }}
                  onMouseEnter={() => window.clearTimeout(hoverTimer.current)}
                >
                  {panel}
                </div>
              </div>
            </div>
          )}
        </nav>
        {panel && (
          <div
            aria-hidden
            className="absolute inset-x-0 top-full -z-10 hidden h-dvh bg-black/30 lg:block"
            onClick={() => setMenu(null)}
          />
        )}
      </div>

      {mobileOpen && (
        <div className="max-h-[calc(100dvh-108px)] overflow-y-auto border-b border-border bg-surface px-4 py-4 shadow-raised lg:hidden">
          <SearchBox variant="header" />
          <nav aria-label="Mobile" className="mt-4 flex flex-col gap-0.5 text-base">
            <Link to="/categories" className="flex items-center justify-between rounded-lg px-3 py-2.5 font-semibold text-foreground hover:bg-surface-muted">
              All categories <ArrowRightIcon className="size-4" />
            </Link>
            {roots.slice(0, 8).map((c) => (
              <Link key={c.categoryId} to={searchHref({ categoryId: c.categoryId })} className="rounded-lg px-3 py-2.5 text-body hover:bg-surface-muted">
                {c.name}
              </Link>
            ))}
            <div className="mt-3 border-t border-border pt-4">
              <SellerEntry compact />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
