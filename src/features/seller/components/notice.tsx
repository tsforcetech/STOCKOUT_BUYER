import type * as React from "react";
import { InfoIcon, WarningIcon, WarningOctagonIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";

const TONES = {
  info: { box: "border-border bg-info-soft text-info-soft-foreground", icon: InfoIcon },
  warning: { box: "border-warning/30 bg-warning-soft text-warning-soft-foreground", icon: WarningIcon },
  danger: { box: "border-danger/30 bg-danger-soft text-danger-soft-foreground", icon: WarningOctagonIcon },
} as const;

/** Inline notice for state explanations and known backend limitations (never for fake success). */
export function Notice({ tone = "info", title, children, className, action }: { tone?: keyof typeof TONES; title?: React.ReactNode; children?: React.ReactNode; className?: string; action?: React.ReactNode }) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", t.box, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
        {action && <div className="pt-1">{action}</div>}
      </div>
    </div>
  );
}
