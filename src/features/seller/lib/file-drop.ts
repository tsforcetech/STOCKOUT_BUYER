import * as React from "react";
import { toast } from "sonner";

/** True when `file` matches an `accept` string ("image/png,image/*,.csv"). An empty accept allows everything. */
export function matchesAccept(file: File, accept: string): boolean {
  const rules = accept
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  if (!rules.length) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return rules.some((r) => (r.startsWith(".") ? name.endsWith(r) : r.endsWith("/*") ? type.startsWith(r.slice(0, -1)) : type === r));
}

/** Short human list of what `accept` allows, e.g. "JPG, PNG, WEBP" or "CSV". */
export function describeAccept(accept: string): string {
  const names = accept
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => (r.startsWith(".") ? r.slice(1) : r.endsWith("/*") ? `${r.slice(0, -2)} files` : (r.split("/")[1] ?? r)).replace(/^jpeg$/i, "jpg").toUpperCase());
  return [...new Set(names)].join(", ");
}

let guards = 0;
const stop = (e: DragEvent) => {
  // Files dropped next to a drop zone would otherwise open in the tab and leave the page.
  if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
};

/**
 * Drag & drop handlers for a file target: counts enter/leave so moving over child elements doesn't flicker,
 * filters by `accept` (rejected files are named in a toast), keeps only the first file unless `multiple`,
 * and while mounted stops the browser from opening files dropped outside the target.
 */
export function useFileDrop({ accept, multiple, disabled, onFiles }: { accept: string; multiple?: boolean; disabled?: boolean; onFiles: (files: File[]) => void }) {
  const [over, setOver] = React.useState(false);
  const depth = React.useRef(0);

  React.useEffect(() => {
    if (guards++ === 0) {
      window.addEventListener("dragover", stop);
      window.addEventListener("drop", stop);
    }
    return () => {
      if (--guards === 0) {
        window.removeEventListener("dragover", stop);
        window.removeEventListener("drop", stop);
      }
    };
  }, []);

  const take = React.useCallback(
    (list: FileList | File[] | null | undefined) => {
      const all = Array.from(list ?? []);
      if (!all.length) return;
      const ok = all.filter((f) => matchesAccept(f, accept));
      const rejected = all.filter((f) => !matchesAccept(f, accept));
      if (rejected.length) {
        const names = rejected.slice(0, 3).map((f) => f.name).join(", ");
        toast.error(`${rejected.length === 1 ? "This file isn't" : "These files aren't"} supported: ${names}${rejected.length > 3 ? ` and ${rejected.length - 3} more` : ""}. Use ${describeAccept(accept)}.`);
      }
      if (ok.length) onFiles(multiple ? ok : ok.slice(0, 1));
    },
    [accept, multiple, onFiles],
  );

  const handlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (disabled || !e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      depth.current += 1;
      setOver(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (disabled || !e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      if (!disabled) take(e.dataTransfer.files);
    },
  };

  return { over, handlers, take };
}
