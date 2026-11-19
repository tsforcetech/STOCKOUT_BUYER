function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function stripeKey(value: string | undefined): string {
  const key = (value ?? "").trim();
  return key.startsWith("pk_test_") ? key : "";
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
  isDev: import.meta.env.DEV,
} as const;
