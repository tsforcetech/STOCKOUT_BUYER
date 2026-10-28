import type * as React from "react";
import { Navigate, Outlet, useLocation } from "react-router";
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
  const { pathname } = useLocation();

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
  // Verification first: an owner who hasn't finished (or was asked to fix) verification goes straight to the steps.
  if (needsVerification(activeSeller) && !ALLOWED_BEFORE_VERIFICATION.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return <Navigate to="/seller/verify" replace />;
  }
  return <>{children ?? <Outlet />}</>;
}

/** Pages an unverified owner may still open: the steps themselves and their own account settings. */
const ALLOWED_BEFORE_VERIFICATION = ["/seller/verify", "/seller/profile", "/seller/security", "/seller/privacy"];

export function needsVerification(s: { isOwner: boolean; status: string; onboardingStatus: string; verificationStatus: string }): boolean {
  return s.isOwner && s.status === "ACTIVE" && (s.onboardingStatus === "DRAFT" || s.verificationStatus === "REJECTED");
}

export default RequireSeller;
