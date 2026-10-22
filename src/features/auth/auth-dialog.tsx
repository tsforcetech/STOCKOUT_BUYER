import * as React from "react";
import { useLocation, useNavigate } from "react-router";
import { Dialog as DialogPrimitive } from "radix-ui";
import { LockSimpleIcon, XIcon } from "@phosphor-icons/react";
import { Logo } from "@/components/common/logo";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils/cn";
import { ForgotPasswordForm, LoginForm, RegisterForm } from "./auth-forms";

type Mode = "login" | "register" | "forgot";

export interface OpenAuthOptions {
  mode?: "login" | "register";
  /** One line above the form explaining why we're asking, e.g. "Log in to save this search." */
  reason?: string;
  /** Runs once the visitor is signed in (after the popup closes), to finish what they started. */
  onSuccess?: () => void;
}

interface AuthDialogValue {
  openAuth: (options?: OpenAuthOptions) => void;
  /** Runs `action` now when signed in; otherwise opens the popup and runs it after sign-in. */
  requireAuth: (action: () => void, reason?: string) => void;
  /** onClick for a link to a signed-in page: anonymous visitors get the popup, then go to `to`. */
  guardLink: (to: string, reason?: string) => (event: React.MouseEvent) => void;
}

const AuthDialogContext = React.createContext<AuthDialogValue | null>(null);
const ReasonContext = React.createContext<string | undefined>(undefined);

/**
 * Sign-in popup for the public site (login, registration with the emailed code, MFA and forgot password), so
 * visitors keep their place. The full /login and /register pages stay for deep links and guard redirects.
 * Must sit inside the router.
 */
export function AuthDialogProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("login");
  const [reason, setReason] = React.useState<string | undefined>();
  const [session, setSession] = React.useState(0);
  const onSuccess = React.useRef<(() => void) | undefined>(undefined);

  const openAuth = React.useCallback((options: OpenAuthOptions = {}) => {
    setMode(options.mode ?? "login");
    setReason(options.reason);
    onSuccess.current = options.onSuccess;
    setSession((s) => s + 1);
    setOpen(true);
  }, []);

  const requireAuth = React.useCallback(
    (action: () => void, reason?: string) => {
      if (status === "authenticated") action();
      else openAuth({ reason, onSuccess: action });
    },
    [status, openAuth],
  );

  const guardLink = React.useCallback(
    (to: string, reason?: string) => (event: React.MouseEvent) => {
      // While the session is still loading, or for new-tab clicks, the route guards handle it.
      if (status !== "anonymous" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      openAuth({ reason, onSuccess: () => navigate(to) });
    },
    [status, openAuth, navigate],
  );

  // Leaving the page (e.g. "I have a reset code") closes the popup.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const done = () => {
    const action = onSuccess.current;
    onSuccess.current = undefined;
    setOpen(false);
    action?.();
  };

  const value = React.useMemo(() => ({ openAuth, requireAuth, guardLink }), [openAuth, requireAuth, guardLink]);
  const toLogin = { onClick: () => setMode("login") };

  return (
    <AuthDialogContext.Provider value={value}>
      {children}
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onSuccess.current = undefined;
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
          <DialogPrimitive.Content
            aria-label={mode === "register" ? "Create an account" : mode === "forgot" ? "Reset your password" : "Log in"}
            onOpenAutoFocus={(event) => {
              // Start in the first field rather than on the close button.
              const field = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLInputElement>("input:not([type=hidden])");
              if (field) {
                event.preventDefault();
                field.focus();
              }
            }}
            className={cn(
              "fixed inset-0 z-[60] flex flex-col bg-surface shadow-raised focus:outline-none data-[state=open]:animate-[fade-in_150ms_ease-out]",
              "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:w-[460px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3 sm:border-0 sm:px-7 sm:pt-6 sm:pb-0">
              <Logo className="h-6" />
              <DialogPrimitive.Close className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "-mr-2")} aria-label="Close">
                <XIcon />
              </DialogPrimitive.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-6 sm:px-7 sm:pb-7 sm:pt-5">
              <ReasonContext.Provider value={reason}>
                {mode === "login" && (
                  <LoginForm
                    key={`login-${session}`}
                    Frame={DialogFrame}
                    title="Log in"
                    subtitle="Welcome back to StockOut."
                    onDone={done}
                    forgot={{ onClick: () => setMode("forgot") }}
                    register={{ onClick: () => setMode("register") }}
                  />
                )}
                {mode === "register" && <RegisterForm key={`register-${session}`} Frame={DialogFrame} subtitle="Buy surplus stock and sell what you don't need." onDone={done} login={toLogin} />}
                {mode === "forgot" && <ForgotPasswordForm key={`forgot-${session}`} Frame={DialogFrame} back={toLogin} onResetCode={() => setOpen(false)} />}
              </ReasonContext.Provider>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </AuthDialogContext.Provider>
  );
}

function DialogFrame({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  const reason = React.useContext(ReasonContext);
  return (
    <>
      {reason && (
        <p className="mb-5 flex items-start gap-2.5 rounded-xl bg-action-soft px-3.5 py-2.5 text-sm font-medium text-foreground">
          <LockSimpleIcon className="mt-0.5 size-4 shrink-0" weight="bold" aria-hidden />
          {reason}
        </p>
      )}
      <DialogPrimitive.Title className="font-heading text-[26px] font-bold leading-8 tracking-tight text-foreground">{title}</DialogPrimitive.Title>
      {subtitle ? (
        <DialogPrimitive.Description className="mt-1.5 text-[15px] leading-6 text-muted-foreground">{subtitle}</DialogPrimitive.Description>
      ) : (
        <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
      )}
      <div className="mt-6">{children}</div>
    </>
  );
}

/**
 * The sign-in popup's controls. Outside the provider (e.g. a page rendered on its own in a test) it falls back to
 * the full /login page, returning to where the visitor was.
 */
export function useAuthDialog(): AuthDialogValue {
  const ctx = React.useContext(AuthDialogContext);
  const { status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return React.useMemo(() => {
    if (ctx) return ctx;
    const toLogin = (mode: "login" | "register" = "login", next = `${location.pathname}${location.search}`) => navigate(`/${mode}?next=${encodeURIComponent(next)}`);
    return {
      openAuth: (options = {}) => toLogin(options.mode),
      requireAuth: (action) => (status === "authenticated" ? action() : toLogin()),
      guardLink: () => () => undefined,
    };
  }, [ctx, status, navigate, location.pathname, location.search]);
}
