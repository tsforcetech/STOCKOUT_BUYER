import * as React from "react";
import { DownloadSimpleIcon, type Icon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useFileDrop } from "../lib/file-drop";

interface Props {
  id: string;
  label: string;
  hint: React.ReactNode;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  icon: Icon;
  buttonLabel: string;
  onFiles: (files: File[]) => void;
  /** Reject files outside `accept` here (default). Turn off when `onFiles` explains wrong files itself. */
  filter?: boolean;
  children?: React.ReactNode;
}

/**
 * Drag & drop target: drop files anywhere on it, or click/tap anywhere (or use the button / keyboard) to choose.
 * Files outside `accept` are rejected with a message instead of being passed on.
 */
export function DropZone({ id, label, hint, accept, multiple, disabled, icon: IconCmp, buttonLabel, onFiles, filter = true, children }: Props) {
  const input = React.useRef<HTMLInputElement>(null);
  const { over, handlers, take } = useFileDrop({ accept: filter ? accept : "", multiple, disabled, onFiles });
  const open = () => {
    if (!disabled) input.current?.click();
  };

  return (
    <div
      {...handlers}
      onClick={(e) => {
        // Clicks on inner controls (the button, links in children) handle themselves.
        if ((e.target as HTMLElement).closest("button, a, input")) return;
        open();
      }}
      className={cn(
        "relative flex min-w-0 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors",
        over ? "border-action-border bg-action-soft" : "border-border-strong bg-cream hover:border-foreground/40",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className={cn("flex size-12 items-center justify-center rounded-full bg-surface ring-1 ring-border transition-transform", over && "scale-110")}>
        {over ? <DownloadSimpleIcon className="size-6 text-foreground" aria-hidden /> : <IconCmp className="size-6 text-muted-foreground" aria-hidden />}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{over ? `Drop to add ${multiple ? "files" : "file"}` : label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
      <Button variant="secondary" size="sm" disabled={disabled} onClick={open}>
        {buttonLabel}
      </Button>
      {children}
    </div>
  );
}
