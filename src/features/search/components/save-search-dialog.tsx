import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { FormError, FormField } from "@/components/forms/form-field";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { searchService } from "@/services/search.service";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { effectiveCurrency, MAX_QUERY_LENGTH, priceOrUndefined, type SearchState } from "../lib/search-params";

const FREQUENCIES = [
  { value: "NONE", label: "No alerts" },
  { value: "INSTANT", label: "Instantly" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
] as const;

export function SaveSearchDialog({ open, onOpenChange, state, defaultName }: { open: boolean; onOpenChange: (o: boolean) => void; state: SearchState; defaultName: string }) {
  const [name, setName] = React.useState(defaultName);
  const [frequency, setFrequency] = React.useState<(typeof FREQUENCIES)[number]["value"]>("NONE");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setName(defaultName);
      setError(null);
    }
  }, [open, defaultName]);

  const save = useApiMutation({
    mutationFn: () =>
      searchService.createSavedSearch({
        searchName: name.trim(),
        queryText: state.q.slice(0, MAX_QUERY_LENGTH) || null,
        categoryId: state.categoryId || null,
        brandIds: state.brandId.length ? state.brandId : null,
        conditionIds: state.conditionId.length ? state.conditionId : null,
        gradeIds: state.gradeId.length ? state.gradeId : null,
        stateOrEmirate: state.stateOrEmirate || null,
        // Same rule as the search request: price filters/sorts need a currency (50904).
        currency: effectiveCurrency(state) ?? null,
        minPrice: priceOrUndefined(state.minPrice) ?? null,
        maxPrice: priceOrUndefined(state.maxPrice) ?? null,
        inStockOnly: state.inStockOnly || null,
        sort: state.sort,
        alertFrequency: frequency,
      }),
    invalidate: [["saved-searches"]],
    successMessage: "Search saved.",
    toastOnError: false,
    onSuccess: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Save this search"
        description="Find it again from your account, and optionally get alerts when new matching stock is listed."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button
              loading={save.isPending}
              onClick={() => {
                if (!name.trim()) return setError("Give your search a name.");
                save.mutate(undefined, {
                  onError: (e) => setError(isApiError(e) && e.status === 409 ? "You've reached the maximum of 50 saved searches. Delete one to save another." : getErrorMessage(e)),
                });
              }}
            >
              Save search
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormError message={error} />
          <FormField label="Name" htmlFor="saved-name" required>
            <Input maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Email alerts" htmlFor="saved-frequency">
            <NativeSelect value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
      </DialogContent>
    </Dialog>
  );
}
