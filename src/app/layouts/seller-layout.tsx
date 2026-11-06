import * as React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  BankIcon,
  DotsThreeOutlineIcon,
  HouseIcon,
  ShieldCheckIcon,
  CaretDownIcon,
  IdentificationCardIcon,
  LockKeyIcon,
  ListIcon,
  ListNumbersIcon,
  PlusIcon,
  ReceiptIcon,
  SignOutIcon,
  StorefrontIcon,
  UserIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Logo } from "@/components/common/logo";
import { ErrorBoundary } from "@/components/feedback/error-boundary";
import { PageSkeleton } from "@/components/feedback/states";
import { StatusBadge } from "@/components/common/status-badge";
import { NativeSelect } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { humanize, initials } from "@/lib/utils/format";
import { useAuth } from "@/lib/auth/auth-context";
import { useSellerMode } from "@/lib/seller/seller-context";
import { cn } from "@/lib/utils/cn";
import { ThemeSwitch } from "./site-header";
import { sellerListingsService } from "@/services/seller-listings.service";
import { correctionKeys } from "@/features/seller/lib/corrections";
import { canManageListings } from "@/features/seller/components/listing-access-notice";
import { useStripeStatus } from "@/features/seller/payouts/payout-shared";

type NavItem = {
  label: string;
  to: string;
  icon: React.ElementType;
  end?: boolean;
  /** Other pages that belong to this item (it stays highlighted there). */
  also?: string[];
  badge?: "corrections" | "payouts";
  soon?: boolean;
  /** Child pages listed under the item when it is open. */
  children?: Array<{ label: string; to: string; badge?: "corrections"; active: (path: string) => boolean }>;
};

/** Six items in three groups; sub-pages live as tabs inside their section (see SectionTabs). */
const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Sell",
    items: [
      { label: "Home", to: "/seller", icon: HouseIcon, end: true },
      {
        label: "Listings",
        to: "/seller/listings",
        icon: ListNumbersIcon,
        also: ["/seller/corrections"],
        badge: "corrections",
        children: [
          { label: "All listings", to: "/seller/listings", active: (p) => (p === "/seller/listings" || p.startsWith("/seller/listings/")) && !p.startsWith("/seller/listings/import") },
          { label: "Needs action", to: "/seller/corrections", badge: "corrections", active: (p) => p === "/seller/corrections" },
          { label: "Bulk upload", to: "/seller/listings/import", active: (p) => p.startsWith("/seller/listings/import") },
        ],
      },
    ],
  },
  {
    title: "Orders & money",
    items: [
      { label: "Orders", to: "/seller/orders", icon: ReceiptIcon, soon: true },
      { label: "Payouts", to: "/seller/payout-settings", icon: BankIcon, also: ["/seller/stripe"], badge: "payouts" },
    ],
  },
  {
    title: "Business",
    items: [
      {
        label: "Business profile",
        to: "/seller/business",
        icon: IdentificationCardIcon,
        also: ["/seller/team", "/seller/business-changes", "/seller/verify"],
        children: [
          { label: "Business & verification", to: "/seller/business", active: (p) => p === "/seller/business" || p.startsWith("/seller/verify") },
          { label: "Team", to: "/seller/team", active: (p) => p === "/seller/team" },
          { label: "Business changes", to: "/seller/business-changes", active: (p) => p === "/seller/business-changes" },
        ],
      },
    ],
  },
];

/** Counts behind the menu badges: proposals waiting for the seller, and whether payouts still need setting up. */
function useSellerBadges() {
  const { activeSeller } = useSellerMode();
  const sellerId = activeSeller?.sellerId ?? "";
  const canList = !!activeSeller && canManageListings(activeSeller);
  const corrections = useQuery({
    queryKey: correctionKeys.pending(sellerId),
    queryFn: ({ signal }) => sellerListingsService.corrections(sellerId, { status: "AWAITING_SELLER_DECISION", page: 1, pageSize: 100 }, signal),
    enabled: canList,
    staleTime: 30_000,
  });
  const stripe = useStripeStatus(activeSeller?.isOwner ? sellerId : undefined);
  return {
    corrections: corrections.data?.totalCount ?? corrections.data?.items?.length ?? 0,
    payoutsNeedAttention: !!stripe.data && stripe.data.onboardingStatus !== "COMPLETED",
  };
}



/** Leaves the portal for the home page first (seller routes would bounce to the login page), then signs out. */
function useSellerSignOut() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return React.useCallback(async () => {
    await navigate("/", { replace: true });
    await signOut();
  }, [signOut, navigate]);
}

function MenuItem({ icon: Icon, label, onSelect, tone }: { icon: React.ElementType; label: string; onSelect: () => void; tone?: "danger" }) {
  return (
    <PopoverPrimitive.Close asChild>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors",
          tone === "danger" ? "text-danger-soft-foreground hover:bg-danger-soft" : "text-foreground hover:bg-surface-muted",
        )}
      >
        <Icon className="size-[18px] shrink-0" /> {label}
      </button>
    </PopoverPrimitive.Close>
  );
}

function SellerAccountMenu() {
  const { user } = useAuth();
  const { activeSeller } = useSellerMode();
  const navigate = useNavigate();
  const signOut = useSellerSignOut();
  const name = user?.displayName || user?.firstName || user?.email || "Account";
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex cursor-pointer items-center gap-2 rounded-full border border-transparent py-0.5 pl-0.5 pr-2 transition-colors hover:border-border hover:bg-surface-muted data-[state=open]:border-border data-[state=open]:bg-surface-muted"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-ink font-heading text-xs font-bold text-ink-foreground" aria-hidden>
            {initials(name)}
          </span>
          <span className="hidden max-w-36 truncate text-sm font-medium text-foreground md:block">{name}</span>
          <CaretDownIcon className="hidden size-4 text-muted-foreground sm:block" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          className="z-50 w-72 overflow-hidden rounded-xl border border-border bg-surface text-sm shadow-raised focus:outline-none"
        >
          <div className="flex items-center gap-3 border-b border-border bg-surface-muted/60 px-4 py-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink font-heading text-sm font-bold text-ink-foreground" aria-hidden>
              {initials(name)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{name}</p>
              {user?.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
              {activeSeller && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {activeSeller.displayName || "Seller"} · {activeSeller.isOwner ? "Owner" : "Member"}
                </p>
              )}
            </div>
          </div>
          <div className="p-1.5">
            <MenuItem icon={UserIcon} label="My profile" onSelect={() => navigate("/seller/profile")} />
            <MenuItem icon={LockKeyIcon} label="Security" onSelect={() => navigate("/seller/security")} />
            <MenuItem icon={ShieldCheckIcon} label="Privacy" onSelect={() => navigate("/seller/privacy")} />
            <MenuItem icon={StorefrontIcon} label="Back to marketplace" onSelect={() => navigate("/")} />
          </div>
          <div className="border-t border-border p-1.5">
            <ThemeSwitch />
          </div>
          <div className="border-t border-border p-1.5">
            <MenuItem icon={SignOutIcon} label="Sign out" tone="danger" onSelect={() => void signOut()} />
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Sidebar footer: who is signed in, with a one-click sign out. */
function SidebarUser({ onSignOut }: { onSignOut: () => void }) {
  const { user } = useAuth();
  const name = user?.displayName || user?.firstName || user?.email || "Account";
  return (
    <div className="flex items-center gap-3">
      <Link to="/seller/profile" className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 -m-1 hover:bg-surface-muted">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink font-heading text-xs font-bold text-ink-foreground" aria-hidden>
          {initials(name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{name}</span>
          {user?.email && <span className="block truncate text-xs text-muted-foreground">{user.email}</span>}
        </span>
      </Link>
      <button
        type="button"
        onClick={onSignOut}
        aria-label="Sign out"
        title="Sign out"
        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger-soft-foreground"
      >
        <SignOutIcon className="size-5" />
      </button>
    </div>
  );
}

function SellerSwitcher() {
  const { sellers, activeSeller, setActiveSellerId } = useSellerMode();
  if (!activeSeller) return null;
  const name = activeSeller.displayName || "Unnamed seller";
  return (
    <div className="mx-5 mb-4 rounded-lg border border-border bg-surface-muted p-3">
      <div className="flex items-center gap-3">
        <Avatar name={name} className="size-9 rounded-md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground" title={name}>
            {name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {humanize(activeSeller.sellerType)} · {activeSeller.isOwner ? "Owner" : "Member"}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1">
        <StatusBadge value={activeSeller.verificationStatus} />
        {activeSeller.status !== "ACTIVE" && <StatusBadge value={activeSeller.status} />}
      </div>
      {sellers.length > 1 && (
        <div className="mt-3 border-t border-border pt-3">
          <label htmlFor="seller-switcher" className="mb-1 block text-xs text-muted-foreground">
            Switch seller account
          </label>
          <NativeSelect
            id="seller-switcher"
            className="h-9 bg-surface text-sm"
            value={activeSeller.sellerId}
            onChange={(e) => setActiveSellerId(e.target.value)}
          >
            {sellers.map((s) => (
              <option key={s.sellerId} value={s.sellerId}>
                {s.displayName || "Unnamed seller"}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
    </div>
  );
}

function navActive(item: NavItem, pathname: string): boolean {
  if (item.end) return pathname === item.to;
  return [item.to, ...(item.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function SellerNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const badges = useSellerBadges();
  // Open/closed per parent, chosen by the seller; by default only the section you're in is open.
  const [openState, setOpenState] = React.useState<Record<string, boolean>>({});
  return (
    <nav aria-label="Seller" className="flex-1 overflow-y-auto px-5 pb-4">
      {NAV_GROUPS.map((g) => (
        <div key={g.title} className="mb-4">
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</p>
          <ul className="space-y-1">
            {g.items.map((item) => {
              const active = navActive(item, pathname);
              const count = item.badge === "corrections" ? badges.corrections : 0;
              const warn = item.badge === "payouts" && badges.payoutsNeedAttention;
              const showChildren = !!item.children && (openState[item.to] ?? active);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={(e) => {
                      if (item.children) {
                        // Clicking an open parent you're already in just folds/unfolds it.
                        if (active) {
                          e.preventDefault();
                          setOpenState((o) => ({ ...o, [item.to]: !showChildren }));
                          return;
                        }
                        setOpenState((o) => ({ ...o, [item.to]: true }));
                      }
                      onNavigate?.();
                    }}
                    aria-current={active && !item.children ? "page" : undefined}
                    aria-expanded={item.children ? showChildren : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors",
                      active && !item.children
                        ? "bg-ink font-medium text-ink-foreground"
                        : active
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {count > 0 && !showChildren && (
                      <span className="rounded-full bg-action px-1.5 text-xs font-bold text-action-foreground" aria-label={`${count} need your action`}>
                        {count}
                      </span>
                    )}
                    {warn && <span className="size-2 rounded-full bg-warning" aria-label="Needs setting up" title="Payout account not set up" />}
                    {item.soon && <span className={cn("rounded px-1.5 text-[10px] font-semibold uppercase", active ? "bg-white/15" : "bg-surface-muted text-muted-foreground")}>Soon</span>}
                    {item.children && <CaretDownIcon className={cn("size-4 shrink-0 transition-transform", showChildren ? "rotate-180" : "")} aria-hidden />}
                  </Link>
                  {showChildren && (
                    <ul className="ml-[22px] mt-1 space-y-0.5 border-l border-border pl-3" aria-label={`${item.label} pages`}>
                      {item.children!.map((c) => {
                        const on = c.active(pathname);
                        const n = c.badge === "corrections" ? badges.corrections : 0;
                        return (
                          <li key={c.to}>
                            <Link
                              to={c.to}
                              onClick={onNavigate}
                              aria-current={on ? "page" : undefined}
                              className={cn(
                                "flex h-8 items-center gap-2 rounded-md px-2.5 text-sm transition-colors",
                                on ? "bg-ink font-medium text-ink-foreground" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                              )}
                            >
                              <span className="min-w-0 flex-1 truncate">{c.label}</span>
                              {n > 0 && (
                                <span className="rounded-full bg-action px-1.5 text-xs font-bold text-action-foreground" aria-label={`${n} need your action`}>
                                  {n}
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Phones: the four most used destinations at the thumb, everything else under More (the full menu). */
function MobileTabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { pathname } = useLocation();
  const badges = useSellerBadges();
  const items: Array<{ label: string; to: string; icon: React.ElementType; active: boolean; count?: number }> = [
    { label: "Home", to: "/seller", icon: HouseIcon, active: pathname === "/seller" },
    { label: "Listings", to: "/seller/listings", icon: ListNumbersIcon, active: pathname.startsWith("/seller/listings") || pathname === "/seller/corrections", count: badges.corrections },
  ];
  const right: typeof items = [{ label: "Orders", to: "/seller/orders", icon: ReceiptIcon, active: pathname.startsWith("/seller/orders") }];
  const tab = (i: (typeof items)[number]) => (
    <Link key={i.to} to={i.to} aria-current={i.active ? "page" : undefined} className={cn("relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]", i.active ? "font-semibold text-foreground" : "text-muted-foreground")}>
      <i.icon className="size-6" weight={i.active ? "fill" : "regular"} />
      {i.label}
      {!!i.count && <span className="absolute right-[calc(50%-20px)] top-1 rounded-full bg-action px-1 text-[10px] font-bold text-action-foreground">{i.count}</span>}
    </Link>
  );
  return (
    <nav aria-label="Seller shortcuts" className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map(tab)}
      <div className="flex flex-1 items-center justify-center">
        <Link to="/seller/listings/quick" aria-label="Add listing" className="flex size-12 -translate-y-3 items-center justify-center rounded-full bg-action text-action-foreground shadow-raised ring-4 ring-surface">
          <PlusIcon className="size-6" weight="bold" />
        </Link>
      </div>
      {right.map(tab)}
      <button type="button" onClick={onMore} aria-expanded={moreOpen} className={cn("relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px]", moreOpen ? "font-semibold text-foreground" : "text-muted-foreground")}>
        <DotsThreeOutlineIcon className="size-6" weight={moreOpen ? "fill" : "regular"} />
        More
        {badges.payoutsNeedAttention && <span className="absolute right-[calc(50%-16px)] top-2 size-2 rounded-full bg-warning" aria-hidden />}
      </button>
    </nav>
  );
}

/** Seller portal shell: admin-console design system (white sidebar, grey canvas). */
export function SellerLayout() {
  const [open, setOpen] = React.useState(false);
  const signOut = useSellerSignOut();
  const location = useLocation();
  React.useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="sticky top-0 z-30 flex h-[64px] items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex size-9 cursor-pointer items-center justify-center rounded-md lg:hidden"
          aria-label="Seller menu"
          aria-expanded={open}
        >
          {open ? (
            <XIcon className="size-6" />
          ) : (
            <ListIcon className="size-6" />
          )}
        </button>
        <Link to="/seller" className="flex items-center gap-2">
          <Logo />
          <span className="rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-foreground ring-1 ring-inset ring-ink-foreground/20">
            Seller
          </span>
        </Link>
        <Link
          to="/"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-secondary-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted"
        >
          <ArrowLeftIcon className="hidden size-4 sm:block" />{" "}
          <span className="hidden sm:inline">Back to marketplace</span>
          <span className="sm:hidden">Shop</span>
        </Link>
        <SellerAccountMenu />
      </header>
      <div className="flex flex-1">
        {open && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 bottom-0 top-[64px] z-20 cursor-default bg-black/40 lg:hidden"
          />
        )}
        <aside
          className={cn(
            "w-[250px] shrink-0 flex-col border-r border-border bg-surface pt-5 lg:sticky lg:top-[64px] lg:flex lg:h-[calc(100dvh-64px)]",
            open
              ? "fixed bottom-0 left-0 top-[64px] z-30 flex h-[calc(100dvh-64px)] overflow-y-auto overscroll-contain shadow-raised"
              : "hidden",
          )}
        >
          <SellerSwitcher />
          <SellerNav onNavigate={() => setOpen(false)} />
          <div className="mt-auto border-t border-border p-4">
            <SidebarUser onSignOut={() => void signOut()} />
          </div>
        </aside>
        <main
          id="main"
          className="min-w-0 flex-1 bg-surface-muted px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:py-8"
        >
          <div className="mx-auto w-full max-w-[1200px]">
            <ErrorBoundary resetKey={location.pathname}>
              <React.Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </React.Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <MobileTabBar onMore={() => setOpen((o) => !o)} moreOpen={open} />
    </div>
  );
}
