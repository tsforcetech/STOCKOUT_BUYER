import * as React from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Popover as PopoverPrimitive } from "radix-ui";
import {
  ArrowLeftIcon,
  CaretDownIcon,
  IdentificationCardIcon,
  LockKeyIcon,
  ListIcon,
  ListNumbersIcon,
  PlusIcon,
  ReceiptIcon,
  SignOutIcon,
  SquaresFourIcon,
  StorefrontIcon,
  UploadSimpleIcon,
  UserIcon,
  UsersThreeIcon,
  ClipboardTextIcon,
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

const NAV = [
  { label: "Dashboard", to: "/seller", icon: SquaresFourIcon, end: true },
  {
    label: "Listings",
    to: "/seller/listings",
    icon: ListNumbersIcon,
    notUnder: "/seller/listings/import",
  },
  { label: "Bulk import", to: "/seller/listings/import", icon: UploadSimpleIcon },
  { label: "Orders", to: "/seller/orders", icon: ReceiptIcon },
  {
    label: "Business & verification",
    to: "/seller/business",
    icon: IdentificationCardIcon,
  },
  { label: "Team", to: "/seller/team", icon: UsersThreeIcon },
  { label: "Business changes", to: "/seller/business-changes", icon: ClipboardTextIcon },
  { label: "My profile", to: "/seller/profile", icon: UserIcon },
  { label: "Security", to: "/seller/security", icon: LockKeyIcon },
];

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
            <MenuItem icon={StorefrontIcon} label="Back to marketplace" onSelect={() => navigate("/")} />
          </div>
          <div className="border-t border-border px-4 py-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Appearance</p>
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

function SellerNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Seller" className="flex-1 px-5">
      <ul className="space-y-1.5">
        {NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive: matched }) => {
                // "Listings" covers its editor pages but not the separate Bulk import pages.
                const notUnder = "notUnder" in item ? item.notUnder : undefined;
                const isActive =
                  matched && !(notUnder && pathname.startsWith(notUnder));
                return cn(
                  "flex h-[34px] items-center gap-2 rounded-md border px-3 text-sm transition-colors",
                  isActive
                    ? "border-transparent bg-ink font-medium text-ink-foreground"
                    : "border-transparent text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                );
              }}
            >
              <item.icon className="size-5" /> {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <Link
        to="/seller/listings/quick"
        onClick={onNavigate}
        className="mt-6 flex h-10 items-center justify-center gap-2 rounded-md bg-ink text-sm font-medium text-ink-foreground transition-colors hover:bg-ink-hover"
      >
        <PlusIcon className="size-4" /> Add listing
      </Link>
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
          className="min-w-0 flex-1 bg-surface-muted px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
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
    </div>
  );
}
