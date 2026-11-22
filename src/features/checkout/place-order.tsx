import * as React from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowsClockwiseIcon, CheckCircleIcon, HourglassIcon, LockSimpleIcon, TruckIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { isApiError } from "@/lib/api/errors";
import { formatDateTime, formatMoney } from "@/lib/utils/format";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { orderKeys } from "@/services/orders.service";
import { preAuthStore } from "@/lib/orders/payment-preauth";
import {
  ORDER_PLACED_STAGES,
  PLACEMENT_CART_STALE,
  canPlaceOrder,
  hasPlacedOrder,
  isUncertainPlacement,
  orderPlacementService,
  placementKey,
  placementMessage,
  placementRequest,
} from "@/lib/orders/order-placement";
import { PLACEMENT_TEXT } from "@/lib/orders/placement-outcome";
import type { PaymentAuthorizationStatusResponse } from "@/api/types/payment-preauth";
import type { PlaceBuyerOrderResponse } from "@/api/types/order-placement";

/**
 * Last checkout step (handoff 20 Nov 2026 §4.3, §6 step 5, §7), shown under an authorised payment while
 * ORDER_API.placeOrder is on. Turns the provider-verified authorisation into an order: Collect from seller for every
 * seller, same Idempotency-Key on every retry, success only when the server says orderPlaced with an order stage.
 */
export function PlaceOrder({
  s,
  cartVersion,
  deliveryAddressId,
  onCartStale,
  onRecheck,
}: {
  s: PaymentAuthorizationStatusResponse;
  cartVersion: string;
  /** The address chosen under Delivery; freight orders need one. */
  deliveryAddressId: string | null;
  onCartStale: () => void;
  onRecheck: () => void;
}) {
  const qc = useQueryClient();
  const [placed, setPlaced] = React.useState<PlaceBuyerOrderResponse | null>(null);

  const place = useApiMutation({
    toastOnError: false,
    // BE-19: the attempt's own cart version from the server (survives a reload or a 3DS return); the page's as fallback.
    mutationFn: () => orderPlacementService.place(placementRequest(s, deliveryAddressId!), s.cartVersion || cartVersion, placementKey.get(s.attemptId, deliveryAddressId!)),
    onSuccess: (res) => {
      if (res.orderPlaced && ORDER_PLACED_STAGES.has(res.checkoutStage) && res.orderId) {
        setPlaced(res);
        placementKey.clear(s.attemptId, deliveryAddressId ?? undefined);
        preAuthStore.clear(s.cartId);
        void qc.invalidateQueries({ queryKey: ["buyer", "cart"] });
        void qc.invalidateQueries({ queryKey: orderKeys.buyerList });
      }
      // Anything else is not an order: the status re-read decides what to show.
      onRecheck();
    },
  });

  React.useEffect(() => {
    const e = place.error;
    if (isApiError(e) && e.code && PLACEMENT_CART_STALE.has(e.code)) onCartStale();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to a new error only
  }, [place.error]);

  if (placed) return <OrderPlaced orderId={placed.orderId} orderNumber={placed.orderNumber} total={formatMoney(placed.totalPayableAmount, placed.currency)} subOrders={placed.sellerSubOrders} />;
  if (hasPlacedOrder(s)) return <OrderPlaced orderId={s.orderId!} orderNumber={s.orderNumber} total={formatMoney(s.authorizedAmount, s.currency)} subOrders={[]} />;

  if (s.checkoutStage === "CHECKOUT_RECONCILIATION_REQUIRED")
    return (
      <Pending>
        We're confirming your order with the sellers. Please don't place it again. It appears in{" "}
        <Link to="/account/orders" className="font-medium underline underline-offset-2">
          My orders
        </Link>{" "}
        once confirmed.
      </Pending>
    );

  const uncertain = place.error != null && isUncertainPlacement(place.error);
  const closed = isApiError(place.error) && (place.error.status === 503 || place.error.code === "ORDER_PLACEMENT_DELIVERY_NOT_APPROVED");
  const disabled = closed || !deliveryAddressId;

  if (uncertain)
    return (
      <Pending>
        {PLACEMENT_TEXT.uncertain}
        <span className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={onRecheck}>
            <ArrowsClockwiseIcon /> Check status
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/account/orders">My orders</Link>
          </Button>
        </span>
      </Pending>
    );

  if (!canPlaceOrder(s)) return null;

  return (
    <section aria-label="Place your order" className="rounded-xl border border-border p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        <TruckIcon className="size-5" aria-hidden /> Freight delivery to your site
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Sellers confirm within 24 hours, then StockOut arranges delivery. Your card is only charged after they confirm.
      </p>
      {!deliveryAddressId && (
        <p className="mt-3 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground" role="status">
          Choose a delivery address under Delivery to place your order.
        </p>
      )}
      {place.error != null && (
        <p role="alert" className={closed ? "mt-3 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground" : "mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger-soft-foreground"}>
          {placementMessage(place.error)}
        </p>
      )}
      <Button className="mt-4 w-full rounded-full" size="lg" loading={place.isPending} disabled={disabled} onClick={() => place.mutate()}>
        <LockSimpleIcon /> {place.error && !closed ? "Try again" : `Place order · ${formatMoney(s.authorizedAmount, s.currency)}`}
      </Button>
    </section>
  );
}

function Pending({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">
      <HourglassIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

function OrderPlaced({ orderId, orderNumber, total, subOrders }: { orderId: string; orderNumber: string | null; total: string; subOrders: PlaceBuyerOrderResponse["sellerSubOrders"] }) {
  return (
    <section role="status" aria-label="Order placed" className="rounded-xl bg-success-soft p-4 text-sm text-success-soft-foreground">
      <p className="flex items-center gap-2 text-base font-bold">
        <CheckCircleIcon className="size-5" weight="fill" aria-hidden /> Order placed{orderNumber ? ` · ${orderNumber}` : ""}
      </p>
      <p className="mt-1">
        {total} is held on your card. Each seller now confirms their part; you're charged only after they confirm.
      </p>
      {subOrders.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-label="Seller orders">
          {subOrders.map((so) => (
            <li key={so.subOrderId} className="flex flex-wrap justify-between gap-x-3 rounded-lg bg-surface/60 px-3 py-2 text-foreground">
              <span className="font-medium">{so.subOrderNumber}</span>
              <span className="text-muted-foreground">
                {formatMoney(so.subOrderTotal, "AED")}
                {so.confirmationDeadlineUtc && ` · seller confirms by ${formatDateTime(so.confirmationDeadlineUtc)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button className="mt-3" size="sm" asChild>
        <Link to={`/account/orders/${orderId}`}>View order</Link>
      </Button>
    </section>
  );
}
