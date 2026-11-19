import * as React from "react";
import { useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Stripe, StripeElements } from "@stripe/stripe-js";
import { ArrowsClockwiseIcon, CheckCircleIcon, CreditCardIcon, LockSimpleIcon, WarningCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useTheme } from "@/app/providers/theme";
import { isApiError } from "@/lib/api/errors";
import { formatDateTime, formatMoney } from "@/lib/utils/format";
import { newId } from "@/lib/utils/id";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { getStripe } from "@/lib/orders/stripe";
import {
  PREAUTH_CART_STALE,
  PREAUTH_LABEL,
  isProviderAuthorized,
  paymentPreAuthService,
  preAuthStore,
  preauthMessage,
  shouldKeepPolling,
  type StoredPreAuth,
} from "@/lib/orders/payment-preauth";
import type { BuyerCartResponse } from "@/api/types/buyer-commerce";
import type { CheckoutValidationResult } from "@/api/types/orders";
import type { PaymentAuthorizationStatusResponse } from "@/api/types/payment-preauth";

export const preauthKeys = { status: (attemptId: string) => ["buyer", "payment-authorization", attemptId] as const };

/** Query parameter on the Stripe return_url (3DS / redirect methods) so the page resumes the same attempt. */
export const ATTEMPT_PARAM = "payment_attempt";
/** Parameters Stripe appends to the return_url. The client secret must not stay in the address bar or history. */
const STRIPE_RETURN_PARAMS = ["payment_intent", "payment_intent_client_secret", "redirect_status"];

/** Card entry is possible in these states (the server only returns a clientSecret for them). */
const NEEDS_CARD = new Set(["REQUIRES_PAYMENT_METHOD", "REQUIRES_ACTION"]);
/** Finished attempts: a new payment needs a new attempt and a new idempotency key. */
const ENDED = new Set(["AUTHORIZATION_FAILED", "CANCELLED", "AUTHORIZATION_EXPIRED"]);

function returnUrl(attemptId: string) {
  const url = new URL("checkout", new URL(import.meta.env.BASE_URL || "/", window.location.origin));
  url.searchParams.set(ATTEMPT_PARAM, attemptId);
  return url.href;
}

/**
 * Checkout payment step: Stripe payment AUTHORISATION (manual capture), consolidated handoff 18 Nov 2026 §7.
 * Shown only while ORDER_API.paymentPreAuth is on (approved sandbox testing). The flow:
 *   POST /payment-authorizations (If-Match = reviewed cart rowVersion, Idempotency-Key) → Stripe Payment Element with
 *   the returned clientSecret → stripe.confirmPayment (Stripe handles 3DS) → poll GET /payment-authorizations/{id}.
 * The browser callback is never authoritative; only the status GET is. "Payment authorised" is a hold, not a charge,
 * and no order is created (order placement is a separate, disabled step). Card details never touch StockOut's code.
 */
export function PaymentStep({
  cart,
  cartVersion,
  readiness,
  publishableKey,
  onCartStale,
  onReadinessStale,
}: {
  cart: Pick<BuyerCartResponse, "cartId" | "buyerOrganizationId">;
  /** The cart rowVersion the buyer is reviewing (sent as If-Match). */
  cartVersion: string;
  readiness: CheckoutValidationResult | undefined;
  publishableKey: string;
  /** The cart changed elsewhere: reload it and readiness. */
  onCartStale: () => void;
  /** The total changed: re-check readiness. */
  onReadinessStale: () => void;
}) {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const returnedAttempt = params.get(ATTEMPT_PARAM);
  const [stored, setStored] = React.useState<StoredPreAuth | null>(() => {
    const s = preAuthStore.get(cart.cartId);
    if (!s) return null;
    // Coming back from Stripe (3DS) resumes that attempt; otherwise only an attempt for the cart being reviewed counts.
    if (returnedAttempt && s.attemptId === returnedAttempt) return s;
    return s.cartVersion === cartVersion ? s : null;
  });
  const attemptId = stored?.attemptId ?? null;
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [cardError, setCardError] = React.useState<string | null>(null);
  // Poll after the buyer confirms (or comes back from 3DS), not while they're typing card details.
  const [pollFrom, setPollFrom] = React.useState<number | null>(() => (returnedAttempt ? Date.now() : null));

  // Strip Stripe's return parameters (they include the client secret) from the address bar.
  React.useEffect(() => {
    if (!returnedAttempt && !STRIPE_RETURN_PARAMS.some((k) => params.has(k))) return;
    const next = new URLSearchParams(params);
    [ATTEMPT_PARAM, ...STRIPE_RETURN_PARAMS].forEach((k) => next.delete(k));
    setParams(next, { replace: true });
  }, [params, returnedAttempt, setParams]);

  const remember = (value: StoredPreAuth | null) => {
    if (value) preAuthStore.set(value);
    else preAuthStore.clear(cart.cartId);
    setStored(value);
  };

  const status = useQuery({
    queryKey: preauthKeys.status(attemptId ?? ""),
    // The secret is only fetched when card entry must resume and this page doesn't hold it (e.g. after a reload).
    queryFn: ({ signal }) => paymentPreAuthService.status(attemptId!, signal, !clientSecret),
    enabled: !!attemptId,
    retry: (n, e) => !(isApiError(e) && e.status >= 400 && e.status < 500) && n < 2,
    refetchInterval: (q) => {
      const s = q.state.data;
      if (!s || pollFrom === null) return false;
      if (isProviderAuthorized(s) || ENDED.has(s.internalStatus)) return false;
      return shouldKeepPolling(s, pollFrom) ? Math.max(1, s.recommendedPollIntervalSeconds || 5) * 1000 : false;
    },
    staleTime: 0,
  });
  const s = status.data;

  React.useEffect(() => {
    if (s?.clientSecret) setClientSecret(s.clientSecret);
  }, [s?.clientSecret]);

  // Not waiting for card details (preparing, processing, verifying): follow the server until it settles.
  React.useEffect(() => {
    if (s && pollFrom === null && !NEEDS_CARD.has(s.internalStatus) && !ENDED.has(s.internalStatus) && !isProviderAuthorized(s)) setPollFrom(Date.now());
  }, [s, pollFrom]);

  // A status the backend no longer recognises for this buyer: forget it so a new payment can start.
  React.useEffect(() => {
    if (isApiError(status.error) && (status.error.status === 404 || status.error.status === 403)) {
      setError(preauthMessage(status.error));
      remember(null);
      setClientSecret(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remember is stable in effect for this cart
  }, [status.error]);

  const total = readiness?.estimatedPayableTotal ?? null;
  const initiate = useApiMutation({
    toastOnError: false,
    mutationFn: async () => {
      // Reuse the key and body of an attempt whose outcome we never learned (timeout / network); new key otherwise.
      const pending = stored && !stored.attemptId && stored.cartVersion === cartVersion ? stored : null;
      const key: StoredPreAuth = pending ?? { cartId: cart.cartId, cartVersion, idempotencyKey: newId(), checkoutCorrelationId: newId(), expectedTotalAmount: total, attemptId: null };
      remember(key);
      const res = await paymentPreAuthService.initiate(
        {
          cartId: cart.cartId,
          cartVersion,
          purchasingOrganizationId: cart.buyerOrganizationId ?? null,
          checkoutCorrelationId: key.checkoutCorrelationId,
          expectedTotalAmount: key.expectedTotalAmount,
          currency: "AED",
          idempotencyKey: key.idempotencyKey,
        },
        cartVersion,
        key.idempotencyKey,
      );
      return { res, key };
    },
    onSuccess: ({ res, key }) => {
      setError(null);
      setClientSecret(res.clientSecret);
      remember({ ...key, attemptId: res.attemptId });
      void qc.invalidateQueries({ queryKey: preauthKeys.status(res.attemptId) });
    },
  });

  React.useEffect(() => {
    const e = initiate.error;
    if (!e) return;
    setError(preauthMessage(e));
    const code = isApiError(e) ? e.code : undefined;
    const uncertain = !isApiError(e) || e.kind === "network" || e.kind === "timeout" || e.status >= 500;
    // Keep the key only when the server may have created the attempt; a definite refusal gets a fresh key next time.
    if (!uncertain) remember(null);
    if (code && PREAUTH_CART_STALE.has(code)) onCartStale();
    if (code === "PAYMENT_PREAUTH_AMOUNT_MISMATCH" || code === "INSUFFICIENT_STOCK") onReadinessStale();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to a new error only
  }, [initiate.error]);

  const cancel = useApiMutation({
    toastOnError: false,
    mutationFn: () => paymentPreAuthService.cancel(attemptId!, "BUYER_CANCELLED"),
    onSuccess: () => {
      setError(null);
      void status.refetch();
    },
  });
  React.useEffect(() => {
    if (cancel.error) setError(preauthMessage(cancel.error));
  }, [cancel.error]);

  const startOver = () => {
    remember(null);
    setClientSecret(null);
    setPollFrom(null);
    setError(null);
    setCardError(null);
    initiate.reset();
  };

  const onConfirmed = () => {
    setPollFrom(Date.now());
    void status.refetch();
  };

  const header = (
    <div className="flex items-center gap-3 rounded-xl border border-border p-4 text-sm">
      <CreditCardIcon className="size-5 shrink-0 text-foreground" aria-hidden />
      <div>
        <p className="font-bold text-foreground">Card payment</p>
        <p className="text-muted-foreground">Your card is authorised for the total, not charged. The amount is only taken after sellers confirm your order.</p>
      </div>
    </div>
  );

  const errorBox = error && (
    <p role="alert" className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger-soft-foreground">
      {error}
    </p>
  );

  // 1. Nothing started yet (or the last attempt ended): offer to start.
  if (!attemptId || (s && ENDED.has(s.internalStatus))) {
    const ended = s && attemptId ? s : null;
    const canStart = !!readiness?.canProceed && total !== null && readiness.currency === "AED";
    // An expired reservation is re-checked (stock, price, eligibility) before another attempt.
    const recheck = ended?.internalStatus === "AUTHORIZATION_EXPIRED";
    return (
      <div className="space-y-3">
        {header}
        {ended && <EndedNotice s={ended} />}
        {errorBox}
        <div className="flex flex-wrap items-center gap-3">
          {recheck ? (
            <Button variant="secondary" onClick={() => (startOver(), onReadinessStale())}>
              <ArrowsClockwiseIcon /> Check my cart again
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (ended) startOver();
                setError(null);
                initiate.mutate();
              }}
              loading={initiate.isPending}
              disabled={!canStart}
            >
              <LockSimpleIcon /> {ended || initiate.error ? "Try again" : "Continue to card payment"}
            </Button>
          )}
          {canStart && <span className="text-sm text-muted-foreground">Amount to authorise: {formatMoney(total, readiness?.currency)}</span>}
        </div>
        {!canStart && readiness && <p className="text-xs text-muted-foreground">Card payment opens once your cart is ready for checkout (see the order summary).</p>}
      </div>
    );
  }

  if (status.isLoading || !s)
    return (
      <div className="space-y-3">
        {header}
        {status.error ? (
          <div role="alert" className="rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">
            <p>We couldn't check your payment right now.</p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => void status.refetch()}>
              <ArrowsClockwiseIcon /> Check again
            </Button>
          </div>
        ) : (
          <Skeleton className="h-24 w-full" />
        )}
        {errorBox}
      </div>
    );

  const authorised = isProviderAuthorized(s);
  const polling = pollFrom !== null && !authorised && !ENDED.has(s.internalStatus) && shouldKeepPolling(s, pollFrom);
  const needsCard = NEEDS_CARD.has(s.internalStatus);
  // Card entry always stays available while Stripe needs it (also after a decline); otherwise an unsettled state that
  // is no longer polled is "delayed" and offers a manual check, never a second payment.
  const cardStep = needsCard && !polling;
  const delayed = !authorised && !polling && !needsCard && (s.internalStatus === "RECONCILIATION_REQUIRED" || pollFrom !== null || s.isDelayedProcessing);
  const canCancel = !s.orderPlaced && (NEEDS_CARD.has(s.internalStatus) || s.internalStatus === "AUTHORIZED");

  return (
    <div className="space-y-3">
      {header}
      {authorised ? (
        <div role="status" className="rounded-lg bg-success-soft p-3 text-sm text-success-soft-foreground">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircleIcon className="size-4" weight="fill" aria-hidden /> Payment authorised
          </p>
          <p className="mt-1">
            {formatMoney(s.authorizedAmount, s.currency)} is held on your card, not charged. Your order isn't placed yet.
            {s.authorizationExpiresAtUtc && ` The hold lasts until ${formatDateTime(s.authorizationExpiresAtUtc)}.`}
          </p>
        </div>
      ) : delayed ? (
        <div role="status" className="rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">
          <p className="font-medium">Verification delayed</p>
          <p className="mt-1">We're still confirming your payment with the bank. Please don't pay again. Check again in a moment, or contact StockOut support if this doesn't clear.</p>
          {s.canManualRefresh && (
            <Button size="sm" variant="secondary" className="mt-2" loading={status.isFetching} onClick={() => (setPollFrom(Date.now()), void status.refetch())}>
              <ArrowsClockwiseIcon /> Check again
            </Button>
          )}
        </div>
      ) : polling || !cardStep ? (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-info-soft p-3 text-sm text-info-soft-foreground">
          <ArrowsClockwiseIcon className="size-4 animate-spin" aria-hidden /> {s.internalStatus === "AUTHORIZED" ? PREAUTH_LABEL.PROCESSING : (PREAUTH_LABEL[s.internalStatus] ?? PREAUTH_LABEL.PROCESSING)}
        </p>
      ) : null}

      {cardStep &&
        (clientSecret ? (
          <CardForm
            publishableKey={publishableKey}
            clientSecret={clientSecret}
            attemptId={s.attemptId}
            amount={formatMoney(s.authorizedAmount, s.currency)}
            heading={PREAUTH_LABEL[s.internalStatus]}
            onError={setCardError}
            onConfirmed={onConfirmed}
          />
        ) : (
          <Skeleton className="h-40 w-full" />
        ))}
      {cardError && cardStep && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger-soft-foreground">
          {cardError}
        </p>
      )}

      {!authorised && s.earliestReservationExpiresAtUtc && !delayed && (
        <p className="text-xs text-muted-foreground">Your items are reserved until {formatDateTime(s.earliestReservationExpiresAtUtc)}.</p>
      )}
      {errorBox}
      {canCancel && (
        <Button size="sm" variant="ghost" loading={cancel.isPending} onClick={() => (setError(null), cancel.mutate())}>
          <XCircleIcon /> Cancel payment
        </Button>
      )}
    </div>
  );
}

function EndedNotice({ s }: { s: PaymentAuthorizationStatusResponse }) {
  const text =
    s.internalStatus === "AUTHORIZATION_FAILED"
      ? s.failureMessage || "Your bank didn't authorise the payment. Nothing was charged."
      : s.internalStatus === "AUTHORIZATION_EXPIRED"
        ? "The reservation on your items expired. Check your cart is still ready, then try again."
        : "The payment was cancelled. Nothing was charged.";
  return (
    <p role="status" className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">
      <WarningCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <span className="block font-medium">{PREAUTH_LABEL[s.internalStatus] ?? s.internalStatus}</span>
        {text}
        {s.internalStatus === "AUTHORIZATION_FAILED" && s.failureCode && <span className="block text-xs">Reference: {s.failureCode}</span>}
      </span>
    </p>
  );
}

/** Stripe Payment Element. Card data goes straight to Stripe; this page only holds the short-lived clientSecret in memory. */
function CardForm({
  publishableKey,
  clientSecret,
  attemptId,
  amount,
  heading,
  onError,
  onConfirmed,
}: {
  publishableKey: string;
  clientSecret: string;
  attemptId: string;
  amount: string;
  heading: string | undefined;
  onError: (message: string | null) => void;
  onConfirmed: () => void;
}) {
  const { resolved } = useTheme();
  const host = React.useRef<HTMLDivElement>(null);
  const stripeRef = React.useRef<{ stripe: Stripe; elements: StripeElements } | null>(null);
  const [ready, setReady] = React.useState(false);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;
    setReady(false);
    setLoadFailed(false);
    getStripe(publishableKey)
      .then((stripe) => {
        if (cancelled || !host.current) return;
        if (!stripe) throw new Error("Stripe.js unavailable");
        const elements = stripe.elements({
          clientSecret,
          appearance: {
            theme: resolved === "dark" ? "night" : "stripe",
            variables: { colorPrimary: resolved === "dark" ? "#f8ff2c" : "#1a1a1a", colorDanger: "#dc2626", borderRadius: "8px" },
          },
        });
        const element = elements.create("payment", { layout: "tabs" });
        element.on("ready", () => !cancelled && setReady(true));
        element.mount(host.current);
        stripeRef.current = { stripe, elements };
        destroy = () => element.destroy();
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
      destroy?.();
      stripeRef.current = null;
    };
  }, [publishableKey, clientSecret, resolved]);

  const confirm = async () => {
    const s = stripeRef.current;
    if (!s) return;
    setBusy(true);
    onError(null);
    try {
      // Stripe handles 3DS itself; redirect-based methods come back to /checkout?payment_attempt=<id>.
      const result = await s.stripe.confirmPayment({ elements: s.elements, confirmParams: { return_url: returnUrl(attemptId) }, redirect: "if_required" });
      // Card input problems are Stripe's own buyer-facing messages; anything else is settled by the status GET.
      if (result.error && (result.error.type === "card_error" || result.error.type === "validation_error")) onError(result.error.message ?? "Check your card details and try again.");
      if (!result.error || result.error.type === "card_error") onConfirmed();
    } catch {
      onConfirmed();
    } finally {
      setBusy(false);
    }
  };

  if (loadFailed)
    return (
      <p role="alert" className="rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">
        The secure card form couldn't load. Check your connection and reload the page.
      </p>
    );

  return (
    <div className="rounded-xl border border-border p-4">
      {heading && <p className="mb-3 text-sm font-semibold text-foreground">{heading}</p>}
      <div ref={host} data-testid="payment-element" />
      {!ready && <Skeleton className="h-32 w-full" />}
      <Button className="mt-4 w-full rounded-full" size="lg" onClick={() => void confirm()} loading={busy} disabled={!ready}>
        <LockSimpleIcon /> Authorise {amount}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">Card details are entered securely with Stripe. StockOut never sees your card number.</p>
    </div>
  );
}
