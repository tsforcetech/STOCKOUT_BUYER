/**
 * Errors that mean a page/script file did not arrive, as worded by Chrome, Safari (incl. Instagram/Facebook in-app
 * browsers) and Firefox — not a bug in the page itself.
 */
const LOAD_FAILURE =
  /dynamically imported module|Loading chunk|Loading CSS chunk|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|not a valid JavaScript MIME type|MIME type|Load failed|Failed to fetch|NetworkError when attempting to fetch/i;

export function isLoadFailure(error: unknown): boolean {
  return error instanceof Error && LOAD_FAILURE.test(`${error.name}: ${error.message}`);
}

const KEY = "stockout.market.reloadedAt";
const WINDOW_MS = 30_000;

/** Reloads the page at most once every 30 s (never loops). Returns false when it chose not to reload. */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false; // no storage: don't risk a reload loop
  }
  window.location.reload();
  return true;
}
