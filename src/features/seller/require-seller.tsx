import type * as React from "react";
import { Navigate, Outlet } from "react-router";
import { ErrorState } from "@/components/feedback/states";
import { FullScreenLoader } from "@/lib/auth/guards";
import { useAuth } from "@/lib/auth/auth-context";
import { useSellerMode } from "@/lib/seller/seller-context";

/**
 * Guards seller-shell routes: users without a seller context (GET /marketplace/actors/me → sellerContexts)
 * are sent to /seller/onboarding. Use as a layout route (renders <Outlet/>) or as a wrapper with children.
 * Must sit below RequireAuth.
 */
export function RequireSeller({ children }: { children?: React.ReactNode }) {
  const { status, actor, actorError, reloadActor } = useAuth();
  const { activeSeller } = useSellerMode();

  if (status === "initializing") return <FullScreenLoader />;
  if (status === "anonymous") return <Navigate to={`/login?next=${encodeURIComponent("/seller")}`} replace />;
  if (!actor) {
    if (actorError) {
      return (
        <div className="mx-auto max-w-xl px-4 py-16">
          <ErrorState error={actorError} title="We couldn't load your seller accounts" onRetry={() => void reloadActor()} />
        </div>
      );
    }
    return <FullScreenLoader />;
  }
  if (!activeSeller) return <Navigate to="/seller/onboarding" replace />;
  return <>{children ?? <Outlet />}</>;
}

export default RequireSeller;
