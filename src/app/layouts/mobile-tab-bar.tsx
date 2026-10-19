import { NavLink } from "react-router";
import {
  HeartIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth/auth-context";
import { useFavorites } from "@/lib/favorites/favorites-context";
import { cn } from "@/lib/utils/cn";
import { sellHref } from "./site-header";

/** App-style bottom navigation on phones (dubizzle pattern): Home · Search · + Sell · Saved · Account. */
export function MobileTabBar() {
  const { status, actor } = useAuth();
  const { favorites } = useFavorites();
  const hasSeller = (actor?.sellerContexts.length ?? 0) > 0;
  const tab = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
      isActive ? "text-foreground" : "text-muted-foreground",
    );

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_rgba(0,0,0,0.04)] backdrop-blur md:hidden"
    >
      <div className="flex h-16 items-stretch">
        <NavLink to="/" end className={tab}>
          {({ isActive }) => (
            <>
              <HouseIcon
                className="size-6"
                weight={isActive ? "fill" : "regular"}
              />{" "}
              Home
            </>
          )}
        </NavLink>
        <NavLink to="/search" className={tab}>
          {({ isActive }) => (
            <>
              <MagnifyingGlassIcon
                className="size-6"
                weight={isActive ? "bold" : "regular"}
              />{" "}
              Search
            </>
          )}
        </NavLink>
        <NavLink
          to={sellHref(status, hasSeller)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-foreground"
        >
          <span className="-mt-6 flex size-12 items-center justify-center rounded-full bg-action text-action-foreground shadow-raised ring-4 ring-surface">
            <PlusIcon className="size-6" weight="bold" />
          </span>
          Sell
        </NavLink>
        <NavLink to="/saved" className={tab}>
          {({ isActive }) => (
            <>
              <span className="relative">
                <HeartIcon
                  className="size-6"
                  weight={isActive ? "fill" : "regular"}
                />
                {favorites.length > 0 && (
                  <span
                    className="absolute -right-1.5 -top-1 size-2.5 rounded-full bg-[#e0245e] ring-2 ring-surface"
                    aria-hidden
                  />
                )}
              </span>
              Saved
            </>
          )}
        </NavLink>
        <NavLink
          to={status === "authenticated" ? "/account" : "/login"}
          className={tab}
        >
          {({ isActive }) => (
            <>
              <UserCircleIcon
                className="size-6"
                weight={isActive ? "fill" : "regular"}
              />{" "}
              {status === "authenticated" ? "Account" : "Log in"}
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}
