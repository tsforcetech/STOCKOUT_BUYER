import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCartSimpleIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCart } from "@/lib/cart/cart-context";
import { commerceKeys } from "@/lib/cart/server-cart";
import { clearPendingMerge, readPendingMerge, runGuestMerge } from "@/lib/cart/guest-merge";
import { commerceCode, commerceErrorMessage } from "@/lib/cart/commerce-errors";

const DISMISS_KEY = "stockout.market.cart.merge.dismissed";

/** Runs the explicit guest-cart merge. Shared by the after-login prompt and the cart-page banner. */
export function useGuestMerge() {
  const cart = useCart();
  const qc = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  const merge = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await runGuestMerge(cart.items);
      qc.setQueryData(commerceKeys.cart, result);
      cart.clear(); // only after a successful merge
      toast.success("Items from this device were added to your cart.");
      return true;
    } catch (e) {
      // Network errors, timeouts, in-flight and service errors: keep the device cart and the same key for a safe retry.
      setError(e);
      if (commerceCode(e) === "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH") clearPendingMerge(); // a fresh attempt must be a new logical merge
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { merge, busy, error, retrying: !!readPendingMerge() };
}

/** After sign-in, asks once per session whether to add the device cart to the account cart. Never merges silently. */
export function MergePrompt() {
  const cart = useCart();
  const { merge, busy, error } = useGuestMerge();
  const [dismissed, setDismissed] = React.useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const open = cart.mode === "server" && cart.items.length > 0 && !dismissed;
  const later = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };
  const n = cart.items.length;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && later()}>
      <DialogContent
        title="Add your saved items to your cart?"
        description={`You added ${n} item${n === 1 ? "" : "s"} on this device before signing in.`}
        footer={
          <>
            <Button variant="secondary" onClick={later} disabled={busy}>
              Not now
            </Button>
            <Button onClick={() => void merge()} loading={busy}>
              <ShoppingCartSimpleIcon /> Add {n} item{n === 1 ? "" : "s"} to my cart
            </Button>
          </>
        }
      >
        <ul className="max-h-56 space-y-1.5 overflow-y-auto text-sm">
          {cart.items.map((i) => (
            <li key={i.listingId} className="flex justify-between gap-3">
              <span className="truncate text-foreground">{i.title}</span>
              <span className="shrink-0 text-muted-foreground">× {i.quantity}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Prices and stock are checked again when they reach your cart.</p>
        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger-soft-foreground">
            {commerceErrorMessage(error)} Your items are still saved on this device.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
