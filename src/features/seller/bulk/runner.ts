import { isApiError } from "@/lib/api/errors";
import { newId } from "@/lib/utils/id";
import { filesService } from "@/services/files.service";
import { sellerListingsService } from "@/services/seller-listings.service";
import { LISTING_MEDIA_FILE_PURPOSE, type CreateListingDraftRequest } from "@/api/types/seller-listings";
import { sellerErrorMessage } from "../lib/errors";

export type RunStep = "create" | "image" | "inventory" | "submit";
export type RunStatus = "pending" | "creating" | "done" | "failed" | "cancelled";

export const STEP_LABELS: Record<RunStep, string> = {
  create: "Creating draft",
  image: "Uploading photo",
  inventory: "Setting stock",
  submit: "Submitting for review",
};

export interface RunItem {
  id: string;
  draft: CreateListingDraftRequest;
  quantity: number;
  image: File | null;
}

export interface RunState {
  status: RunStatus;
  step?: RunStep;
  /** Kept as soon as the draft exists, so a failed row can be finished in the editor. */
  listingId?: string;
  submitted?: boolean;
  error?: string;
  /** Neutral info, e.g. "Not submitted: no photo". */
  note?: string;
}

/**
 * Sliding-window limiter for the authenticated gateway limit (300 requests/min). We budget below it
 * (default 240/min) and keep a small gap between calls so a 200-row run never bursts.
 */
export function createRateLimiter({ perMinute = 240, minGapMs = 120, now = () => Date.now() } = {}) {
  const stamps: number[] = [];
  return async function acquire(cost: number, signal?: AbortSignal) {
    for (;;) {
      const t = now();
      while (stamps.length && t - stamps[0] >= 60_000) stamps.shift();
      const last = stamps[stamps.length - 1];
      const gapWait = last !== undefined ? Math.max(0, last + minGapMs - t) : 0;
      const windowWait = stamps.length + cost > perMinute ? stamps[0] + 60_000 - t : 0;
      const wait = Math.max(gapWait, windowWait);
      if (wait <= 0) {
        for (let i = 0; i < cost; i++) stamps.push(t);
        return;
      }
      await sleep(wait, signal);
    }
  };
}
export type RateLimiter = ReturnType<typeof createRateLimiter>;

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

class Cancelled extends Error {}

interface RunOptions {
  sellerId: string;
  items: RunItem[];
  submit: boolean;
  signal: AbortSignal;
  onUpdate: (id: string, state: RunState) => void;
  limiter?: RateLimiter;
  /** Retries per step after HTTP 429. */
  maxRateLimitRetries?: number;
}

/**
 * Creates listings one at a time: create draft (fresh X-Idempotency-Key per row, reused only when retrying
 * that same row after a 429) → upload + attach photo → set initial stock → optionally submit.
 * A failure marks that row failed (keeping its listing id) and the run continues with the next row.
 */
export async function runBulkCreate({ sellerId, items, submit, signal, onUpdate, limiter = createRateLimiter(), maxRateLimitRetries = 3 }: RunOptions): Promise<void> {
  const call = async <T>(cost: number, fn: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      if (signal.aborted) throw new Cancelled();
      await limiter(cost, signal);
      if (signal.aborted) throw new Cancelled();
      try {
        return await fn();
      } catch (error) {
        if (isApiError(error) && error.kind === "aborted" && signal.aborted) throw new Cancelled();
        if (isApiError(error) && error.kind === "rate_limited" && attempt < maxRateLimitRetries) {
          await sleep((error.retryAfterSeconds ?? 15) * 1000, signal);
          continue;
        }
        throw error;
      }
    }
  };

  for (const item of items) {
    if (signal.aborted) {
      onUpdate(item.id, { status: "cancelled", note: "Not started." });
      continue;
    }
    const state: RunState = { status: "creating" };
    const update = (patch: Partial<RunState>) => {
      Object.assign(state, patch);
      onUpdate(item.id, { ...state });
    };
    try {
      update({ step: "create" });
      const idempotencyKey = newId();
      const created = await call(1, () => sellerListingsService.create(sellerId, item.draft, idempotencyKey));
      update({ listingId: created.listingId });
      let rowVersion = created.rowVersion;

      if (item.image) {
        const image = item.image;
        update({ step: "image" });
        // request-upload + complete (the S3 PUT goes to storage, not the gateway).
        const asset = await call(2, () => filesService.upload(image, LISTING_MEDIA_FILE_PURPOSE.IMAGE, { signal }));
        const attached = await call(1, () =>
          sellerListingsService.attachMedia(sellerId, created.listingId, { expectedRowVersion: rowVersion, fileAssetId: asset.fileId, mediaType: "IMAGE", isPrimary: false, documentType: null }),
        );
        rowVersion = attached.rowVersion;
      }

      update({ step: "inventory" });
      // Initial stock: no inventory row yet, so no expected row version (reason/notes are ignored on the initial set).
      await call(1, () => sellerListingsService.setInventory(sellerId, created.listingId, { expectedRowVersion: null, onHandQuantity: item.quantity, reasonCode: null, notes: null }));

      if (submit && item.image) {
        update({ step: "submit" });
        await call(1, () => sellerListingsService.submit(sellerId, created.listingId, { listingVersionId: created.currentDraftVersionId, expectedRowVersion: rowVersion }, newId()));
        update({ status: "done", step: undefined, submitted: true });
      } else {
        update({ status: "done", step: undefined, submitted: false, note: submit ? "Saved as draft — submitting needs a photo." : undefined });
      }
    } catch (error) {
      if (error instanceof Cancelled) {
        update({ status: "cancelled", note: state.listingId ? `Stopped during "${STEP_LABELS[state.step ?? "create"].toLowerCase()}" — the draft was created; finish it in the editor.` : "Stopped before the draft was created." });
      } else {
        update({ status: "failed", error: `${STEP_LABELS[state.step ?? "create"]} failed: ${sellerErrorMessage(error)}` });
      }
    }
  }
}
