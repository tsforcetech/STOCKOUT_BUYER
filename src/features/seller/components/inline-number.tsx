import * as React from "react";
import { toast } from "sonner";
import { CircleNotchIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";
import { sellerErrorMessage } from "../lib/errors";

/**
 * A value that turns into a number box when clicked: Enter or leaving the box saves, Escape cancels.
 * Used on listing cards for price and stock so small changes don't need the editor.
 */
export function InlineNumber({
  label,
  value,
  display,
  onSave,
  pattern,
  invalidMessage,
  className,
  inputClassName,
}: {
  /** Accessible name, e.g. "Price of Gate valve". */
  label: string;
  value: number | undefined;
  display: React.ReactNode;
  onSave: (value: number) => Promise<unknown>;
  pattern: RegExp;
  invalidMessage: string;
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const busy = React.useRef(false);

  React.useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const commit = async () => {
    if (busy.current) return;
    const t = text.trim().replace(/,/g, "");
    if (t === "" || Number(t) === value) return setEditing(false);
    if (!pattern.test(t)) {
      toast.error(invalidMessage);
      return input.current?.focus();
    }
    busy.current = true;
    setSaving(true);
    try {
      await onSave(Number(t));
      setEditing(false);
    } catch (error) {
      toast.error(sellerErrorMessage(error));
      input.current?.focus();
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  if (!editing)
    return (
      <button
        type="button"
        className={cn("group/inline inline-flex cursor-pointer items-center gap-1 rounded px-0.5 -mx-0.5 hover:bg-surface-muted", className)}
        aria-label={`Edit ${label.toLowerCase()}`}
        title="Click to change"
        onClick={() => {
          setText(value === undefined ? "" : String(value));
          setEditing(true);
        }}
      >
        {display}
        <PencilSimpleIcon className="size-3 shrink-0 opacity-40 group-hover/inline:opacity-100" aria-hidden />
      </button>
    );

  return (
    <span className="inline-flex items-center gap-1">
      <input
        ref={input}
        aria-label={label}
        inputMode="decimal"
        disabled={saving}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          } else if (e.key === "Escape") setEditing(false);
        }}
        onBlur={() => void commit()}
        className={cn("h-7 w-24 rounded border border-border-strong bg-surface px-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring", inputClassName)}
      />
      {saving && <CircleNotchIcon className="size-4 animate-spin text-muted-foreground" aria-label="Saving" />}
    </span>
  );
}
