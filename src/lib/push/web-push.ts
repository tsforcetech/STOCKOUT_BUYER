import { env } from "@/config/env";
import { notificationsService } from "@/services/notifications.service";
import { newId } from "@/lib/utils/id";

/**
 * Browser push (Firebase Cloud Messaging), per the post-deployment handoff 26 Nov 2026 §6.
 * - Off unless every public Firebase web value and the public VAPID key are configured.
 * - Permission is asked only on an explicit click (never on page load).
 * - The FCM token goes to POST /api/v1/notifications/devices and nowhere else (never logged or stored in the page).
 * - Logout / account switch revokes this browser's installation first.
 * Firebase is imported lazily so the normal page load doesn't pay for it.
 */

const INSTALLATION_KEY = "stockout.push.installation";
const ENABLED_KEY = "stockout.push.enabled";

export const pushConfigured = () => {
  const f = env.firebase;
  return !!(f.apiKey && f.authDomain && f.projectId && f.messagingSenderId && f.appId && f.vapidKey);
};

export const pushSupported = () =>
  typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window && window.isSecureContext;

export type PushState = "unavailable" | "off" | "on" | "blocked";

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* private mode: push still works for this visit */
  }
};

/** Stable per-browser id (8–100 chars) so the server can revoke this browser's registrations on logout. */
export function installationId(): string {
  const existing = read(INSTALLATION_KEY);
  if (existing && existing.length >= 8) return existing;
  const id = newId();
  write(INSTALLATION_KEY, id);
  return id;
}

export function pushState(): PushState {
  if (!pushConfigured() || !pushSupported()) return "unavailable";
  if (Notification.permission === "denied") return "blocked";
  return Notification.permission === "granted" && read(ENABLED_KEY) === "1" ? "on" : "off";
}

const swUrl = () => {
  const f = env.firebase;
  const q = new URLSearchParams({ apiKey: f.apiKey, authDomain: f.authDomain, projectId: f.projectId, messagingSenderId: f.messagingSenderId, appId: f.appId, base: import.meta.env.BASE_URL });
  return `${import.meta.env.BASE_URL}firebase-messaging-sw.js?${q}`;
};

async function messaging() {
  const [{ initializeApp, getApps }, m] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
  const f = env.firebase;
  const app = getApps()[0] ?? initializeApp({ apiKey: f.apiKey, authDomain: f.authDomain, projectId: f.projectId, messagingSenderId: f.messagingSenderId, appId: f.appId });
  if (!(await m.isSupported())) throw new Error("PUSH_UNSUPPORTED");
  return { m, messaging: m.getMessaging(app) };
}

/** Get (or refresh) this browser's token and register it with StockOut. Call after permission is granted. */
async function register(organizationId?: string | null) {
  const registration = await navigator.serviceWorker.register(swUrl(), { scope: import.meta.env.BASE_URL });
  const { m, messaging: msg } = await messaging();
  const fcmToken = await m.getToken(msg, { vapidKey: env.firebase.vapidKey, serviceWorkerRegistration: registration });
  if (!fcmToken) throw new Error("PUSH_NO_TOKEN");
  await notificationsService.registerDevice({ platform: "WEB", installationId: installationId(), fcmToken, organizationId: organizationId ?? null });
  write(ENABLED_KEY, "1");
}

/** Explicit "Turn on notifications" click. Resolves to the new state; never re-prompts after a denial. */
export async function enablePush(organizationId?: string | null): Promise<PushState> {
  if (!pushConfigured() || !pushSupported()) return "unavailable";
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  await register(organizationId);
  return "on";
}

/** Signed-in page load with push already on: refresh the registration quietly (token rotation, new session). */
export async function refreshPush(organizationId?: string | null) {
  if (pushState() !== "on") return;
  try {
    await register(organizationId);
  } catch {
    /* the inbox still works without push */
  }
}

/** "Turn off" on this browser, and logout / account switch: revoke server-side first, then forget locally. */
export async function disablePush(): Promise<void> {
  const id = read(INSTALLATION_KEY);
  write(ENABLED_KEY, null);
  if (!id) return;
  try {
    await notificationsService.revokeInstallation(id);
  } catch {
    /* best effort: the server also drops tokens FCM reports as invalid */
  }
  if (pushConfigured() && pushSupported()) {
    try {
      const { m, messaging: msg } = await messaging();
      await m.deleteToken(msg);
    } catch {
      /* ignore */
    }
  }
}

/** Foreground messages: no OS notification (the page is open); refresh the bell and inbox instead. */
export async function onForegroundPush(handler: () => void): Promise<() => void> {
  if (pushState() !== "on") return () => {};
  try {
    const { m, messaging: msg } = await messaging();
    return m.onMessage(msg, () => handler());
  } catch {
    return () => {};
  }
}
