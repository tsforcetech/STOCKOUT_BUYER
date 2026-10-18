import { isRouteErrorResponse, Link, useLocation, useRouteError } from "react-router";
import { WarningIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import NotFoundPage from "@/features/errors/not-found-page";

/** Route-level fallback for loader/lazy-import failures (e.g. a chunk failed to download after a deploy). */
export function RouteError() {
  const error = useRouteError();
  const location = useLocation();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  const chunkFailed = error instanceof Error && /dynamically imported module|Loading chunk|Importing a module script failed/i.test(error.message);
  console.error("Route error", error);
  const details = describeError(error, location.pathname + location.search);
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6" role="alert">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg bg-danger-soft text-danger-soft-foreground">
          <WarningIcon className="size-7" />
        </div>
        <h1 className="font-heading text-2xl font-bold">{chunkFailed ? "A new version is available" : "This page couldn't be displayed"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {chunkFailed ? "The console was updated while you were using it. Reload to get the latest version." : "An unexpected error occurred. Reloading usually fixes it."}
        </p>
        {!chunkFailed && (
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
  const head = `Page: ${path}\nTime: ${new Date().toISOString()}\nBrowser: ${navigator.userAgent}`;
  if (isRouteErrorResponse(error)) return `${head}\nResponse: ${error.status} ${error.statusText}`;
  if (error instanceof Error) return `${head}\n${error.name}: ${error.message}\n${(error.stack ?? "").split("\n").slice(1, 6).join("\n")}`;
  return `${head}\n${String(error)}`;
}
