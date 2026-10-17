import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ReasonDialog } from "@/components/forms/reason-dialog";
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

/**
 * Submit / pause / resume / archive with confirmation. Each action re-reads the listing first so it sends the
 * latest listing rowVersion (and current draft version id for submit).
 */
export function useListingLifecycle(sellerId: string, onDone?: (action: LifecycleAction) => void) {
  const qc = useQueryClient();
  const [pending, setPending] = React.useState<Pending | null>(null);

  const mutation = useApiMutation({
    toastOnError: false,
    mutationFn: async ({ action, target, idempotencyKey, remarks }: Pending & { remarks?: string | null }) => {
      const id = target.listingId;
      try {
        const detail = await qc.fetchQuery({ queryKey: sellerKeys.detail(sellerId, id), queryFn: ({ signal }) => sellerListingsService.detail(sellerId, id, signal), staleTime: 0 });
        const rv = detail.rowVersion;
        switch (action) {
          case "submit": {
            if (!detail.currentDraftVersionId) throw new Error("This listing has no draft to submit.");
            return (await sellerListingsService.submit(sellerId, id, { listingVersionId: detail.currentDraftVersionId, expectedRowVersion: rv }, idempotencyKey)).rowVersion;
          }
          case "pause":
            return (await sellerListingsService.pause(sellerId, id, rv, remarks ?? null)).rowVersion;
          case "resume":
            return (await sellerListingsService.resume(sellerId, id, rv)).rowVersion;
          case "archive":
            return (await sellerListingsService.archive(sellerId, id, rv)).rowVersion;
        }
      } catch (error) {
        if (isVersionConflict(error)) await qc.invalidateQueries({ queryKey: sellerKeys.listing(sellerId, id) });
        throw error;
      }
    },
    onSuccess: (rowVersion, vars) => {
      patchListingRowVersion(qc, sellerId, vars.target.listingId, rowVersion);
      void qc.invalidateQueries({ queryKey: sellerKeys.listings(sellerId) });
      toast.success(SUCCESS[vars.action]);
      setPending(null);
      onDone?.(vars.action);
    },
  });

  const run = (remarks?: string | null) => {
    if (!pending) return;
    mutation.mutate({ ...pending, remarks }, { onError: (error) => toast.error(sellerErrorMessage(error)) });
  };

  const { reset } = mutation;
  const open = React.useCallback(
    (action: LifecycleAction, target: LifecycleTarget) => {
      reset();
      setPending({ action, target, idempotencyKey: newId() });
    },
    [reset],
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
      <ReasonDialog
        open={pending?.action === "pause"}
        onOpenChange={close}
        tone="primary"
        required={false}
        title="Pause listing?"
        description={`“${title}” will be hidden from buyers until you resume it. Buyer reservations already made are not affected.`}
        reasonLabel="Remarks (optional)"
        confirmLabel="Pause listing"
        loading={mutation.isPending}
        onConfirm={(remarks) => run(remarks || null)}
      />
      <ConfirmDialog
        open={pending?.action === "resume"}
        onOpenChange={close}
        tone="primary"
        title="Resume listing?"
        description={`“${title}” will go live again. This needs a verified seller account, stock above 0 and a primary image. Listings suspended by the marketplace team can't be resumed by you.`}
        confirmLabel="Resume listing"
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
