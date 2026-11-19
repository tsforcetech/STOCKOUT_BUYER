/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
  readonly VITE_REFRESH_TOKEN_STORAGE?: string;
  readonly VITE_BASE_PATH?: string;
  /** "off" hides the launch-soon cover on the home page (default: shown). */
  readonly VITE_LAUNCH_COVER?: string;
  /** "on" shows the Stripe payment authorisation step at checkout (default: off). Needs VITE_STRIPE_PUBLISHABLE_KEY. */
  readonly VITE_PAYMENT_PREAUTH?: string;
  /** Stripe publishable TEST key (pk_test_...). Never a secret or webhook key. */
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  /** "on" shows seller fulfilment and buyer acceptance/claims on orders (default: off). */
  readonly VITE_ORDER_LIFECYCLE?: string;
  /** "on" shows SUS-03 sustainability impact reports (default: off). */
  readonly VITE_SUSTAINABILITY_REPORTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
