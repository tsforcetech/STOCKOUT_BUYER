import { Checkbox } from "@/components/ui/misc";
import { Input, NativeSelect } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { formatNumber } from "@/lib/utils/format";
import type { EffectiveCategoryAttributeResponse } from "@/api/types/seller-listings";

/** Client-side check mirroring A2 format rules and the L7 constraints. Returns an error message or null. */
export function attributeError(def: EffectiveCategoryAttributeResponse, values: string[]): string | null {
  const v = (values[0] ?? "").trim();
  if (values.every((x) => !x.trim())) return null; // empty = not stored; "required" is reported separately
  switch (def.dataType) {
    case "INTEGER": {
      if (!/^[-+]?\d+$/.test(v)) return "Enter a whole number.";
      const n = Number(v);
      if (def.minValue !== null && n < def.minValue) return `Must be at least ${formatNumber(def.minValue)}.`;
      if (def.maxValue !== null && n > def.maxValue) return `Must be at most ${formatNumber(def.maxValue)}.`;
      return null;
    }
    case "DECIMAL": {
      if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(v)) return "Enter a number (use . for decimals, no thousands separators).";
      const decimals = v.includes(".") ? v.split(".")[1].length : 0;
      const places = def.decimalPrecision ?? 4;
      if (decimals > places) return `Use at most ${places} decimal place${places === 1 ? "" : "s"}.`;
      const n = Number(v);
      if (def.minValue !== null && n < def.minValue) return `Must be at least ${formatNumber(def.minValue)}.`;
      if (def.maxValue !== null && n > def.maxValue) return `Must be at most ${formatNumber(def.maxValue)}.`;
      return null;
    }
    case "DATE":
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? null : "Enter a date.";
    case "BOOLEAN":
      return v === "true" || v === "false" ? null : "Choose yes or no.";
    case "TEXT": {
      if (def.minLength !== null && v.length < def.minLength) return `Use at least ${def.minLength} characters.`;
      if (def.maxLength !== null && v.length > def.maxLength) return `Use ${def.maxLength} characters or fewer.`;
      if (def.regexPattern) {
        try {
          if (!new RegExp(def.regexPattern).test(v)) return "This value doesn't match the required format.";
        } catch {
          return null; // pattern not valid in JS; the server-side check (validate) still applies
        }
      }
      return null;
    }
    case "SINGLE_SELECT":
    case "MULTI_SELECT":
      return values.every((x) => !x || def.options.some((o) => o.attributeOptionId === x && o.isActive)) ? null : "One of the selected options is no longer available.";
  }
}

function hint(def: EffectiveCategoryAttributeResponse): string | undefined {
  const parts: string[] = [];
  if (def.description) parts.push(def.description);
  if (def.minValue !== null || def.maxValue !== null) parts.push(`Range ${def.minValue ?? "…"} – ${def.maxValue ?? "…"}`);
  if (def.maxLength !== null) parts.push(`Max ${def.maxLength} characters`);
  if (def.isRequired) parts.push("Required for approval");
  return parts.join(" · ") || undefined;
}

export function AttributeInput({ def, values, onChange, error, disabled }: { def: EffectiveCategoryAttributeResponse; values: string[]; onChange: (values: string[]) => void; error?: string; disabled?: boolean }) {
  const id = `attr-${def.attributeDefinitionId}`;
  const value = values[0] ?? "";
  const options = [...def.options].filter((o) => o.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
  const set = (v: string) => onChange(v === "" ? [] : [v]);

  if (def.dataType === "MULTI_SELECT") {
    return (
      <fieldset className="space-y-1.5" aria-describedby={error ? `${id}-error` : undefined} disabled={disabled}>
        <legend className="text-sm text-body">
          {def.name}
          {def.isRequired && (
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
          )}
        </legend>
        {options.length === 0 ? (
          <p className="text-xs text-muted-foreground">No options available.</p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-input px-3 py-2.5">
            {options.map((o) => {
              const checked = values.includes(o.attributeOptionId);
              return (
                <label key={o.attributeOptionId} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={checked} disabled={disabled} onCheckedChange={(c) => onChange(c === true ? [...values, o.attributeOptionId] : values.filter((x) => x !== o.attributeOptionId))} />
                  {o.value}
                </label>
              );
            })}
          </div>
        )}
        {error ? (
          <p id={`${id}-error`} className="text-xs text-danger-soft-foreground" role="alert">
            {error}
          </p>
        ) : (
          hint(def) && <p className="text-xs text-muted-foreground">{hint(def)}</p>
        )}
      </fieldset>
    );
  }

  const control =
    def.dataType === "SINGLE_SELECT" ? (
      <NativeSelect value={value} disabled={disabled} onChange={(e) => set(e.target.value)}>
        <option value="">Not specified</option>
        {options.map((o) => (
          <option key={o.attributeOptionId} value={o.attributeOptionId}>
            {o.value}
          </option>
        ))}
        {value && !options.some((o) => o.attributeOptionId === value) && <option value={value}>Unavailable option</option>}
      </NativeSelect>
    ) : def.dataType === "BOOLEAN" ? (
      <NativeSelect value={value.toLowerCase()} disabled={disabled} onChange={(e) => set(e.target.value)}>
        <option value="">Not specified</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </NativeSelect>
    ) : def.dataType === "DATE" ? (
      <Input type="date" value={value} disabled={disabled} onChange={(e) => set(e.target.value)} />
    ) : (
      <Input
        value={value}
        disabled={disabled}
        inputMode={def.dataType === "INTEGER" ? "numeric" : def.dataType === "DECIMAL" ? "decimal" : undefined}
        maxLength={def.dataType === "TEXT" && def.maxLength !== null ? def.maxLength : undefined}
        onChange={(e) => set(e.target.value)}
      />
    );

  return (
    <FormField label={def.name} htmlFor={id} required={def.isRequired} error={error} hint={hint(def)}>
      {control}
    </FormField>
  );
}
