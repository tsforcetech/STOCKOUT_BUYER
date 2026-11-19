import type { Stripe } from "@stripe/stripe-js";

let loaded: { key: string; promise: Promise<Stripe | null> } | null = null;

/**
 * Loads Stripe.js (from js.stripe.com, as Stripe requires) only when the payment step needs it. The "pure" entry
 * doesn't inject the script on import, so pages without a payment step never load it.
 */
export function getStripe(publishableKey: string): Promise<Stripe | null> {
  if (!loaded || loaded.key !== publishableKey) {
    const promise = import("@stripe/stripe-js/pure").then((m) => m.loadStripe(publishableKey));
    promise.catch(() => {
      if (loaded?.promise === promise) loaded = null; // allow a retry after a network failure
    });
    loaded = { key: publishableKey, promise };
  }
  return loaded.promise;
}
