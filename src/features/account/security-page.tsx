import * as React from "react";
import { CheckCircleIcon, ClockCounterClockwiseIcon, DevicesIcon, KeyIcon, ShieldCheckIcon, ShieldWarningIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils/cn";
import { AccountTabs } from "./account-tabs";
import { ChangePasswordCard } from "./change-password-card";
import { SessionsCard } from "./sessions-card";
import { MfaCard } from "./mfa-card";
import { ActivityCard } from "./activity-card";
import { useMfaStatusQuery, useSessionsQuery } from "./queries";

/** Card header: an icon tile, title and one line of explanation (optional action on the right). */
function CardHead({ icon: Icon, tone = "neutral", title, description, action }: { icon: React.ElementType; tone?: "neutral" | "good" | "warn"; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start gap-4">
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          tone === "good" ? "bg-success-soft text-success-soft-foreground" : tone === "warn" ? "bg-warning-soft text-warning-soft-foreground" : "bg-cream text-foreground",
        )}
        aria-hidden
      >
        <Icon className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-heading text-lg font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

/** At-a-glance status built from the real MFA and session data. */
function Overview({ onEnableMfa }: { onEnableMfa: () => void }) {
  const mfa = useMfaStatusQuery();
  const sessions = useSessionsQuery();
  const mfaOn = mfa.data?.enabled === true;
  const count = Array.isArray(sessions.data) ? sessions.data.length : undefined;
  const loading = mfa.isLoading || sessions.isLoading;
  const Item = ({ ok, label }: { ok: boolean; label: string }) => (
    <li className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm", ok ? "bg-success-soft text-success-soft-foreground" : "bg-warning-soft text-warning-soft-foreground")}>
      {ok ? <CheckCircleIcon className="size-4" weight="fill" aria-hidden /> : <WarningCircleIcon className="size-4" weight="fill" aria-hidden />}
      {label}
    </li>
  );
  return (
    <section aria-label="Security overview" className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white sm:p-7">
      <div aria-hidden className="absolute -right-16 -top-16 size-56 rounded-full bg-action/15 blur-3xl" />
      <div className="relative flex flex-wrap items-start gap-5">
        <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl", mfaOn ? "bg-action text-action-foreground" : "bg-white/10 text-action")} aria-hidden>
          {mfaOn ? <ShieldCheckIcon className="size-8" weight="fill" /> : <ShieldWarningIcon className="size-8" />}
        </span>
        <div className="min-w-0 flex-1">
          {loading ? (
            <Skeleton className="h-7 w-64 bg-white/10" />
          ) : (
            <p className="font-heading text-xl font-bold">{mfaOn ? "Your account is well protected" : "Add a second step to protect your account"}</p>
          )}
          <p className="mt-1 text-sm text-white/70">
            {mfaOn ? "Two-factor sign-in is on. Keep an eye on the devices signed in to your account." : "Two-factor sign-in emails you a code each time you sign in, so a stolen password alone isn't enough."}
          </p>
          {!loading && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Security checks">
              <Item ok label="Password set" />
              <Item ok={mfaOn} label={mfaOn ? "Two-factor on" : "Two-factor off"} />
              {count !== undefined && <Item ok={count <= 3} label={`${count} device${count === 1 ? "" : "s"} signed in`} />}
            </ul>
          )}
        </div>
        {!loading && !mfaOn && (
          <Button variant="action" onClick={onEnableMfa}>
            Turn on two-factor
          </Button>
        )}
      </div>
    </section>
  );
}

export default function SecurityPage() {
  const [changingPassword, setChangingPassword] = React.useState(false);
  const mfaRef = React.useRef<HTMLDivElement>(null);
  const mfa = useMfaStatusQuery();
  const mfaOn = mfa.data?.enabled === true;
  return (
    <>
      <PageHeader eyebrow="My account" title="Security" description="Your password, two-factor sign-in, signed-in devices and recent activity." />
      <AccountTabs />
      <div className="space-y-4">
        <Overview onEnableMfa={() => mfaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })} />
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard>
            <CardHead
              icon={KeyIcon}
              title="Password"
              description="Use at least 12 characters. Changing it signs you out everywhere."
              action={
                !changingPassword && (
                  <Button variant="secondary" size="sm" onClick={() => setChangingPassword(true)}>
                    Change password
                  </Button>
                )
              }
            />
            {changingPassword ? (
              <>
                <ChangePasswordCard />
                <button type="button" onClick={() => setChangingPassword(false)} className="mt-3 cursor-pointer text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
                  Cancel
                </button>
              </>
            ) : (
              <p className="rounded-lg bg-surface-muted px-4 py-3 font-mono text-lg tracking-[0.3em] text-muted-foreground" aria-label="Password is set">
                ••••••••••••
              </p>
            )}
          </SectionCard>
          <SectionCard>
            <div ref={mfaRef}>
              <CardHead icon={ShieldCheckIcon} tone={mfaOn ? "good" : "warn"} title="Two-factor sign-in" description="We email you a one-time code each time you sign in." />
              <MfaCard />
            </div>
          </SectionCard>
        </div>
        <SectionCard>
          <CardHead icon={DevicesIcon} title="Signed-in devices" description="Browsers and devices that are signed in to your account right now. Sign out any you don't recognise." />
          <SessionsCard />
        </SectionCard>
        <SectionCard>
          <CardHead icon={ClockCounterClockwiseIcon} title="Recent activity" description="Sign-ins and security changes on your account, newest first." />
          <ActivityCard />
        </SectionCard>
      </div>
    </>
  );
}
