import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./auth-context";

export function FullScreenLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
      <div className="size-10 animate-spin rounded-full border-4 border-border border-t-action-border" />
    </div>
  );
}

/** Requires a signed-in user; otherwise sends them to /login and back afterwards. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "initializing") return <FullScreenLoader />;
  if (status === "anonymous") {
    const next = location.pathname + location.search;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

/** Keeps signed-in users away from login/register screens. */
export function RedirectIfAuthenticated() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "initializing") return <FullScreenLoader />;
  if (status === "authenticated") {
    const next = new URLSearchParams(location.search).get("next");
    return <Navigate to={next && next.startsWith("/") && !next.startsWith("//") ? next : "/"} replace />;
  }
  return <Outlet />;
}
