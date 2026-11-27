import * as React from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { InfoIcon, MapPinIcon, PencilSimpleIcon, XCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { Skeleton } from "@/components/ui/misc";
import { isApiError, getErrorMessage } from "@/lib/api/errors";
import { formatMoney } from "@/lib/utils/format";
import { newId } from "@/lib/utils/id";
import { cn } from "@/lib/utils/cn";
import type { MarketplaceOrderDto, OrderReconciliationSummaryDto, SellerSubOrderDto } from "@/api/types/orders";
import { buyerOrderActions } from "@/services/buyer-order-actions.service";
import { orderKeys } from "@/services/orders.service";
import { addressKeys, addressesService, type AddressOwner } from "@/services/addresses.service";
import { addressLine } from "@/features/addresses/addresses-page";
import { deliveryAddressLines } from "@/features/checkout/order-confirmation-page";
import { statusIs } from "./order-status";

/* ------------------------------------------------------------------ rules ------------------------------------------------------------------ */
// Mirrors the server checks (OrderReconciliationRepository / BuyerOrderService, 27 Nov 2026). The server decides; these
// only hide buttons that would certainly be refused.

const DISPATCHED_STATUS = ["DELIVERED", "ACCEPTED", "CLAIM_DISPUTED", "COMPLETED"];
const DISPATCHED_FULFILMENT = ["IN_TRANSIT", "DELIVERED", "COLLECTED"];
const isDone = (s: SellerSubOrderDto) => statusIs(s.status, "CANCELLED") || statusIs(s.status, "REJECTED");
export const isDispatched = (s: SellerSubOrderDto) =>
  DISPATCHED_STATUS.some((x) => statusIs(s.status, x)) || DISPATCHED_FULFILMENT.some((x) => statusIs(s.fulfillmentStatus, x)) || !!s.deliveredAtUtc;
const terminalOrder = (o: MarketplaceOrderDto) => statusIs(o.status, "CANCELLED") || statusIs(o.status, "COMPLETED");
const activeParts = (o: MarketplaceOrderDto) => o.subOrders.filter((s) => !isDone(s));

export const canCancelOrder = (o: MarketplaceOrderDto) => !terminalOrder(o) && activeParts(o).length > 0 && !o.subOrders.some(isDispatched);
/** Cancelling one seller's part only makes sense while another part carries on. */
export const canCancelPart = (o: MarketplaceOrderDto, s: SellerSubOrderDto) => !terminalOrder(o) && !isDone(s) && !isDispatched(s) && activeParts(o).length > 1;
export const canChangeAddress = (o: MarketplaceOrderDto) => !terminalOrder(o) && activeParts(o).length > 0 && !o.subOrders.some(isDispatched) && !!o.deliveryAddressSnapshotJson;

const MESSAGES: Record<string, string> = {
  CONCURRENCY_CONFLICT: "This order changed while you were looking at it. We've reloaded it; check it and try again.",
  INVALID_ROW_VERSION: "This order needs reloading. We've refreshed it; try again.",
  CANCELLATION_BLOCKED: "This order can't be cancelled any more.",
  SUB_ORDER_NOT_FOUND: "We couldn't find that part of the order. We've reloaded it.",
  ORDER_IN_TERMINAL_STATE: "This order is finished, so its address can't be changed.",
  SUB_ORDER_ALREADY_DISPATCHED: "Your order is already on its way, so the address can't be changed.",
  AMENDMENT_CUTOFF_DEADLINE_EXCEEDED: "It's too late to change the address: delivery is already being prepared.",
  DISPATCH_REFERENCE_CHANGED: "The delivery plan just changed. We've reloaded the order; try again.",
  AMENDMENT_DISPATCH_REFERENCE_UNAVAILABLE: "Address changes aren't available for this order yet. Contact StockOut support to change it.",
  DELIVERY_AMENDMENT_NOT_APPLICABLE: "This order has no delivery address to change.",
  BUYER_ADDRESS_ORGANIZATION_MISMATCH: "Choose an address that belongs to the company that placed this order.",
  BUYER_ADDRESS_ACCESS_DENIED: "Choose one of your own saved addresses.",
  BUYER_ADDRESS_NOT_FOUND: "That address no longer exists. Pick another one.",
  ADDRESS_SERVICE_UNAVAILABLE: "We can't check addresses right now. Try again in a few minutes.",
  MIGRATION_024_INCOMPLETE: "Address changes aren't available yet. Contact StockOut support to change it.",
};
/** The blocked reason comes as "CODE: text" inside the message: give the buyer the plain version. */
function actionMessage(e: unknown): string {
  if (!isApiError(e)) return getErrorMessage(e);
  if (e.code && MESSAGES[e.code] && e.code !== "CANCELLATION_BLOCKED") return MESSAGES[e.code];
  const m = e.message ?? "";
  if (/DISPATCHED|IN_TRANSIT/i.test(m)) return "Part of this order is already on its way, so it can't be cancelled here. Contact StockOut support.";
  if (/ALREADY_CANCELLED|ALREADY_TERMINAL/i.test(m)) return "This is already cancelled.";
  if (/ORDER_COMPLETED/i.test(m)) return "This order is completed and can't be cancelled.";
  if (e.code && MESSAGES[e.code]) return MESSAGES[e.code];
  if (/^(CUTOFF|AMENDMENT|DELIVERY_ADDRESS)/i.test(e.code ?? "")) return "Address changes aren't available for this order right now. Contact StockOut support to change it.";
  return getErrorMessage(e);
}
const needsReload = (e: unknown) => isApiError(e) && (e.status === 409 || e.code === "INVALID_ROW_VERSION");

const REASONS = ["I changed my mind", "I ordered by mistake", "I found it elsewhere", "The delivery takes too long", "Other"];

/** Card hold vs charged money: the copy follows the order's actual payment state, never the request. */
function moneyLine(o: MarketplaceOrderDto) {
  if (statusIs(o.paymentStatus, "CAPTURED")) return "You were charged for this order, so StockOut will review the refund and tell you when it's sent.";
  return "Nothing was charged. The hold on your card for the cancelled items is released; your bank may take a few days to show it.";
}

function useRefreshOrder(orderId: string) {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: orderKeys.buyerDetail(orderId) }), qc.invalidateQueries({ queryKey: orderKeys.buyerList })]);
}

/* -------------------------------------------------------------- cancel dialog -------------------------------------------------------------- */

function CancelDialog({ open, onOpenChange, title, description, confirmLabel, run, onDone }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  run: (body: { reason: string; remarks: string | null; idempotencyKey: string }) => Promise<unknown>;
  onDone: () => void;
}) {
  const [reason, setReason] = React.useState(REASONS[0]);
  const [remarks, setRemarks] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  // One key per attempt: a retry after a lost answer is recognised by the server, not cancelled twice.
  const key = React.useRef(`buyer_cancel_${newId()}`);
  const other = reason === "Other";
  const submit = async () => {
    if (other && !remarks.trim()) return setError(new Error("Tell us briefly why you're cancelling."));
    setBusy(true);
    setError(null);
    try {
      await run({ reason: other ? remarks.trim() : reason, remarks: other ? null : remarks.trim() || null, idempotencyKey: key.current });
      onOpenChange(false);
      onDone();
    } catch (e) {
      setError(e);
      if (needsReload(e)) onDone();
    } finally {
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title={title} description={description} confirmLabel={confirmLabel} cancelLabel="Keep it" loading={busy} onConfirm={() => void submit()}>
      <div className="space-y-3">
        {error != null && (
          <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger-soft-foreground">
            {actionMessage(error)}
          </p>
        )}
        <FormField label="Why are you cancelling?" htmlFor="cancel-reason">
          <NativeSelect value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={other ? "Your reason" : "Anything else? (optional)"} htmlFor="cancel-remarks" required={other}>
          <Textarea rows={2} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </FormField>
      </div>
    </ConfirmDialog>
  );
}

/** "Cancel this seller's part" on a seller section of the order page. */
export function CancelSellerPart({ order, sub }: { order: MarketplaceOrderDto; sub: SellerSubOrderDto }) {
  const [open, setOpen] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const refresh = useRefreshOrder(order.orderId);
  if (!canCancelPart(order, sub)) return null;
  const seller = sub.sellerTradingName || sub.sellerLegalName || "this seller";
  return (
    <>
      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setOpen(true)}>
        <XCircleIcon /> Cancel these items
      </Button>
      {done && <span className="sr-only" role="status">Items from {seller} cancelled.</span>}
      <CancelDialog
        open={open}
        onOpenChange={setOpen}
        title={`Cancel the items from ${seller}?`}
        description={`Only ${sub.subOrderNumber} is cancelled; the rest of your order carries on. ${moneyLine(order)}`}
        confirmLabel="Cancel these items"
        run={(b) => buyerOrderActions.cancelSubOrder(order.orderId, sub.subOrderId, { ...b, expectedRowVersion: sub.rowVersion })}
        onDone={() => (setDone(true), void refresh())}
      />
    </>
  );
}

/* ------------------------------------------------------------- address change ------------------------------------------------------------- */

function ChangeAddressDialog({ order, open, onOpenChange, onDone }: { order: MarketplaceOrderDto; open: boolean; onOpenChange: (o: boolean) => void; onDone: (msg: string) => void }) {
  const owner: AddressOwner = order.buyerOrganizationId ? { kind: "organization", organizationId: order.buyerOrganizationId } : { kind: "individual" };
  const q = useQuery({ queryKey: addressKeys.active(owner), queryFn: ({ signal }) => addressesService.list(owner, 1, false, signal), enabled: open, retry: false });
  const current = React.useMemo(() => {
    try {
      const raw = JSON.parse(order.deliveryAddressSnapshotJson ?? "{}") as Record<string, unknown>;
      return String(raw.sourceAddressId ?? raw.SourceAddressId ?? "");
    } catch {
      return "";
    }
  }, [order.deliveryAddressSnapshotJson]);
  const options = (q.data?.items ?? []).filter((a) => a.status === "ACTIVE" && a.addressId !== current);
  const [chosen, setChosen] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  const key = React.useRef(`buyer_address_${newId()}`);
  const selected = options.some((a) => a.addressId === chosen) ? chosen : (options[0]?.addressId ?? "");

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await buyerOrderActions.changeAddress(order.orderId, { savedAddressId: selected, reason: reason.trim() || "Buyer changed the delivery address", idempotencyKey: key.current, expectedRowVersion: order.rowVersion });
      onOpenChange(false);
      onDone(res.message || "Delivery address changed.");
    } catch (e) {
      setError(e);
      if (needsReload(e)) onDone("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change the delivery address"
      description="Pick another of your saved addresses. You can change it until the order is dispatched."
      confirmLabel="Change address"
      cancelLabel="Keep current"
      tone="primary"
      loading={busy}
      onConfirm={() => void submit()}
    >
      <div className="space-y-3">
        {error != null && (
          <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger-soft-foreground">
            {actionMessage(error)}
          </p>
        )}
        {q.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no other saved address.{" "}
            <Link to="/account/addresses" className="font-medium text-foreground underline underline-offset-2">
              Add one
            </Link>{" "}
            first, then come back.
          </p>
        ) : (
          <fieldset className="max-h-60 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            <legend className="sr-only">New delivery address</legend>
            {options.map((a) => (
              <label key={a.addressId} className={cn("flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm", a.addressId === selected && "bg-surface-muted")}>
                <input type="radio" name="new-address" className="mt-0.5 size-4 accent-foreground" checked={a.addressId === selected} onChange={() => setChosen(a.addressId)} />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{a.label}</span>
                  <span className="block text-muted-foreground">{addressLine(a)}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <FormField label="Reason (optional)" htmlFor="address-reason">
          <Textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </div>
    </ConfirmDialog>
  );
}

/* ---------------------------------------------------------------- side cards ---------------------------------------------------------------- */

/** "Delivering to" from the order-time snapshot, with Change address while the order isn't dispatched. */
export function DeliveryAddressCard({ order }: { order: MarketplaceOrderDto }) {
  const addr = deliveryAddressLines(order.deliveryAddressSnapshotJson);
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const refresh = useRefreshOrder(order.orderId);
  if (!addr) return null;
  return (
    <section className="rounded-2xl border border-border p-5" aria-label="Delivery address">
      <div className="flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
          <MapPinIcon className="size-5" aria-hidden /> Delivering to
        </h2>
        {canChangeAddress(order) && (
          <Button size="sm" variant="ghost" onClick={() => (setNote(null), setOpen(true))}>
            <PencilSimpleIcon /> Change
          </Button>
        )}
      </div>
      <div className="mt-2 space-y-0.5 text-sm text-body">
        {addr.lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
        {addr.name && <p className="text-muted-foreground">{addr.name}</p>}
      </div>
      {note && (
        <p role="status" className="mt-3 rounded-lg bg-success-soft p-3 text-sm text-success-soft-foreground">
          {note}
        </p>
      )}
      {open && <ChangeAddressDialog order={order} open={open} onOpenChange={setOpen} onDone={(m) => (m && setNote(m), void refresh())} />}
    </section>
  );
}

/** Cancel the whole order while nothing is dispatched. */
export function CancelOrderCard({ order }: { order: MarketplaceOrderDto }) {
  const [open, setOpen] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const refresh = useRefreshOrder(order.orderId);
  if (done)
    return (
      <p role="status" className="rounded-2xl bg-success-soft p-4 text-sm leading-6 text-success-soft-foreground">
        Order cancelled. {moneyLine(order)}
      </p>
    );
  if (!canCancelOrder(order)) return null;
  return (
    <section className="rounded-2xl border border-border p-5" aria-label="Cancel order">
      <p className="text-sm text-body">Changed your mind? You can cancel until the order is dispatched.</p>
      <Button variant="secondary" className="mt-3 w-full text-danger" onClick={() => setOpen(true)}>
        <XCircleIcon /> Cancel order
      </Button>
      <CancelDialog
        open={open}
        onOpenChange={setOpen}
        title={`Cancel order ${order.orderNumber}?`}
        description={`Every seller's items in this order are cancelled. ${moneyLine(order)}`}
        confirmLabel="Cancel order"
        run={(b) => buyerOrderActions.cancelOrder(order.orderId, { ...b, expectedRowVersion: order.rowVersion })}
        onDone={() => (setDone(true), void refresh())}
      />
    </section>
  );
}

/** OJ-02/OJ-04 money proposal after a rejection or cancellation: proposals until Finance acts, never "refunded". */
export function ReconciliationNotice({ summary, currency }: { summary: OrderReconciliationSummaryDto | null | undefined; currency: string }) {
  if (!summary) return null;
  const cur = summary.currency || currency;
  const rows: Array<[string, number]> = [
    ["Items no longer in your order", summary.proposedRejectedMaterialAmount],
    ["Delivery to be returned", summary.proposedRefundableDeliveryGrossAmount],
    ["Delivery still charged", summary.retainedDeliveryGrossAmount],
  ].filter(([, v]) => (v as number) > 0) as Array<[string, number]>;
  return (
    <section className="rounded-2xl border border-border bg-info-soft p-4 text-sm text-info-soft-foreground" aria-label="Order total update">
      <p className="flex items-center gap-2 font-bold">
        <InfoIcon className="size-4" aria-hidden /> Your order total is being updated
      </p>
      {summary.safeExplanationMessage && <p className="mt-1 leading-6">{summary.safeExplanationMessage}</p>}
      {rows.length > 0 && (
        <dl className="mt-3 space-y-1">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt>{k}</dt>
              <dd className="font-medium">{formatMoney(v, cur)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-current/20 pt-1 font-bold">
            <dt>New order total</dt>
            <dd>{formatMoney(summary.activeOrderRemainingPayableAmount, cur)}</dd>
          </div>
        </dl>
      )}
      <p className="mt-2 text-xs opacity-80">
        {summary.isFinancialExecutionBlocked || summary.requiresFinanceRiskApproval
          ? "StockOut checks this before anything changes on your card. We'll let you know when it's done."
          : "We'll let you know when your card is updated."}
      </p>
    </section>
  );
}
