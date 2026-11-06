import * as React from "react";
import {
  CaretRightIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  DesktopIcon,
  DevicesIcon,
  KeyIcon,
  ShieldCheckIcon,
  ShieldWarningIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, humanize, timeAgo } from "@/lib/utils/format";
import { AccountTabs } from "./account-tabs";
import { ChangePasswordCard } from "./change-password-card";
import { SessionsCard } from "./sessions-card";
import { MfaCard } from "./mfa-card";
import { ActivityCard } from "./activity-card";
import { useActivityQuery, useMfaStatusQuery, useSessionsQuery } from "./queries";

type Popup = "password" | "mfa" | "sessions" | "activity" | null;

function Tile({ icon: Icon, tone = "neutral" }: { icon: React.ElementType; tone?: "neutral" | "good" | "warn" }) {
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl",
        tone === "good" ? "bg-success-soft text-success-soft-foreground" : tone === "warn" ? "bg-warning-soft text-warning-soft-foreground" : "bg-cream text-foreground",
      )}
      aria-hidden
    >
      <Icon className="size-6" />
    </span>
  );
}

/** A settings row: icon, title + status line, one action that opens a popup. */
function SettingRow({ icon, tone, title, status, action, onAction, actionVariant = "secondary" }: { icon: React.ElementType; tone?: "neutral" | "good" | "warn"; title: string; status: React.ReactNode; action: string; onAction: () => void; actionVariant?: "secondary" | "action" }) {
  return (
    <SectionCard>
      <div className="flex flex-wrap items-center gap-4">
        <Tile icon={icon} tone={tone} />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-bold text-foreground">{title}</h2>
          <div className="mt-0.5 text-sm text-muted-foreground">{status}</div>
        </div>
        <Button variant={actionVariant} onClick={onAction}>
          {action}
        </Button>
      </div>
    </SectionCard>
  );
}

function Overview({ onEnableMfa }: { onEnableMfa: () => void }) {
  const mfa = useMfaStatusQuery();
  const sessions = useSessionsQuery();
  const mfaOn = mfa.data?.enabled === true;
  const count = Array.isArray(sessions.data) ? sessions.data.filter((s) => !s.revokedAtUtc).length : undefined;
  const loading = mfa.isLoading || sessions.isLoading;
  const Chip = ({ ok, label }: { ok: boolean; label: string }) => (
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
            {mfaOn ? "Two-factor sign-in is on. Check the devices signed in to your account now and then." : "Two-factor sign-in emails you a code each time you sign in, so a stolen password alone isn't enough."}
          </p>
          {!loading && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Security checks">
              <Chip ok label="Password set" />
              <Chip ok={mfaOn} label={mfaOn ? "Two-factor on" : "Two-factor off"} />
              {count !== undefined && <Chip ok={count <= 5} label={`${count} device${count === 1 ? "" : "s"} signed in`} />}
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

/** Latest 5 sessions as a short list; the full table (with sign-out) opens in a popup. */
function DevicesPreview({ onViewAll }: { onViewAll: () => void }) {
  const q = useSessionsQuery();
  const list = (Array.isArray(q.data) ? q.data : []).filter((s) => !s.revokedAtUtc);
  return (
    <SectionCard>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Tile icon={DevicesIcon} />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-bold text-foreground">Signed-in devices</h2>
          <p className="text-sm text-muted-foreground">{q.isLoading ? "Loading…" : `${list.length} active session${list.length === 1 ? "" : "s"}. Sign out any you don't recognise.`}</p>
        </div>
        <Button variant="secondary" onClick={onViewAll}>
          Manage devices
        </Button>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {list.slice(0, 5).map((s) => (
            <li key={s.sessionId} className="flex items-center gap-3 px-4 py-3 text-sm">
              <DesktopIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{s.deviceLabel || "Web browser"}</span>
                <span className="block text-xs text-muted-foreground">Signed in {timeAgo(s.createdAtUtc) ?? formatDateTime(s.createdAtUtc)}</span>
              </span>
              {s.isCurrentSession && <Badge tone="success">This device</Badge>}
            </li>
          ))}
          {list.length > 5 && (
            <li>
              <button type="button" onClick={onViewAll} className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-muted">
                View all {list.length} sessions <CaretRightIcon className="size-4" aria-hidden />
              </button>
            </li>
          )}
        </ul>
      )}
    </SectionCard>
  );
}

/** Latest 5 security events; the filterable table opens in a popup. */
function ActivityPreview({ onViewAll }: { onViewAll: () => void }) {
  const q = useActivityQuery({ page: 1, pageSize: 5 });
  const items = q.data?.items ?? [];
  return (
    <SectionCard>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Tile icon={ClockCounterClockwiseIcon} />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-bold text-foreground">Recent activity</h2>
          <p className="text-sm text-muted-foreground">Sign-ins and security changes on your account.</p>
        </div>
        <Button variant="secondary" onClick={onViewAll}>
          View all
        </Button>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="divide-y divide-border rounded-xl border border-border">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              {a.success ? <CheckCircleIcon className="size-5 shrink-0 text-success" weight="fill" aria-label="Succeeded" /> : <XCircleIcon className="size-5 shrink-0 text-danger" weight="fill" aria-label="Failed" />}
              <span className="min-w-0 flex-1 truncate text-foreground">{humanize(a.eventType)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.occurredAtUtc) ?? formatDateTime(a.occurredAtUtc)}</span>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

export default function SecurityPage() {
  const [popup, setPopup] = React.useState<Popup>(null);
  const mfa = useMfaStatusQuery();
  const mfaOn = mfa.data?.enabled === true;
  const close = (o: boolean) => !o && setPopup(null);
  return (
    <>
      <PageHeader eyebrow="My account" title="Security" description="Your password, two-factor sign-in, signed-in devices and recent activity." />
      <AccountTabs />
      <div className="space-y-4">
        <Overview onEnableMfa={() => setPopup("mfa")} />
        <div className="grid gap-4 lg:grid-cols-2">
          <SettingRow icon={KeyIcon} title="Password" status="Use at least 12 characters." action="Change password" onAction={() => setPopup("password")} />
          <SettingRow
            icon={ShieldCheckIcon}
            tone={mfaOn ? "good" : "warn"}
            title="Two-factor sign-in"
            status={mfa.isLoading ? "Checking…" : mfaOn ? <span className="font-medium text-success-soft-foreground">On — a code is emailed at each sign-in</span> : "Off — turn it on for extra protection"}
            action={mfaOn ? "Manage" : "Turn on"}
            actionVariant={mfaOn ? "secondary" : "action"}
            onAction={() => setPopup("mfa")}
          />
        </div>
        <DevicesPreview onViewAll={() => setPopup("sessions")} />
        <ActivityPreview onViewAll={() => setPopup("activity")} />
      </div>

      <Dialog open={popup === "password"} onOpenChange={close}>
        <DialogContent title="Change password" description="Use at least 12 characters. You'll be signed out on every device, including this one.">
          <ChangePasswordCard />
        </DialogContent>
      </Dialog>
      <Dialog open={popup === "mfa"} onOpenChange={close}>
        <DialogContent title="Two-factor sign-in" description="We email you a one-time code each time you sign in.">
          <MfaCard />
        </DialogContent>
      </Dialog>
      <Dialog open={popup === "sessions"} onOpenChange={close}>
        <DialogContent size="xl" title="Signed-in devices" description="Sign out a single device, or every device at once.">
          <SessionsCard />
        </DialogContent>
      </Dialog>
      <Dialog open={popup === "activity"} onOpenChange={close}>
        <DialogContent size="xl" title="Account activity" description="Security events for your account, newest first.">
          <ActivityCard />
        </DialogContent>
      </Dialog>
    </>
  );
}
