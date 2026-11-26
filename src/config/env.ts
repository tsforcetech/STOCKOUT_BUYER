function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function stripeKey(value: string | undefined): string {
  const key = (value ?? "").trim();
  return key.startsWith("pk_test_") ? key : "";
}

function firebaseWebPush() {
  const v = (x: string | undefined) => (x ?? "").trim();
  const config = {
    apiKey: v(import.meta.env.VITE_FIREBASE_API_KEY),
    authDomain: v(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: v(import.meta.env.VITE_FIREBASE_PROJECT_ID),
    messagingSenderId: v(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    appId: v(import.meta.env.VITE_FIREBASE_APP_ID),
  };
  const vapidKey = v(import.meta.env.VITE_FIREBASE_VAPID_KEY);
  return { config, vapidKey, enabled: Object.values(config).every(Boolean) && !!vapidKey };
}

export const env = {
  /** Gateway origin. Empty string means same-origin `/api` (dev proxy or reverse proxy). */
  apiBaseUrl: trimTrailingSlash(import.meta.env.VITE_API_BASE_URL ?? ""),
  refreshTokenStorage: (import.meta.env.VITE_REFRESH_TOKEN_STORAGE === "session" ? "session" : "local") as
    | "local"
    | "session",
  requestTimeoutMs: 30_000,
  /**
   * Stripe publishable key for the checkout payment step. Only a TEST key (pk_test_) is accepted while payments run in
   * the Stripe sandbox; secret (sk_) and webhook (whsec_) keys never belong in the browser.
   */
  stripePublishableKey: stripeKey(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY),
  /** Payment authorisation (Stage 8C.10) is off unless explicitly switched on AND a test key is set. */
  paymentPreAuthEnabled: import.meta.env.VITE_PAYMENT_PREAUTH === "on" && !!stripeKey(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY),
  /**
   * COM-ORD-01 order placement after a provider-verified authorisation (handoff 20 Nov 2026 §4.3). Off unless "on";
   * needs the payment step too, and only for an approved isolated sandbox (the server also gates it).
   */
  orderPlacementEnabled: import.meta.env.VITE_ORDER_PLACEMENT === "on",
  /** Sustainability banners (home, search, listing page). Off until the owner approves the photos. */
  impactBannersEnabled: import.meta.env.VITE_IMPACT_BANNERS === "on",
  /** Seller fulfilment + buyer acceptance/claims (BD-ORDER-LIFECYCLE-01). Off unless "on". */
  orderLifecycleEnabled: import.meta.env.VITE_ORDER_LIFECYCLE === "on",
  /** SUS-03 buyer/seller impact reports. Off unless "on" (Wave A public activation is policy-gated). */
  sustainabilityReportsEnabled: import.meta.env.VITE_SUSTAINABILITY_REPORTS === "on",
  /**
   * Browser push (FCM). Public web config + public VAPID key only; push is offered only when all six are set. The
   * service worker is generated from the same values at build time (firebase-messaging-sw.plugin.ts).
   */
  firebase: firebaseWebPush(),
  isDev: import.meta.env.DEV,
} as const;
