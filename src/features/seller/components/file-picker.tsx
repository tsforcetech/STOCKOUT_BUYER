import * as React from "react";
import { FileIcon, PaperclipIcon, XIcon } from "@phosphor-icons/react";
import { formatBytes } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { useFileDrop } from "../lib/file-drop";

/**
 * Styled single-file picker (replaces the browser's raw "Choose File · No file chosen" control). Accepts a file
 * dropped onto it as well as click/tap to browse.
 * Keeps a real <input type="file"> (visually hidden) so labels, keyboard and form semantics still work.
 */
export const FilePicker = React.forwardRef<
  HTMLInputElement,
  {
    id?: string;
    file: File | null;
    accept: string;
    disabled?: boolean;
    invalid?: boolean;
    placeholder?: string;
    onChange: (file: File | null) => void;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    "aria-required"?: boolean;
  }
>(function FilePicker({ id, file, accept, disabled, invalid: invalidProp, placeholder = "Choose a file", onChange, "aria-describedby": describedBy, "aria-invalid": ariaInvalid, "aria-required": ariaRequired }, ref) {
  const invalid = invalidProp || ariaInvalid;
  const inner = React.useRef<HTMLInputElement | null>(null);
  const setRef = (el: HTMLInputElement | null) => {
    inner.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };
  const { over, handlers } = useFileDrop({ accept, disabled, onFiles: (files) => onChange(files[0] ?? null) });
  const clear = () => {
    if (inner.current) inner.current.value = "";
    onChange(null);
  };

  return (
    <div
      {...handlers}
      className={cn(
        "relative flex min-h-11 items-center gap-3 rounded-md border border-dashed bg-surface px-3 py-2 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
        over ? "border-action-border bg-action-soft" : invalid ? "border-danger" : "border-secondary-border hover:border-action-border",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-foreground ring-1 ring-border" aria-hidden>
        {file ? <FileIcon className="size-4" /> : <PaperclipIcon className="size-4" />}
      </span>
      <span className="min-w-0 flex-1 text-sm">
        {file ? (
          <>
            <span className="block truncate font-medium text-foreground" title={file.name}>
              {file.name}
            </span>
            <span className="block text-xs text-muted-foreground">{formatBytes(file.size)}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{over ? "Drop the file here" : `${placeholder} or drag it here`}</span>
        )}
      </span>
      <span className="shrink-0 rounded-md border border-secondary-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground">{file ? "Change" : "Browse"}</span>
      {/* The input covers the whole box so a click/tap anywhere opens the picker. */}
      <input
        ref={setRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required={ariaRequired}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file && !disabled && (
        <button type="button" onClick={clear} className="relative z-10 shrink-0 cursor-pointer rounded-sm p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground" aria-label={`Remove ${file.name}`}>
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  );
});
