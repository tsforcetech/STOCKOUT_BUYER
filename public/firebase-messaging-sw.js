/* StockOut web push service worker (Firebase Cloud Messaging, handoff 26 Nov 2026 §6).
 * The public web-app config arrives in this script's URL (set by src/lib/push/web-push.ts), so no values are hard-coded.
 * Push payloads are generic ("New notification"); a click always opens the inbox, which loads the real, authorised
 * notification from the server. Messages that carry a `notification` block are shown by the browser/FCM already, so this
 * worker only shows data-only messages (no duplicates). */
const params = new URL(self.location.href).searchParams;
const base = params.get("base") || "/";

// Registered before Firebase so a click never opens a payload-supplied URL: always the inbox.
self.addEventListener("notificationclick", (event) => {
  event.stopImmediatePropagation();
  event.notification.close();
  const target = new URL(base + "account/notifications", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(target);
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

firebase.messaging().onBackgroundMessage((payload) => {
  if (payload.notification) return; // already displayed
  return self.registration.showNotification("New notification", {
    body: "Open StockOut to view it.",
    icon: base + "apple-touch-icon.png",
    tag: "stockout-notification",
  });
});
