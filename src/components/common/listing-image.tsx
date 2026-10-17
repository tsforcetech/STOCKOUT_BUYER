import * as React from "react";
import { ImageIcon } from "@phosphor-icons/react";
import { env } from "@/config/env";
import { cn } from "@/lib/utils/cn";

/** Resolves backend-relative asset paths (e.g. `/api/v1/files/{id}/download`) against the gateway. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${env.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Listing image with a graceful placeholder. NOTE: the backend's public image URL
 * (`/api/v1/files/{id}/download`) is not implemented yet (see docs/contracts/buyer-search.md §4),
 * so today this renders the placeholder; images appear automatically once the endpoint exists.
 */
export function ListingImage({ src, alt, className }: { src: string | null | undefined; alt: string; className?: string }) {
  const url = assetUrl(src);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [url]);
  if (!url || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-surface-muted text-muted-foreground", className)} role="img" aria-label={`${alt} — image unavailable`}>
        <ImageIcon className="size-10 opacity-50" aria-hidden />
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn("object-cover", className)} />;
}
