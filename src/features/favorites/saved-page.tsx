import * as React from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartIcon, ShoppingCartSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/states";
import { Skeleton } from "@/components/ui/misc";
import { ListingImage, assetUrl } from "@/components/common/listing-image";
import { useAuth } from "@/lib/auth/auth-context";
import { useFavorites } from "@/lib/favorites/favorites-context";
import { commerceKeys } from "@/lib/cart/server-cart";
import { commerceErrorMessage } from "@/lib/cart/commerce-errors";
import { useCart } from "@/lib/cart/cart-context";
import { buyerCommerceService as svc } from "@/services/buyer-commerce.service";
import { useAuthDialog } from "@/features/auth/auth-dialog";
import { formatMoney, formatNumber } from "@/lib/utils/format";
import { Pager } from "@/features/search/components/pager";
import { SnapshotCard } from "./snapshot-card";
import { listingPath } from "@/lib/seo/site";

const PAGE_SIZE = 20;

/** Signed-in wishlist (GET /api/v1/buyer/wishlist), paginated, with remove and move-to-cart. */
function ServerWishlist() {
  const qc = useQueryClient();
  const cart = useCart();
  const [page, setPage] = React.useState(1);
  const q = useQuery({ queryKey: commerceKeys.wishlistPage(page, PAGE_SIZE), queryFn: ({ signal }) => svc.wishlist(page, PAGE_SIZE, signal), placeholderData: (p) => p });
  const done = () => {
    void qc.invalidateQueries({ queryKey: commerceKeys.wishlist });
  };
  const remove = useMutation({ mutationFn: (listingId: string) => svc.removeFromWishlist(listingId), onSuccess: () => (toast.success("Removed from your wishlist"), done()), onError: (e) => toast.error(commerceErrorMessage(e)) });
  const toCart = useMutation({
    mutationFn: (listingId: string) => svc.wishlistToCart(listingId, 1),
    onSuccess: () => {
      toast.success("Moved to your cart");
      done();
      void qc.invalidateQueries({ queryKey: commerceKeys.cart });
      cart.setOpen(true);
    },
    onError: (e) => toast.error(commerceErrorMessage(e)),
  });

  if (q.isLoading)
    return (
      <div className="mt-6 space-y-3" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  if (q.error || !q.data) return <ErrorState className="mt-6" error={q.error} onRetry={() => void q.refetch()} />;
  const w = q.data;
  if (w.items.length === 0 && page === 1)
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-border-strong p-10 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-cream">
          <HeartIcon className="size-7 text-foreground" />
        </span>
        <p className="mt-4 font-heading text-lg font-bold text-foreground">Your wishlist is empty</p>
        <p className="mt-1 text-sm text-body">Tap ♥ on any listing to keep it here.</p>
        <Button asChild className="mt-5">
          <Link to="/search">Browse marketplace</Link>
        </Button>
      </div>
    );
  const busy = remove.isPending || toCart.isPending;
  return (
    <>
      <p className="mt-1 text-sm text-muted-foreground">{formatNumber(w.totalItems)} saved to your account</p>
      <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {w.items.map((i) => (
          <li key={i.listingId} className="flex gap-3 p-4">
            <Link to={listingPath(i.listingId, i.title)} className="shrink-0">
              <ListingImage src={assetUrl(i.thumbnailUrl)} alt={i.title} className="size-20 rounded-lg" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link to={listingPath(i.listingId, i.title)} className="line-clamp-2 font-heading font-bold text-foreground hover:underline">
                {i.title}
              </Link>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatMoney(i.currentPrice, i.currency)} · {formatNumber(i.stockAvailable)} available
              </p>
              {!i.isPurchasable && <p className="mt-0.5 text-xs text-danger-soft-foreground">Not available to buy right now</p>}
              <div className="mt-2 flex flex-wrap gap-x-4">
                <button
                  type="button"
                  disabled={busy || !i.isPurchasable}
                  onClick={() => toCart.mutate(i.listingId)}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-1 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShoppingCartSimpleIcon className="size-4" /> Move to cart
                </button>
                <button type="button" disabled={busy} onClick={() => remove.mutate(i.listingId)} className="inline-flex min-h-10 cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-danger disabled:opacity-50">
                  <TrashIcon className="size-4" /> Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Pager page={page} totalPages={Math.max(1, Math.ceil(w.totalItems / PAGE_SIZE))} onChange={setPage} />
    </>
  );
}

/** Hearts saved on this device before the wishlist moved to accounts. */
function DeviceFavorites() {
  const { favorites, moveDeviceFavorites } = useFavorites();
  const [busy, setBusy] = React.useState(false);
  if (favorites.length === 0) return null;
  return (
    <section aria-label="Saved on this device" className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Saved on this device</h2>
          <p className="text-sm text-muted-foreground">Listings you saved before signing in.</p>
        </div>
        <Button
          size="sm"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const n = await moveDeviceFavorites();
            setBusy(false);
            toast.success(`${n} listing${n === 1 ? "" : "s"} moved to your wishlist`);
          }}
        >
          Move all to my wishlist
        </Button>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {favorites.map((f) => (
          <li key={f.listingId}>
            <SnapshotCard listing={f} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SavedPage() {
  const { status } = useAuth();
  const { openAuth } = useAuthDialog();
  const { recent, clearRecent } = useFavorites();
  return (
    <div className="mx-auto max-w-[1336px] px-4 py-8 sm:px-6">
      <h1 className="font-heading text-[28px] font-bold text-foreground sm:text-[32px]">Wishlist</h1>
      {status === "authenticated" ? (
        <>
          <ServerWishlist />
          <DeviceFavorites />
        </>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border-strong p-10 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-cream">
            <HeartIcon className="size-7 text-foreground" />
          </span>
          <p className="mt-4 font-heading text-lg font-bold text-foreground">Sign in to see your wishlist</p>
          <p className="mt-1 text-sm text-body">Your wishlist is saved to your account, so it's on every device.</p>
          <Button className="mt-5" onClick={() => openAuth({ reason: "Sign in to see your wishlist." })}>
            Sign in
          </Button>
        </div>
      )}

      {recent.length > 0 && (
        <section className="mt-12" aria-label="Recently viewed">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">Recently viewed</h2>
            <button type="button" onClick={clearRecent} className="cursor-pointer text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Clear history
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {recent.map((r) => (
              <li key={r.listingId}>
                <SnapshotCard listing={r} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
