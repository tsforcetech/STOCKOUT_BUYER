import * as React from "react";
import { PackageIcon } from "@phosphor-icons/react";
import { env } from "@/config/env";
import { cn } from "@/lib/utils/cn";

/** Resolves backend-relative asset paths (e.g. `/api/v1/files/{id}/download`) against the gateway. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${env.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Listing image with a graceful placeholder. Public listing photos are served anonymously by
 * `/api/v1/files/{id}/download` (302 to a short-lived S3 URL) for published listings; anything else that
 * fails to load (unpublished, expired, network) falls back to the placeholder.
 */
export function ListingImage({ src, alt, className }: { src: string | null | undefined; alt: string; className?: string }) {
  const url = assetUrl(src);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    setFailed(false);
  }, [url]);
  if (!url || failed) {
    return (
      <div
        className={cn("flex items-center justify-center bg-cream-strong bg-[radial-gradient(circle_at_1px_1px,var(--color-border-strong)_1px,transparent_0)] bg-[length:14px_14px] text-muted-foreground", className)}
        role="img"
        aria-label={`${alt} — image unavailable`}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-surface shadow-raised">
          <PackageIcon className="size-6" aria-hidden />
        </span>
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn("bg-cream-strong object-cover", className)} />;
}
