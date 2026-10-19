import * as React from "react";
import type { Icon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

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
  children?: React.ReactNode;
}

/** Drag & drop target with a regular file-picker button (keyboard and touch friendly). */
export function DropZone({ id, label, hint, accept, multiple, disabled, icon: IconCmp, buttonLabel, onFiles, children }: Props) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) take(e.dataTransfer.files);
      }}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
        over ? "border-action-border bg-action-soft" : "border-border-strong bg-cream",
        disabled && "opacity-60",
      )}
    >
      <IconCmp className="size-8 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
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
      <Button variant="secondary" size="sm" disabled={disabled} onClick={() => input.current?.click()}>
        {buttonLabel}
      </Button>
      {children}
    </div>
  );
}
