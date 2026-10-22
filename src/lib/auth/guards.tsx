import { Navigate, Outlet, useLocation } from "react-router";
import { BrandLoader } from "@/components/feedback/brand-loader";
import { useAuth } from "./auth-context";

export function FullScreenLoader() {
  return <BrandLoader />;
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
