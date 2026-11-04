import * as React from "react";
import { isRouteErrorResponse, Link, useLocation, useRouteError } from "react-router";
import { isLoadFailure, reloadOnce } from "@/lib/utils/reload";
import { WarningIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import NotFoundPage from "@/features/errors/not-found-page";

/** Route-level fallback for loader/lazy-import failures (e.g. a chunk failed to download after a deploy). */
export function RouteError() {
  const error = useRouteError();
  const location = useLocation();
  const chunkFailed = isLoadFailure(error);
  // A page file that failed to download (weak signal, in-app browsers, or a page opened before a deploy):
  // reload once by itself instead of showing an error. Guarded so it can never loop.
  React.useEffect(() => {
    if (chunkFailed) reloadOnce();
  }, [chunkFailed]);
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  console.error("Route error", error);
  const details = describeError(error, location.pathname + location.search);
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6" role="alert">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg bg-danger-soft text-danger-soft-foreground">
          <WarningIcon className="size-7" />
        </div>
        <h1 className="font-heading text-2xl font-bold">{chunkFailed ? "Couldn't load this page" : "This page couldn't be displayed"}</h1>
        {!chunkFailed && error instanceof Error && (
          // Shown up front so a screenshot from a phone (e.g. Instagram's in-app browser) carries the cause.
          <p className="mx-auto mt-3 max-w-sm break-words rounded-md bg-surface-muted px-3 py-2 font-mono text-xs text-body">
            {error.name}: {error.message.slice(0, 240)}
          </p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {chunkFailed ? "Part of the page didn't load (the connection dropped or the site was just updated). Reload to try again." : "An unexpected error occurred. Reloading usually fixes it."}
        </p>
        {(
          <details className="mt-5 text-left">
            <summary className="cursor-pointer text-center text-xs text-muted-foreground underline underline-offset-4">Technical details</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-muted p-3 text-xs text-body">{details}</pre>
            <button type="button" onClick={() => void navigator.clipboard?.writeText(details)} className="mt-1 cursor-pointer text-xs text-muted-foreground underline">
              Copy details
            </button>
          </details>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="secondary" asChild>
            <Link to="/">Go to home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Plain-text error summary shown under "Technical details" so users can report what broke. No tokens or user data. */
function describeError(error: unknown, path: string): string {
  // The error comes first so a phone screenshot of the box shows the cause.
  const tail = `Page: ${path}\nTime: ${new Date().toISOString()}\nBrowser: ${navigator.userAgent}`;
  if (isRouteErrorResponse(error)) return `Response: ${error.status} ${error.statusText}\n${tail}`;
  if (error instanceof Error) return `${error.name}: ${error.message}\n${tail}\n${(error.stack ?? "").split("\n").slice(0, 5).join("\n")}`;
  return `${String(error)}\n${tail}`;
}
