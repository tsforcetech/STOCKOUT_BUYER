import * as React from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { newId } from "@/lib/utils/id";
import { sellerListingsService } from "@/services/seller-listings.service";
import { sellerErrorMessage, isVersionConflict } from "../lib/errors";
import { patchListingRowVersion, sellerKeys } from "../lib/queries";

export type LifecycleAction = "submit" | "pause" | "resume" | "archive";

export interface LifecycleTarget {
  listingId: string;
  title: string;
}

interface Pending {
  action: LifecycleAction;
  target: LifecycleTarget;
  /** X-Idempotency-Key for submit: one per user action, stable across retries inside the same dialog. */
  idempotencyKey: string;
}

const SUCCESS: Record<LifecycleAction, string> = {
  submit: "Submitted for review.",
  pause: "Listing paused. Buyers can no longer see it.",
  resume: "Listing is live again.",
  archive: "Listing archived.",
};

/** Re-reads the listing (latest rowVersion / draft id) and runs one lifecycle action. Returns the new rowVersion. */
export async function runLifecycleAction(qc: QueryClient, sellerId: string, action: LifecycleAction, listingId: string, idempotencyKey: string = newId()): Promise<string> {
  try {
    const detail = await qc.fetchQuery({ queryKey: sellerKeys.detail(sellerId, listingId), queryFn: ({ signal }) => sellerListingsService.detail(sellerId, listingId, signal), staleTime: 0 });
    const rv = detail.rowVersion;
    let rowVersion: string;
    switch (action) {
      case "submit": {
        if (!detail.currentDraftVersionId) throw new Error("This listing has no draft to submit.");
        rowVersion = (await sellerListingsService.submit(sellerId, listingId, { listingVersionId: detail.currentDraftVersionId, expectedRowVersion: rv }, idempotencyKey)).rowVersion;
        break;
      }
      case "pause":
        rowVersion = (await sellerListingsService.pause(sellerId, listingId, rv, null)).rowVersion;
        break;
      case "resume":
        rowVersion = (await sellerListingsService.resume(sellerId, listingId, rv)).rowVersion;
        break;
      case "archive":
        rowVersion = (await sellerListingsService.archive(sellerId, listingId, rv)).rowVersion;
        break;
    }
    patchListingRowVersion(qc, sellerId, listingId, rowVersion);
    // The listing status changed: refetch the detail so the cards and header show it.
    void qc.invalidateQueries({ queryKey: sellerKeys.listing(sellerId, listingId) });
    return rowVersion;
  } catch (error) {
    if (isVersionConflict(error)) await qc.invalidateQueries({ queryKey: sellerKeys.listing(sellerId, listingId) });
    throw error;
  }
}

/** Pause and resume are reversible, so they run straight away with an Undo; submit and archive ask first. */
const INSTANT: ReadonlySet<LifecycleAction> = new Set(["pause", "resume"]);
const UNDO: Partial<Record<LifecycleAction, LifecycleAction>> = { pause: "resume", resume: "pause" };

export function useListingLifecycle(sellerId: string, onDone?: (action: LifecycleAction) => void) {
  const qc = useQueryClient();
  const [pending, setPending] = React.useState<Pending | null>(null);

  const mutation = useApiMutation({
    toastOnError: false,
    mutationFn: ({ action, target, idempotencyKey }: Pending) => runLifecycleAction(qc, sellerId, action, target.listingId, idempotencyKey),
    onSuccess: (_rowVersion, vars) => {
      void qc.invalidateQueries({ queryKey: sellerKeys.listings(sellerId) });
      const undo = UNDO[vars.action];
      toast.success(SUCCESS[vars.action], {
        action: undo ? { label: "Undo", onClick: () => mutation.mutate({ action: undo, target: vars.target, idempotencyKey: newId() }, { onError: (error) => toast.error(sellerErrorMessage(error)) }) } : undefined,
      });
      setPending(null);
      onDone?.(vars.action);
    },
  });

  const run = () => {
    if (!pending) return;
    mutation.mutate(pending, { onError: (error) => toast.error(sellerErrorMessage(error)) });
  };

  const { reset, mutate } = mutation;
  const open = React.useCallback(
    (action: LifecycleAction, target: LifecycleTarget) => {
      reset();
      const next = { action, target, idempotencyKey: newId() };
      if (INSTANT.has(action)) mutate(next, { onError: (error) => toast.error(sellerErrorMessage(error)) });
      else setPending(next);
    },
    [reset, mutate],
  );

  const close = (o: boolean) => {
    if (!o && !mutation.isPending) setPending(null);
  };

  const title = pending?.target.title || "this listing";
  const dialogs = (
    <>
      <ConfirmDialog
        open={pending?.action === "submit"}
        onOpenChange={close}
        tone="primary"
        title="Submit for review?"
        description={
          <>
            “{title}” will be sent to our moderators. The marketplace only checks that the price is above 0 and that at least one image is attached — run
            <strong> Check completeness</strong> first to catch missing required attributes.
          </>
        }
        confirmLabel="Submit for review"
        loading={mutation.isPending}
        onConfirm={() => run()}
      />
      <ConfirmDialog
        open={pending?.action === "archive"}
        onOpenChange={close}
        title="Archive listing?"
        description={`“${title}” will be archived permanently. There is no way to restore an archived listing.`}
        confirmLabel="Archive"
        loading={mutation.isPending}
        onConfirm={() => run()}
      />
    </>
  );

  return { open, dialogs, isPending: mutation.isPending };
}
