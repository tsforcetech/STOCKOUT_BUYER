import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircleIcon, ImagesIcon, PaperPlaneTiltIcon, StarIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FormError, FormField } from "@/components/forms/form-field";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { PageSkeleton } from "@/components/feedback/states";
import { cn } from "@/lib/utils/cn";
import { formatBytes } from "@/lib/utils/format";
import { newId } from "@/lib/utils/id";
import { filesService } from "@/services/files.service";
import { sellerListingsService } from "@/services/seller-listings.service";
import {
  LISTING_INVENTORY_LIMITS as I,
  LISTING_MEDIA_FILE_PURPOSE,
  LISTING_MEDIA_LIMITS as M,
  SELLER_LISTING_LIMITS as L,
  type CreateListingDraftRequest,
} from "@/api/types/seller-listings";
import { DropZone } from "./bulk/drop-zone";
import { BackLink } from "./components/back-link";
import { CategoryPicker } from "./components/category-picker";
import { ListingAccessNotice, canManageListings } from "./components/listing-access-notice";
import { Notice } from "./components/notice";
import { sellerErrorMessage } from "./lib/errors";
import { decimalPattern } from "./lib/listing";
import { loadQuickDefaults, saveQuickDefaults, suggestCategories } from "./lib/quick-listing";
import { sellerKeys, useActiveSeller, useCategoryIndex, useListingDetail, useListingRequirements, useSellerAccount } from "./lib/queries";
import { EMIRATES } from "./verify/steps";

interface Photo {
  id: string;
  file: File;
  url: string;
}

interface Values {
  title: string;
  categoryId: string;
  price: string;
  currency: string;
  quantity: string;
  unitId: string;
  conditionId: string;
  description: string;
  countryCode: string;
  stateOrEmirate: string;
  city: string;
}

type Errors = Partial<Record<keyof Values | "photos", string>>;

const STAGE: Record<string, string> = {
  photos: "adding the photos",
  stock: "setting the stock",
  submit: "sending it for review",
};

/**
 * Quick add: photos, title, price and quantity on one page. The category is suggested from the title, and
 * currency, condition and location are remembered from the seller's last listing. Saving creates the draft,
 * attaches the photos, sets the stock and (optionally) submits it — the same calls the full editor makes.
 * `?from=<listingId>` duplicates an existing listing's details (not its photos or stock).
 */
export default function SellerListingQuickPage() {
  const seller = useActiveSeller();
  const sellerId = seller.sellerId;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const from = params.get("from") ?? "";
  const account = useSellerAccount(sellerId);
  const { index } = useCategoryIndex();
  const source = useListingDetail(sellerId, from);

  const remembered = React.useMemo(() => loadQuickDefaults(sellerId), [sellerId]);
  const initial = React.useCallback(
    (): Values => ({
      title: "",
      categoryId: "",
      price: "",
      currency: remembered.currency ?? "",
      quantity: "",
      unitId: "",
      conditionId: "",
      description: "",
      countryCode: remembered.countryCode ?? "AE",
      stateOrEmirate: remembered.stateOrEmirate ?? "",
      city: remembered.city ?? "",
    }),
    [remembered],
  );
  const [values, setValues] = React.useState<Values>(initial);
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [browse, setBrowse] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [progress, setProgress] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<{ listingId: string; title: string; submitted: boolean } | null>(null);
  const attempt = React.useRef<{ body: string; key: string } | null>(null);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Currency: remembered, else the seller account's default.
  React.useEffect(() => {
    const cur = account.data?.defaultCurrency;
    if (cur) setValues((v) => (v.currency ? v : { ...v, currency: cur }));
  }, [account.data]);

  // Duplicate: copy the source listing's details once.
  const copied = React.useRef(false);
  React.useEffect(() => {
    const v = source.data?.currentDraftVersion ?? source.data?.publishedVersion;
    if (!from || !v || copied.current) return;
    copied.current = true;
    setValues((cur) => ({
      ...cur,
      title: v.title,
      categoryId: v.categoryId,
      price: String(v.basePrice),
      currency: v.currency,
      unitId: v.quantityUnitId ?? "",
      conditionId: v.conditionId ?? "",
      description: v.description ?? "",
      countryCode: v.location?.countryCode ?? cur.countryCode,
      stateOrEmirate: v.location?.stateOrEmirate ?? cur.stateOrEmirate,
      city: v.location?.city ?? cur.city,
    }));
  }, [from, source.data]);

  const suggestions = React.useMemo(() => suggestCategories(values.title, index.values()), [values.title, index]);
  // Pre-select the best suggestion (or last time's category) until the seller picks one themselves.
  const pickedByUser = React.useRef(false);
  React.useEffect(() => {
    if (pickedByUser.current || from) return;
    const best = suggestions[0]?.categoryId ?? (remembered.categoryId && index.has(remembered.categoryId) ? remembered.categoryId : "");
    setValues((v) => (v.categoryId === best ? v : { ...v, categoryId: best }));
  }, [suggestions, remembered.categoryId, index, from]);
  const chooseCategory = (id: string) => {
    pickedByUser.current = true;
    set("categoryId", id);
    setBrowse(false);
  };

  const req = useListingRequirements(values.categoryId || null);
  const units = req.data?.unitRules.units ?? [];
  const conditions = req.data?.conditionRules.conditions ?? [];
  // Keep unit and condition valid for the chosen category: default unit, last time's condition.
  React.useEffect(() => {
    if (!req.data) return;
    const u = req.data.unitRules;
    const c = req.data.conditionRules.conditions;
    setValues((v) => {
      const unitId = u.units.some((x) => x.unitId === v.unitId) ? v.unitId : (u.defaultUnitId ?? u.units[0]?.unitId ?? "");
      const conditionId = c.some((x) => x.conditionId === v.conditionId) ? v.conditionId : (c.find((x) => x.code === remembered.conditionCode)?.conditionId ?? "");
      return unitId === v.unitId && conditionId === v.conditionId ? v : { ...v, unitId, conditionId };
    });
  }, [req.data, remembered.conditionCode]);

  // Revoke preview URLs when photos go away.
  const photosRef = React.useRef(photos);
  photosRef.current = photos;
  React.useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const addPhotos = (files: File[]) => {
    const room = M.DEFAULT_MAX_IMAGES - photos.length;
    const bad = files.find((f) => !(M.IMAGE_MIME_TYPES as readonly string[]).includes(f.type) || f.size > M.IMAGE_MAX_BYTES);
    if (bad) return setErrors((e) => ({ ...e, photos: `“${bad.name}” can't be used. Use JPG, PNG or WebP up to ${formatBytes(M.IMAGE_MAX_BYTES)}.` }));
    if (files.length > room) return setErrors((e) => ({ ...e, photos: `You can add up to ${M.DEFAULT_MAX_IMAGES} photos.` }));
    setErrors((e) => ({ ...e, photos: undefined }));
    setPhotos((p) => [...p, ...files.map((file) => ({ id: newId(), file, url: URL.createObjectURL(file) }))]);
  };
  const removePhoto = (id: string) =>
    setPhotos((p) => {
      const gone = p.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return p.filter((x) => x.id !== id);
    });
  const makeCover = (id: string) => setPhotos((p) => [...p.filter((x) => x.id === id), ...p.filter((x) => x.id !== id)]);

  const location = values.countryCode.trim() && values.stateOrEmirate.trim() && values.city.trim() ? `${values.city}, ${values.stateOrEmirate}` : null;
  const category = values.categoryId ? index.get(values.categoryId) : undefined;
  const canSubmitNow = photos.length > 0 && Number(values.price) > 0;

  const validate = (): Errors => {
    const e: Errors = {};
    if (!values.title.trim()) e.title = "Enter a title.";
    if (!values.categoryId) e.categoryId = "Choose a category.";
    if (!decimalPattern(L.PRICE_DECIMAL_PLACES).test(values.price.trim())) e.price = "Enter a price, e.g. 250 or 12.50.";
    if (!/^[A-Za-z]{3}$/.test(values.currency.trim())) e.currency = "Use a 3-letter code, e.g. AED.";
    if (!decimalPattern(I.QUANTITY_DECIMAL_PLACES).test(values.quantity.trim())) e.quantity = "Enter how many you have, e.g. 120.";
    if (req.data?.conditionRules.isConditionRequired && !values.conditionId) e.conditionId = "This category needs a condition.";
    // The country is pre-filled, so the location only counts once an emirate or city is entered.
    if ((values.stateOrEmirate.trim() || values.city.trim()) && [values.countryCode, values.stateOrEmirate, values.city].some((x) => !x.trim()))
      e.city = "Fill in country, emirate and city together, or leave emirate and city empty.";
    return e;
  };

  const save = async (andSubmit: boolean) => {
    setFormError(null);
    setSaved(null);
    const e = validate();
    setErrors(e);
    if (Object.values(e).some(Boolean)) {
      if (e.city) setMoreOpen(true);
      return;
    }
    let listingId: string | null = null;
    let stage = "create";
    try {
      setProgress("Creating the listing…");
      const body: CreateListingDraftRequest = {
        categoryId: values.categoryId,
        title: values.title.trim(),
        description: values.description.trim() || null,
        pricingMode: "FIXED_PRICE",
        currency: values.currency.trim().toUpperCase(),
        basePrice: Number(values.price),
        conditionId: values.conditionId || null,
        quantityUnitId: values.unitId || null,
        location: location ? { countryCode: values.countryCode.trim().toUpperCase(), stateOrEmirate: values.stateOrEmirate.trim(), city: values.city.trim() } : null,
      };
      const json = JSON.stringify(body);
      if (!attempt.current || attempt.current.body !== json) attempt.current = { body: json, key: newId() };
      const created = await sellerListingsService.create(sellerId, body, attempt.current.key);
      listingId = created.listingId;
      let rowVersion = created.rowVersion;

      stage = "photos";
      for (const [i, photo] of photos.entries()) {
        setProgress(`Uploading photo ${i + 1} of ${photos.length}…`);
        const asset = await filesService.upload(photo.file, LISTING_MEDIA_FILE_PURPOSE.IMAGE);
        rowVersion = (await sellerListingsService.attachMedia(sellerId, listingId, { expectedRowVersion: rowVersion, fileAssetId: asset.fileId, mediaType: "IMAGE", isPrimary: i === 0 })).rowVersion;
      }

      stage = "stock";
      setProgress("Setting the stock…");
      await sellerListingsService.setInventory(sellerId, listingId, { expectedRowVersion: null, onHandQuantity: Number(values.quantity) });

      if (andSubmit) {
        stage = "submit";
        setProgress("Sending for review…");
        await sellerListingsService.submit(sellerId, listingId, { listingVersionId: created.currentDraftVersionId, expectedRowVersion: rowVersion }, newId());
      }

      attempt.current = null;
      saveQuickDefaults(sellerId, {
        categoryId: values.categoryId,
        currency: body.currency,
        conditionCode: conditions.find((c) => c.conditionId === values.conditionId)?.code,
        countryCode: values.countryCode,
        stateOrEmirate: values.stateOrEmirate,
        city: values.city,
      });
      void qc.invalidateQueries({ queryKey: sellerKeys.listings(sellerId) });
      setSaved({ listingId, title: body.title, submitted: andSubmit });
      // Ready for the next item: keep category, unit, condition, currency and location.
      photos.forEach((p) => URL.revokeObjectURL(p.url));
      setPhotos([]);
      setValues((v) => ({ ...v, title: "", price: "", quantity: "", description: "" }));
      pickedByUser.current = true;
      window.scrollTo?.({ top: 0 });
    } catch (error) {
      if (!listingId) {
        setFormError(sellerErrorMessage(error));
        return;
      }
      void qc.invalidateQueries({ queryKey: sellerKeys.listings(sellerId) });
      toast.error(`Your listing was saved as a draft, but ${STAGE[stage]} didn't finish: ${sellerErrorMessage(error)} You can finish it here.`, { duration: 10_000 });
      navigate(`/seller/listings/${listingId}`);
    } finally {
      setProgress(null);
    }
  };

  const busy = progress !== null;

  if (!canManageListings(seller)) {
    return (
      <>
        <BackLink to="/seller/listings">All listings</BackLink>
        <PageHeader eyebrow="Seller portal" title="Add a listing" />
        <ListingAccessNotice seller={seller} />
      </>
    );
  }
  if (from && source.isLoading) return <PageSkeleton />;

  return (
    <>
      <BackLink to="/seller/listings">All listings</BackLink>
      <PageHeader
        eyebrow="Seller portal"
        title={from ? "Duplicate listing" : "Add a listing"}
        description="Photos, title, price and quantity — that's all you need. You can add more details later."
        actions={
          <Button asChild variant="secondary">
            <Link to="/seller/listings/new">Use the detailed form</Link>
          </Button>
        }
      />

      {saved && (
        <Notice
          className="mb-4"
          title={saved.submitted ? "Listed and sent for review" : "Draft saved"}
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to={`/seller/listings/${saved.listingId}`}>Open listing</Link>
            </Button>
          }
        >
          “{saved.title}” is saved. Add the next item below — category, unit and location are kept.
        </Notice>
      )}
      {from && source.data && (
        <Notice className="mb-4" title="Copied from your listing">
          Details are copied. Add photos and the quantity for this item — photos and stock aren't copied.
        </Notice>
      )}

      <SectionCard>
        <form
          noValidate
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void save(false);
          }}
        >
          <FormError message={formError} />
          <fieldset disabled={busy} className="space-y-6">
            <div>
              <DropZone
                id="quick-photos"
                label="Photos"
                hint={`The first photo is the cover. JPG, PNG or WebP · up to ${formatBytes(M.IMAGE_MAX_BYTES)} each`}
                accept={M.IMAGE_MIME_TYPES.join(",")}
                multiple
                filter={false}
                disabled={busy || photos.length >= M.DEFAULT_MAX_IMAGES}
                icon={ImagesIcon}
                buttonLabel="Choose photos"
                onFiles={addPhotos}
              />
              {errors.photos && (
                <p role="alert" className="mt-2 text-sm text-danger-soft-foreground">
                  {errors.photos}
                </p>
              )}
              {photos.length > 0 && (
                <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Chosen photos">
                  {photos.map((p, i) => (
                    <li key={p.id} className="group relative overflow-hidden rounded-lg border border-border">
                      <img src={p.url} alt={p.file.name} className="aspect-square w-full object-cover" />
                      {i === 0 ? (
                        <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">Cover</span>
                      ) : (
                        <button
                          type="button"
                          className="absolute left-1 top-1 flex size-6 cursor-pointer items-center justify-center rounded bg-black/70 text-white"
                          aria-label={`Make ${p.file.name} the cover`}
                          title="Make cover"
                          onClick={() => makeCover(p.id)}
                        >
                          <StarIcon className="size-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="absolute right-1 top-1 flex size-6 cursor-pointer items-center justify-center rounded bg-black/70 text-white"
                        aria-label={`Remove ${p.file.name}`}
                        onClick={() => removePhoto(p.id)}
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <FormField label="What are you selling?" htmlFor="quick-title" required error={errors.title}>
              <Input maxLength={L.TITLE_MAX_LENGTH} placeholder="e.g. Gate valve 2 inch, brass, unused" value={values.title} onChange={(e) => set("title", e.target.value)} />
            </FormField>

            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">
                Category <span className="text-danger-soft-foreground">*</span>
              </p>
              <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Category">
                {[...new Map([...(category ? [category] : []), ...suggestions].map((c) => [c.categoryId, c])).values()].map((c) => (
                  <button
                    key={c.categoryId}
                    type="button"
                    role="radio"
                    aria-checked={c.categoryId === values.categoryId}
                    title={c.path.join(" › ")}
                    onClick={() => chooseCategory(c.categoryId)}
                    className={cn(
                      "inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                      c.categoryId === values.categoryId ? "border-foreground bg-foreground text-background" : "border-border-strong bg-surface text-foreground hover:bg-surface-muted",
                    )}
                  >
                    {c.categoryId === values.categoryId && <CheckCircleIcon className="size-4 shrink-0" />}
                    <span className="truncate">{c.path.length > 1 ? `${c.path[c.path.length - 2]} › ${c.name}` : c.name}</span>
                  </button>
                ))}
                <Button variant="ghost" size="sm" onClick={() => setBrowse((b) => !b)} aria-expanded={browse}>
                  {browse ? "Close list" : category || suggestions.length ? "Other category" : "Choose a category"}
                </Button>
              </div>
              {!category && !suggestions.length && !browse && <p className="mt-1 text-xs text-muted-foreground">Type the title and we'll suggest a category.</p>}
              {errors.categoryId && (
                <p role="alert" className="mt-1 text-sm text-danger-soft-foreground">
                  {errors.categoryId}
                </p>
              )}
              {browse && (
                <div className="mt-3 rounded-lg border border-border p-3">
                  <CategoryPicker value={values.categoryId || null} onSelect={chooseCategory} />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label={`Price per unit (${values.currency.toUpperCase() || "AED"})`} htmlFor="quick-price" required error={errors.price ?? errors.currency}>
                <Input inputMode="decimal" placeholder="0.00" value={values.price} onChange={(e) => set("price", e.target.value)} />
              </FormField>
              <FormField label="Quantity in stock" htmlFor="quick-qty" required error={errors.quantity}>
                <Input inputMode="decimal" placeholder="e.g. 120" value={values.quantity} onChange={(e) => set("quantity", e.target.value)} />
              </FormField>
              <FormField label="Unit" htmlFor="quick-unit" error={errors.unitId}>
                <NativeSelect value={values.unitId} disabled={!units.length} onChange={(e) => set("unitId", e.target.value)}>
                  <option value="">{values.categoryId ? (req.isLoading ? "Loading…" : units.length ? "Choose a unit" : "No units for this category") : "Choose a category first"}</option>
                  {units.map((u) => (
                    <option key={u.unitId} value={u.unitId}>
                      {u.name}
                      {u.symbol && u.symbol !== u.name ? ` (${u.symbol})` : ""}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>

            {conditions.length > 0 && (
              <FormField label="Condition" htmlFor="quick-condition" required={req.data?.conditionRules.isConditionRequired} error={errors.conditionId}>
                <NativeSelect value={values.conditionId} onChange={(e) => set("conditionId", e.target.value)}>
                  <option value="">Not specified</option>
                  {conditions.map((c) => (
                    <option key={c.conditionId} value={c.conditionId}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            )}

            <details className="group rounded-lg border border-border" open={moreOpen} onToggle={(e) => setMoreOpen((e.target as HTMLDetailsElement).open)}>
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-foreground">
                Location &amp; description <span className="font-normal text-muted-foreground">· {location ? `Pickup: ${location}` : "optional"}</span>
              </summary>
              <div className="space-y-4 border-t border-border p-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField label="Country code" htmlFor="quick-country">
                    <Input maxLength={L.LOCATION_COUNTRY_CODE_MAX_LENGTH} className="uppercase" value={values.countryCode} onChange={(e) => set("countryCode", e.target.value)} />
                  </FormField>
                  <FormField label="Emirate / state" htmlFor="quick-emirate">
                    <Input list="quick-emirates" maxLength={L.LOCATION_STATE_MAX_LENGTH} value={values.stateOrEmirate} onChange={(e) => set("stateOrEmirate", e.target.value)} />
                  </FormField>
                  <FormField label="City" htmlFor="quick-city" error={errors.city}>
                    <Input maxLength={L.LOCATION_CITY_MAX_LENGTH} placeholder="e.g. Jebel Ali" value={values.city} onChange={(e) => set("city", e.target.value)} />
                  </FormField>
                </div>
                <datalist id="quick-emirates">
                  {EMIRATES.map((e) => (
                    <option key={e} value={e} />
                  ))}
                </datalist>
                <FormField label="Description" htmlFor="quick-description" hint="Condition, packaging, specs, pickup details.">
                  <Textarea rows={4} value={values.description} onChange={(e) => set("description", e.target.value)} />
                </FormField>
              </div>
            </details>
          </fieldset>

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
            {progress && (
              <p role="status" className="text-sm text-muted-foreground sm:mr-auto">
                {progress}
              </p>
            )}
            {!progress && !canSubmitNow && <p className="text-xs text-muted-foreground sm:mr-auto">Add a photo and a price above 0 to send it for review now.</p>}
            <Button type="submit" variant="secondary" disabled={busy}>
              Save draft
            </Button>
            <Button variant="primary" disabled={busy || !canSubmitNow} loading={busy} onClick={() => void save(true)}>
              <PaperPlaneTiltIcon /> Save and send for review
            </Button>
          </div>
        </form>
      </SectionCard>
    </>
  );
}
