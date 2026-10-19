import * as React from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { NativeSelect } from "@/components/ui/input";
import { downloadCsv } from "@/lib/utils/csv";
import { sellerErrorMessage } from "../lib/errors";
import { useCategoryIndex, useListingRequirements } from "../lib/queries";
import { Notice } from "../components/notice";
import { categoryLabel } from "./rows";
import { buildTemplateCsv, COLUMN_HELP, TEMPLATE_NOTES } from "./template";

/** Live units / conditions for one category, so sellers can copy the exact codes into the file. */
function ValueLookup() {
  const { index, isLoading, error } = useCategoryIndex();
  const [categoryId, setCategoryId] = React.useState("");
  const req = useListingRequirements(categoryId || null);
  const options = React.useMemo(() => [...index.values()], [index]);
  const units = req.data?.unitRules.units ?? [];
  const conditions = req.data?.conditionRules.conditions ?? [];

  return (
    <div className="space-y-3">
      <label className="block max-w-md space-y-1">
        <span className="text-sm font-medium text-foreground">Look up the units and conditions for a category</span>
        <NativeSelect value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={isLoading || !!error}>
          <option value="">{isLoading ? "Loading categories…" : error ? "Couldn't load categories" : "Choose a category"}</option>
          {options.map((c) => (
            <option key={c.categoryId} value={c.categoryId}>
              {categoryLabel(c.path)}
            </option>
          ))}
        </NativeSelect>
      </label>
      {categoryId &&
        (req.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : req.error ? (
          <Notice tone="danger">{sellerErrorMessage(req.error)}</Notice>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Units (unit column)</p>
              {units.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {units.map((u) => (
                    <li key={u.unitId}>
                      <Badge tone={u.unitId === req.data?.unitRules.defaultUnitId ? "primary" : "neutral"} title={`${u.name}${u.quantityDecimalPrecision === 0 ? " — whole numbers only" : ""}`}>
                        <span className="font-mono">{u.code}</span> {u.name}
                        {u.unitId === req.data?.unitRules.defaultUnitId && " · default"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">None — leave the unit empty.</p>
              )}
            </div>
            <div className="min-w-0">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Conditions (condition column){req.data?.conditionRules.isConditionRequired && " · required for approval"}
              </p>
              {conditions.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {conditions.map((c) => (
                    <li key={c.conditionId}>
                      <Badge tone="neutral">
                        <span className="font-mono">{c.code}</span> {c.name}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">None — leave the condition empty.</p>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}

export function TemplateStep() {
  const { index } = useCategoryIndex();
  const download = () => {
    // Use a real leaf category from the live tree for the example rows when we have one.
    const leaf = [...index.values()].find((c) => c.isLeaf && c.depth > 0) ?? [...index.values()].find((c) => c.isLeaf);
    downloadCsv("stockout-bulk-listings-template.csv", buildTemplateCsv(leaf ? categoryLabel(leaf.path) : undefined));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ul className="list-disc space-y-1 pl-5 text-sm text-body">
          {TEMPLATE_NOTES.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <Button variant="primary" onClick={download} className="self-start sm:self-center">
          <DownloadSimpleIcon /> Download CSV template
        </Button>
      </div>

      <details className="group rounded-lg border border-border bg-cream px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">What goes in each column</summary>
        <div className="-mx-4 mt-3 overflow-x-auto px-4">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Template columns</caption>
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Column
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  What to enter
                </th>
                <th scope="col" className="py-2 font-medium">
                  Example
                </th>
              </tr>
            </thead>
            <tbody>
              {COLUMN_HELP.map((c) => (
                <tr key={c.column} className="border-b border-border align-top last:border-0">
                  <td className="whitespace-nowrap py-2 pr-3">
                    <code className="font-mono text-foreground">{c.column}</code>
                    {c.required ? (
                      <Badge tone="primary" className="ml-2">
                        Required
                      </Badge>
                    ) : (
                      <span className="ml-2 text-xs text-muted-foreground">Optional</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-body">{c.description}</td>
                  <td className="py-2 font-mono text-xs text-muted-foreground">{c.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="rounded-lg border border-border bg-cream px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">Find unit and condition codes</summary>
        <div className="mt-3">
          <ValueLookup />
        </div>
      </details>
    </div>
  );
}
