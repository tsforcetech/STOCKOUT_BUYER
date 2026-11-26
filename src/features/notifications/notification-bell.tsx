import * as React from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { notificationKeys } from "@/services/notifications.service";
import { onForegroundPush, refreshPush } from "@/lib/push/web-push";
import { BellIcon } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth/auth-context";
import { badgeText } from "./notification-target";
import { useUnreadNotifications } from "./use-notifications";

/** Header bell for signed-in users: opens the inbox; the badge shows unread count (hidden at 0, capped at 99+). */
export function NotificationBell() {
  const { status } = useAuth();
  const unread = useUnreadNotifications();
  const qc = useQueryClient();
  // Push already on for this browser: refresh the registration, and while the page is open turn pushes into a
  // bell/inbox refresh (no second OS notification).
  React.useEffect(() => {
    if (status !== "authenticated") return;
    let off = () => {};
    void refreshPush().then(() => onForegroundPush(() => void qc.invalidateQueries({ queryKey: notificationKeys.all })).then((f) => (off = f)));
    return () => off();
  }, [status, qc]);
  if (status !== "authenticated") return null;
  const text = badgeText(unread.data?.unreadCount);
  return (
    <Link
      to="/account/notifications"
      aria-label={text ? `Notifications, ${text} unread` : "Notifications"}
      className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-foreground transition-colors hover:border-foreground"
    >
      <BellIcon className="size-5" />
      {text && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white ring-2 ring-surface" aria-hidden>
          {text}
        </span>
      )}
    </Link>
  );
}
