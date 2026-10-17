import * as React from "react";
import { toast } from "sonner";
import { DownloadSimpleIcon, ImageBrokenIcon } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/misc";
import { RowAction } from "@/components/common/section-card";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { filesService } from "@/services/files.service";
import { cn } from "@/lib/utils/cn";
import { sellerErrorMessage } from "../lib/errors";
import { useDownloadUrl } from "../lib/queries";

/**
 * Opens the caller's own file through a short-lived presigned URL (POST /api/v1/files/{id}/download-url).
 * The tab is opened synchronously so pop-up blockers allow it, then pointed at the URL.
 */
export function FileDownloadAction({ fileId, label = "Open file" }: { fileId: string; label?: string }) {
  const fetchUrl = useApiMutation({ mutationFn: (id: string) => filesService.downloadUrl(id), toastOnError: false });
  return (
    <RowAction
      label={label}
      disabled={fetchUrl.isPending}
      onClick={() => {
        const win = window.open("about:blank", "_blank");
        fetchUrl.mutate(fileId, {
          onSuccess: (res) => {
            if (!res.downloadUrl) {
              win?.close();
              toast.error("The file isn't available for download yet.");
              return;
            }
            if (win) {
              win.opener = null;
              win.location.href = res.downloadUrl;
            } else window.location.assign(res.downloadUrl);
          },
          onError: (error) => {
            win?.close();
            toast.error(sellerErrorMessage(error));
          },
        });
      }}
    >
      <DownloadSimpleIcon />
    </RowAction>
  );
}

/** Thumbnail for the seller's own image (owner-scoped presigned URL). */
export function OwnImageThumb({ fileId, alt, className }: { fileId: string; alt: string; className?: string }) {
  const url = useDownloadUrl(fileId);
  const [failed, setFailed] = React.useState(false);
  if (url.isLoading) return <Skeleton className={cn("rounded-md", className)} />;
  if (url.error || !url.data?.downloadUrl || failed) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-1 rounded-md bg-surface-muted text-center text-xs text-muted-foreground", className)} role="img" aria-label={`${alt} — preview unavailable`}>
        <ImageBrokenIcon className="size-6" aria-hidden />
        <span className="px-2">{url.error ? sellerErrorMessage(url.error) : "Preview unavailable"}</span>
      </div>
    );
  }
  return <img src={url.data.downloadUrl} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn("rounded-md object-cover", className)} />;
}
