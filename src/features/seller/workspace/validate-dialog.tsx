import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { EffectiveCategoryAttributeResponse, ValidateListingResponse } from "@/api/types/seller-listings";

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  pricingMode: "Pricing mode",
  currency: "Currency",
  basePrice: "Price",
  brandId: "Brand",
  unitId: "Quantity unit",
  conditionId: "Condition",
  gradeId: "Grade",
  attributes: "Attributes",
  system: "General",
};

function fieldLabel(field: string, attributes: EffectiveCategoryAttributeResponse[]): string {
  if (field.startsWith("attributes.")) {
    const id = field.slice("attributes.".length);
    return `Attribute: ${attributes.find((a) => a.attributeDefinitionId === id)?.name ?? "unknown"}`;
  }
  return FIELD_LABELS[field] ?? field;
}

/** Result of POST .../validate (advisory — submit doesn't run it). */
export function ValidateDialog({ result, attributes, open, onOpenChange }: { result: ValidateListingResponse | undefined; attributes: EffectiveCategoryAttributeResponse[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Completeness check"
        description="Checks your draft against the category's rules (brand, unit, condition, grade and attributes). Stock and photos are not part of this check."
        footer={<Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>}
      >
        {result &&
          (result.isValid ? (
            <div className="flex items-start gap-3 rounded-lg bg-success-soft p-4 text-success-soft-foreground" role="status">
              <CheckCircleIcon className="size-6 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">Everything the category requires is filled in.</p>
                <p className="text-sm">To submit you also need a price above 0 and at least one image (and stock above 0 before it can go live).</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                {result.errors.length} issue{result.errors.length === 1 ? "" : "s"} to fix before submitting:
              </p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {result.errors.map((e, i) => (
                  <li key={`${e.code}-${e.field}-${i}`} className="flex gap-3 px-4 py-3 text-sm">
                    <WarningCircleIcon className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{fieldLabel(e.field, attributes)}</p>
                      <p className="text-muted-foreground">{e.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </DialogContent>
    </Dialog>
  );
}
