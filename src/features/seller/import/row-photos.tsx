import * as React from "react";
import { FileZipIcon, ImageIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Badge, Skeleton } from "@/components/ui/misc";
import { formatNumber } from "@/lib/utils/format";
import { listZip, readZipEntry, type ZipEntry } from "@/lib/files/zip";
import type { BulkImportRowPreviewDto } from "@/api/types/bulk-import";
import { localZip, rememberZip } from "./shared";

const fileName = (p: string) => p.split("/").pop() ?? p;

/**
 * Photos cell: the matched count, and "View" to check exactly which photos go on this product before importing.
 * The server lists the matched ZIP paths (imageReferences, first one is the cover unless the sheet names another);
 * the pictures themselves come from the seller's own ZIP in this browser.
 */
export function RowPhotos({ jobId, row }: { jobId: string; row: BulkImportRowPreviewDto }) {
  const missing = [...row.errors, ...row.warnings].filter((m) => m.field === "ImageReferences" && m.code !== "LISTING_HAS_NO_IMAGES");
  if (!row.imageReferences.length && !missing.length) return <span className="tabular-nums">{formatNumber(row.matchedImageCount)}</span>;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="-ml-2 tabular-nums" aria-label={`View photos for row ${row.rowNumber}`}>
          {formatNumber(row.matchedImageCount)} · View
        </Button>
      </DialogTrigger>
      <DialogContent
        size="lg"
        title={row.title || `Row ${row.rowNumber}`}
        description={`Row ${row.rowNumber} · SKU ${row.sellerSku || "—"} · ${formatNumber(row.matchedImageCount)} ${row.matchedImageCount === 1 ? "photo" : "photos"} matched`}
      >
        {row.imageReferences.length > 0 && <PhotoGrid jobId={jobId} paths={row.imageReferences} />}
        {missing.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm" aria-label="Photos not found">
            {missing.map((m, i) => (
              <li key={`${m.code}-${i}`} className="flex items-start gap-2 text-warning-soft-foreground">
                <WarningCircleIcon weight="fill" className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="min-w-0 break-words">{m.message || m.code}</span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PhotoGrid({ jobId, paths }: { jobId: string; paths: string[] }) {
  const [zip, setZip] = React.useState<File | null>(() => localZip(jobId));
  const [entries, setEntries] = React.useState<Map<string, ZipEntry> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!zip) return;
    let live = true;
    setError(null);
    listZip(zip)
      .then((m) => live && setEntries(m))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "This ZIP couldn't be read."));
    return () => {
      live = false;
    };
  }, [zip]);

  const pick = (f: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!f) return;
    rememberZip(jobId, f);
    setEntries(null);
    setZip(f);
  };

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Matched photos">
        {paths.map((p, i) => (
          <li key={p} className="min-w-0">
            <Thumb file={zip} entry={entries?.get(p.toLowerCase()) ?? null} loading={!!zip && !entries && !error} />
            <p className="mt-1 flex items-center gap-1.5 text-xs">
              {i === 0 && <Badge tone="info">Cover</Badge>}
              <span className="min-w-0 truncate text-body" title={p}>
                {fileName(p)}
              </span>
            </p>
          </li>
        ))}
      </ul>
      {!zip && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-surface-muted p-3 text-sm">
          <span className="min-w-0 flex-1 text-muted-foreground">To see the pictures, choose the same photos ZIP again. It only opens on this device; nothing is uploaded.</span>
          <Button size="sm" variant="secondary" onClick={() => input.current?.click()}>
            <FileZipIcon /> Choose ZIP
          </Button>
          <input ref={input} type="file" accept=".zip" className="sr-only" aria-label="Photos ZIP to preview" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Thumb({ file, entry, loading }: { file: File | null; entry: ZipEntry | null; loading: boolean }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    if (!file || !entry) return;
    let live = true;
    let made: string | null = null;
    readZipEntry(file, entry)
      .then((b) => {
        if (!live) return;
        made = URL.createObjectURL(b);
        setUrl(made);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [file, entry]);
  if (loading || (entry && !url && !failed)) return <Skeleton className="aspect-square w-full rounded-lg" />;
  if (url) return <img src={url} alt={fileName(entry!.path)} className="aspect-square w-full rounded-lg border border-border bg-surface-muted object-contain" />;
  return (
    <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted text-muted-foreground">
      <ImageIcon className="size-6" aria-hidden />
      <span className="sr-only">{file && !failed ? "Not in this ZIP" : "No preview"}</span>
    </div>
  );
}
