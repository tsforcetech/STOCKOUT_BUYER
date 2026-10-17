import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError, FormField } from "@/components/forms/form-field";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { sellerListingsService } from "@/services/seller-listings.service";
import { LISTING_INVENTORY_LIMITS as I, type ListingInventoryResponse } from "@/api/types/seller-listings";
import { isInventoryConflict, sellerErrorMessage } from "../lib/errors";
import { decimalPattern } from "../lib/listing";
import { sellerKeys } from "../lib/queries";

const REASONS = ["STOCK_COUNT", "GOODS_RECEIVED", "DAMAGED", "SOLD_OFFLINE", "RETURNED", "CORRECTION"];

const meta = {
  reasonCode: z.string().trim().max(I.REASON_CODE_MAX_LENGTH, `Use ${I.REASON_CODE_MAX_LENGTH} characters or fewer.`),
  notes: z.string().trim().max(I.NOTES_MAX_LENGTH, `Use ${I.NOTES_MAX_LENGTH} characters or fewer.`),
};
const setSchema = z.object({
  onHand: z.string().trim().regex(decimalPattern(I.QUANTITY_DECIMAL_PLACES), `Enter 0 or more, with up to ${I.QUANTITY_DECIMAL_PLACES} decimals.`),
  ...meta,
});
const adjustSchema = z.object({
  delta: z
    .string()
    .trim()
    .regex(decimalPattern(I.QUANTITY_DECIMAL_PLACES, true), "Enter a number such as 10 or -2.5.")
    .refine((v) => Number(v) !== 0, "The change can't be zero."),
  ...meta,
});

function useInventoryWrite<T>(sellerId: string, listingId: string, fn: (inv: ListingInventoryResponse, values: T) => Promise<ListingInventoryResponse>, success: string) {
  const qc = useQueryClient();
  const key = sellerKeys.inventory(sellerId, listingId);
  return useApiMutation({
    toastOnError: false,
    mutationFn: async (values: T) => {
      const inv = qc.getQueryData<ListingInventoryResponse>(key);
      if (!inv) throw new Error("Stock hasn't loaded yet.");
      try {
        return await fn(inv, values);
      } catch (error) {
        // Buyer reservations also bump the inventory rowVersion, so refetch on any conflict.
        if (isInventoryConflict(error)) await qc.invalidateQueries({ queryKey: key });
        throw error;
      }
    },
    successMessage: success,
    onSuccess: (res) => {
      qc.setQueryData(key, res);
      void qc.invalidateQueries({ queryKey: ["seller", sellerId, "listings", "item", listingId, "movements"] });
    },
  });
}

function MetaFields({ prefix, register, errors, disabled }: { prefix: string; register: (name: "reasonCode" | "notes") => object; errors: { reasonCode?: { message?: string }; notes?: { message?: string } }; disabled?: boolean }) {
  return (
    <>
      <FormField label="Reason code" htmlFor={`${prefix}-reason`} error={errors.reasonCode?.message} hint={disabled ? "Ignored for the initial stock entry." : "Free text, max 50 characters."}>
        <Input list="inventory-reasons" maxLength={I.REASON_CODE_MAX_LENGTH} disabled={disabled} {...register("reasonCode")} />
      </FormField>
      <FormField label="Notes" htmlFor={`${prefix}-notes`} error={errors.notes?.message}>
        <Input maxLength={I.NOTES_MAX_LENGTH} disabled={disabled} {...register("notes")} />
      </FormField>
    </>
  );
}

export function SetStockForm({ sellerId, listingId, inventory, disabled }: { sellerId: string; listingId: string; inventory: ListingInventoryResponse; disabled: boolean }) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const initial = inventory.rowVersion === null;
  const form = useForm<z.infer<typeof setSchema>>({ resolver: zodResolver(setSchema), defaultValues: { onHand: initial ? "" : String(inventory.onHandQuantity), reasonCode: "", notes: "" } });
  const write = useInventoryWrite<z.infer<typeof setSchema>>(
    sellerId,
    listingId,
    (inv, v) =>
      sellerListingsService.setInventory(sellerId, listingId, {
        expectedRowVersion: inv.rowVersion,
        onHandQuantity: Number(v.onHand),
        reasonCode: v.reasonCode || null,
        notes: v.notes || null,
      }),
    "Stock updated.",
  );
  const submit = form.handleSubmit(async (v) => {
    setFormError(null);
    if (!initial && Number(v.onHand) < inventory.reservedQuantity) {
      form.setError("onHand", { message: `Can't be below the ${inventory.reservedQuantity} reserved by buyers.` });
      return;
    }
    try {
      await write.mutateAsync(v);
      form.reset({ onHand: v.onHand, reasonCode: "", notes: "" });
    } catch (error) {
      setFormError(sellerErrorMessage(error));
    }
  });
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <h3 className="font-heading text-base font-bold text-foreground">{initial ? "Set initial stock" : "Set on-hand quantity"}</h3>
      <FormError message={formError} />
      <fieldset disabled={disabled || form.formState.isSubmitting} className="space-y-3">
        <FormField label="On-hand quantity" htmlFor="set-onhand" required error={form.formState.errors.onHand?.message}>
          <Input inputMode="decimal" {...form.register("onHand")} />
        </FormField>
        <MetaFields prefix="set" register={form.register} errors={form.formState.errors} disabled={initial} />
      </fieldset>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={form.formState.isSubmitting} disabled={disabled}>
          {initial ? "Set stock" : "Update stock"}
        </Button>
      </div>
      <datalist id="inventory-reasons">
        {REASONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
    </form>
  );
}

export function AdjustStockForm({ sellerId, listingId, inventory, disabled }: { sellerId: string; listingId: string; inventory: ListingInventoryResponse; disabled: boolean }) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<z.infer<typeof adjustSchema>>({ resolver: zodResolver(adjustSchema), defaultValues: { delta: "", reasonCode: "", notes: "" } });
  const write = useInventoryWrite<z.infer<typeof adjustSchema>>(
    sellerId,
    listingId,
    (inv, v) => {
      if (!inv.rowVersion) throw new Error("Set the initial stock before making adjustments.");
      return sellerListingsService.adjustInventory(sellerId, listingId, { expectedRowVersion: inv.rowVersion, quantityDelta: Number(v.delta), reasonCode: v.reasonCode || null, notes: v.notes || null });
    },
    "Stock adjusted.",
  );
  const noRow = inventory.rowVersion === null;
  const submit = form.handleSubmit(async (v) => {
    setFormError(null);
    const next = inventory.onHandQuantity + Number(v.delta);
    if (next < 0) return form.setError("delta", { message: "On-hand stock can't go below 0." });
    if (next < inventory.reservedQuantity) return form.setError("delta", { message: `On-hand stock can't go below the ${inventory.reservedQuantity} reserved by buyers.` });
    try {
      await write.mutateAsync(v);
      form.reset({ delta: "", reasonCode: "", notes: "" });
    } catch (error) {
      setFormError(sellerErrorMessage(error));
    }
  });
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <h3 className="font-heading text-base font-bold text-foreground">Adjust stock</h3>
      {noRow && <p className="text-sm text-muted-foreground">Set the initial stock first.</p>}
      <FormError message={formError} />
      <fieldset disabled={disabled || noRow || form.formState.isSubmitting} className="space-y-3">
        <FormField label="Change (+/−)" htmlFor="adjust-delta" required error={form.formState.errors.delta?.message} hint="Positive to add, negative to remove.">
          <Input inputMode="decimal" placeholder="e.g. 25 or -3" {...form.register("delta")} />
        </FormField>
        <MetaFields prefix="adjust" register={form.register} errors={form.formState.errors} />
      </fieldset>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={form.formState.isSubmitting} disabled={disabled || noRow}>
          Apply adjustment
        </Button>
      </div>
    </form>
  );
}
