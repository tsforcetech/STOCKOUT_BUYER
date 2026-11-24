import * as React from "react";
import { updateConsent } from "@/lib/analytics/consent-mode";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CookieIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/misc";
import { FormError } from "@/components/forms/form-field";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { getErrorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/auth-context";
import { policiesService } from "@/services/policies.service";
import type { CookieConsentRequest, CookieConsentResponse } from "@/api/types/policies";
import { policyKeys, policyPath, usePolicies } from "@/features/legal/queries";
import { newId } from "@/lib/utils/id";

/**
 * PA-1A cookie consent. Guests are identified by an anonymous token in localStorage (`stk_cookie_token`), signed-in
 * users by their session. Until a choice is saved the server returns defaults with an all-zero id — that's when the
 * banner shows. Optional categories are never pre-selected; strictly necessary cookies can't be turned off.
 */
const TOKEN_KEY = "stk_cookie_token";
const CHOICE_KEY = "stk_cookie_choice";
const NO_CHOICE = "00000000-0000-0000-0000-000000000000";
const COOKIE_POLICY = "STK-POL-CKE-001";

export type CookieChoice = Pick<CookieConsentRequest, "functional" | "analytics" | "marketing">;
const NONE: CookieChoice = { functional: false, analytics: false, marketing: false };

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function anonymousCookieToken(): string {
  const s = storage();
  let token = s?.getItem(TOKEN_KEY) ?? null;
  if (!token) {
    token = `anon:${newId()}`;
    try {
      s?.setItem(TOKEN_KEY, token);
    } catch {
      /* private mode: token lives for this page only */
    }
  }
  return token;
}

/** The last choice this browser made explicitly, reused when the same person signs in without a saved choice. */
function rememberedChoice(): CookieChoice | null {
  try {
    const v = JSON.parse(storage()?.getItem(CHOICE_KEY) ?? "null") as CookieChoice | null;
    return v && typeof v.functional === "boolean" && typeof v.analytics === "boolean" && typeof v.marketing === "boolean" ? v : null;
  } catch {
    return null;
  }
}

function remember(choice: CookieChoice) {
  try {
    storage()?.setItem(CHOICE_KEY, JSON.stringify(choice));
  } catch {
    /* ignore */
  }
}

interface CookieConsentValue {
  /** The saved choice, or null while unknown / not chosen yet. */
  consent: CookieConsentResponse | null;
  openSettings: () => void;
}

const Ctx = React.createContext<CookieConsentValue>({ consent: null, openSettings: () => {} });
export const useCookieConsent = () => React.useContext(Ctx);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const qc = useQueryClient();
  const signedIn = status === "authenticated";
  const token = React.useMemo(() => (status === "anonymous" ? anonymousCookieToken() : null), [status]);
  const subject = signedIn ? `user:${user?.userId ?? ""}` : `anon:${token ?? ""}`;
  const ready = signedIn || (status === "anonymous" && !!token);
  const policies = usePolicies();
  const revision = policies.data?.find((p) => p.policyCode === COOKIE_POLICY)?.revisionCode;

  const prefs = useQuery({
    queryKey: policyKeys.cookies(subject),
    queryFn: ({ signal }) => policiesService.cookiePreferences(signedIn ? null : token, signal),
    enabled: ready,
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const chosen = !!prefs.data && prefs.data.cookiePreferenceId !== NO_CHOICE;
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const save = useApiMutation({
    toastOnError: false,
    mutationFn: (choice: CookieChoice) =>
      policiesService.saveCookiePreferences({ ...choice, ...(revision ? { consentRevision: revision } : {}), ...(signedIn ? {} : { anonymousToken: token }) }),
    onSuccess: (saved, choice) => {
      remember(choice);
      qc.setQueryData(policyKeys.cookies(subject), saved);
    },
  });

  // Signed in with no saved choice, but this browser already chose as a guest: carry that explicit choice over.
  const carried = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!signedIn || !prefs.data || chosen || carried.current === subject) return;
    const previous = rememberedChoice();
    if (!previous) return;
    carried.current = subject;
    save.mutate(previous);
  }, [signedIn, prefs.data, chosen, subject, save]);

  // Google Consent Mode: pass the saved choice to GTM (defaults in index.html are all denied).
  React.useEffect(() => {
    if (chosen && prefs.data) updateConsent({ functional: prefs.data.functional, analytics: prefs.data.analytics, marketing: prefs.data.marketing });
  }, [chosen, prefs.data]);

  const value = React.useMemo<CookieConsentValue>(() => ({ consent: chosen ? prefs.data! : null, openSettings: () => setSettingsOpen(true) }), [chosen, prefs.data]);
  const showBanner = ready && prefs.isSuccess && !chosen && !settingsOpen && !save.isPending && !(signedIn && rememberedChoice() && !save.isError);

  return (
    <Ctx.Provider value={value}>
      {children}
      {showBanner && (
        <CookieBanner
          busy={save.isPending}
          error={save.error ? getErrorMessage(save.error) : null}
          onChoose={(c) => save.mutate(c)}
          onCustomise={() => setSettingsOpen(true)}
        />
      )}
      <CookieSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initial={chosen && prefs.data ? { functional: prefs.data.functional, analytics: prefs.data.analytics, marketing: prefs.data.marketing } : NONE}
        busy={save.isPending}
        error={save.error ? getErrorMessage(save.error) : null}
        onSave={(c) => save.mutate(c, { onSuccess: () => setSettingsOpen(false) })}
      />
    </Ctx.Provider>
  );
}

/**
 * Slim consent bar (UX audit 22 Nov): a strip at the bottom, above the phone tab bar, that never covers the page's
 * main buttons. Same three choices and the same policy link as before; Customise opens the full settings dialog.
 */
function CookieBanner({ busy, error, onChoose, onCustomise }: { busy: boolean; error: string | null; onChoose: (c: CookieChoice) => void; onCustomise: () => void }) {
  return (
    <>
      {/* In-flow spacer: the last content of every page can scroll clear of the bar. */}
      <div aria-hidden className="h-28 sm:h-16" />
      <section aria-label="Cookie consent" className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-surface/95 shadow-raised backdrop-blur md:bottom-0">
        <h2 className="sr-only">Your cookie choices</h2>
        <div className="mx-auto flex max-w-[1336px] flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
          <p className="flex min-w-0 flex-1 items-start gap-2 text-xs leading-5 text-body sm:items-center sm:text-sm">
            <CookieIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground sm:mt-0" aria-hidden />
            <span>
              We use cookies to keep you signed in and your cart saved. Optional ones only with your OK.{" "}
              <Link to={policyPath(COOKIE_POLICY)} className="font-medium text-foreground underline underline-offset-4">
                Cookie Policy
              </Link>
            </span>
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" size="sm" onClick={() => onChoose(NONE)} disabled={busy}>
              Reject optional
            </Button>
            <Button variant="secondary" size="sm" onClick={onCustomise} disabled={busy}>
              Customise
            </Button>
            <Button variant="primary" size="sm" onClick={() => onChoose({ functional: true, analytics: true, marketing: true })} disabled={busy}>
              Accept all
            </Button>
          </div>
          <FormError message={error} />
        </div>
      </section>
    </>
  );
}

const CATEGORIES: Array<{ key: keyof CookieChoice | "necessary"; title: string; body: string }> = [
  { key: "necessary", title: "Strictly necessary", body: "Sign-in, security, load balancing and your cart. Always on — the site can't work without them." },
  { key: "functional", title: "Functional", body: "Remember preferences such as recently viewed items and display settings." },
  { key: "analytics", title: "Analytics", body: "Help us understand how the marketplace is used so we can improve it." },
  { key: "marketing", title: "Marketing", body: "Measure campaigns and show relevant StockOut offers on other sites." },
];

export function CookieSettingsDialog({
  open,
  onOpenChange,
  initial,
  busy,
  error,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: CookieChoice;
  busy: boolean;
  error: string | null;
  onSave: (choice: CookieChoice) => void;
}) {
  const [choice, setChoice] = React.useState<CookieChoice>(initial);
  React.useEffect(() => {
    if (open) setChoice(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        title="Cookie settings"
        description="Choose which optional cookies StockOut may use. You can change this any time from the footer."
        footer={
          <>
            <Button variant="secondary" onClick={() => onSave(NONE)} disabled={busy}>
              Reject optional
            </Button>
            <Button variant="primary" onClick={() => onSave(choice)} loading={busy}>
              Save choices
            </Button>
          </>
        }
      >
        <FormError message={error} />
        <ul className="divide-y divide-border">
          {CATEGORIES.map((c) => {
            const id = `cookie-${c.key}`;
            const necessary = c.key === "necessary";
            return (
              <li key={c.key} className="flex items-start gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <label htmlFor={id} className="text-sm font-medium text-foreground">
                    {c.title}
                  </label>
                  <p className="text-sm text-muted-foreground">{c.body}</p>
                </div>
                <Switch
                  id={id}
                  checked={necessary ? true : choice[c.key as keyof CookieChoice]}
                  disabled={necessary || busy}
                  onCheckedChange={(v) => !necessary && setChoice((s) => ({ ...s, [c.key]: v === true }))}
                />
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Details in the{" "}
          <Link to={policyPath(COOKIE_POLICY)} onClick={() => onOpenChange(false)} className="underline underline-offset-4">
            Cookie Policy
          </Link>
          .
        </p>
      </DialogContent>
    </Dialog>
  );
}
