import * as React from "react";
import { BellRingingIcon, BellSlashIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push/web-push";

/**
 * "Get notified on this browser" (handoff 26 Nov §6): browser permission is asked only on this click. Hidden when push
 * isn't configured or the browser can't do it; the inbox works the same either way.
 */
export function PushOptIn() {
  const [state, setState] = React.useState<PushState>(() => pushState());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  if (state === "unavailable") return null;

  const run = async (fn: () => Promise<PushState | void>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      setState(next ?? pushState());
    } catch {
      setError("We couldn't turn on notifications for this browser. Try again later; your inbox still works.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Browser notifications" className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted text-foreground">
        {state === "on" ? <CheckCircleIcon className="size-5 text-success" weight="fill" aria-hidden /> : state === "blocked" ? <BellSlashIcon className="size-5" aria-hidden /> : <BellRingingIcon className="size-5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold text-foreground">{state === "on" ? "Notifications are on for this browser" : state === "blocked" ? "Notifications are blocked in this browser" : "Get notified on this browser"}</p>
        <p className="text-muted-foreground">
          {state === "on"
            ? "We'll alert you about orders and account updates, even when StockOut isn't open. Alerts never show order details on your lock screen."
            : state === "blocked"
              ? "To turn them on, allow notifications for StockOut in your browser's site settings, then reload this page."
              : "Order confirmations, deliveries and account updates, even when StockOut isn't open."}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-danger">
            {error}
          </p>
        )}
      </div>
      {state === "off" && (
        <Button size="sm" loading={busy} onClick={() => void run(() => enablePush())}>
          Turn on
        </Button>
      )}
      {state === "on" && (
        <Button size="sm" variant="secondary" loading={busy} onClick={() => void run(() => disablePush())}>
          Turn off
        </Button>
      )}
    </section>
  );
}
