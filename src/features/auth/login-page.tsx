import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/lib/auth/auth-context";
import { LoginForm } from "./auth-forms";
import { PageFrame } from "./auth-shell";
import { safeNext } from "./safe-next";

/** Full-page login, used for deep links and redirects (?next=). Header buttons open the sign-in popup instead. */
export default function LoginPage() {
  const { endReason } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const reason = params.get("reason");

  const notice =
    reason === "password-changed" ? (
      <div role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success-soft-foreground">
        Your password was changed and all sessions were signed out. Sign in with your new password.
      </div>
    ) : endReason === "expired" ? (
      <div role="status" className="rounded-md border border-action-border/40 bg-action-soft px-3 py-2 text-sm text-foreground">
        Your session has expired. Please sign in again.
      </div>
    ) : null;

  return (
    <LoginForm
      Frame={PageFrame}
      notice={notice}
      defaultEmail={params.get("email") ?? ""}
      onDone={() => navigate(safeNext(next), { replace: true })}
      forgot={{ to: "/forgot-password" }}
      register={{ to: next ? `/register?next=${encodeURIComponent(next)}` : "/register" }}
    />
  );
}
