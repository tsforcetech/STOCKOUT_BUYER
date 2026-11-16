import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BuildingsIcon, CheckCircleIcon, MapPinIcon, MapTrifoldIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { COUNTRY_OPTIONS } from "@/features/verification/countries";
import { UAE_EMIRATES, type BuyerDeliveryAddressDto, type SaveBuyerDeliveryAddressRequest } from "@/api/types/addresses";
import { addressesService, type AddressOwner } from "@/services/addresses.service";
import { newId } from "@/lib/utils/id";
import { useAuth } from "@/lib/auth/auth-context";
import { marketplaceService } from "@/services/marketplace.service";
import { addressCode, addressMessage } from "./address-messages";
import { mapLink, pinFromNotes, withMapPin, type LatLng, type Place } from "./geocode";
import { addressFromProfile, contactFromProfile } from "./profile-prefill";

// Leaflet + map tiles load only when the buyer opens the map.
const MapPicker = React.lazy(() => import("./map-picker"));

/** Form state: every text field is a string (blank = not given); toBody() turns blanks into null. */
type Form = { [K in Exclude<keyof SaveBuyerDeliveryAddressRequest, "isDefault">]: string } & { isDefault: boolean };
type Errors = Partial<Record<keyof Form | "line", string>>;

const blank: Form = {
  label: "", contactName: "", contactPhone: "", siteName: "", siteContactName: "", siteContactPhone: "", countryCode: "ARE", stateOrEmirate: "",
  city: "", area: "", street: "", building: "", unit: "", postalCode: "", deliveryNotes: "", isDefault: false,
};

const fromAddress = (a: BuyerDeliveryAddressDto): Form => ({
  label: a.label, contactName: a.contactName, contactPhone: a.contactPhone, siteName: a.siteName ?? "", siteContactName: a.siteContactName ?? "",
  siteContactPhone: a.siteContactPhone ?? "", countryCode: a.countryCode || "ARE", stateOrEmirate: a.stateOrEmirate, city: a.city, area: a.area,
  street: a.street ?? "", building: a.building ?? "", unit: a.unit ?? "", postalCode: a.postalCode ?? "", deliveryNotes: a.deliveryNotes ?? "", isDefault: a.isDefault,
});

const PHONE = /^[+\d\s\-()]+$/;
const phoneOk = (v: string) => PHONE.test(v) && (v.match(/\d/g)?.length ?? 0) >= 7 && (v.match(/\d/g)?.length ?? 0) <= 15;

/** Mirrors the documented server rules so most mistakes are caught before sending; the server stays authoritative. */
export function validateAddress(f: Form): Errors {
  const e: Errors = {};
  const req = (k: keyof Form, label: string, max: number) => {
    const v = String(f[k] ?? "").trim();
    if (!v) e[k] = `Enter ${label}.`;
    else if (v.length > max) e[k] = `Use ${max} characters or fewer.`;
  };
  const opt = (k: keyof Form, max: number) => {
    if (String(f[k] ?? "").trim().length > max) e[k] = `Use ${max} characters or fewer.`;
  };
  req("label", "a name for this address", 100);
  req("contactName", "a contact name", 150);
  if (!f.contactPhone.trim()) e.contactPhone = "Enter a contact phone.";
  else if (!phoneOk(f.contactPhone.trim())) e.contactPhone = "Enter a valid phone number (7 to 15 digits).";
  opt("siteName", 150);
  opt("siteContactName", 150);
  if (f.siteContactPhone.trim() && !phoneOk(f.siteContactPhone.trim())) e.siteContactPhone = "Enter a valid phone number (7 to 15 digits).";
  if (!f.countryCode) e.countryCode = "Choose a country.";
  if (!f.stateOrEmirate.trim()) e.stateOrEmirate = f.countryCode === "ARE" ? "Choose an emirate." : "Enter a state or region.";
  else if (f.countryCode === "ARE" && !(UAE_EMIRATES as readonly string[]).includes(f.stateOrEmirate)) e.stateOrEmirate = "Choose one of the seven emirates.";
  req("city", "a city", 100);
  req("area", "an area", 150);
  if (!f.street.trim() && !f.building.trim()) e.line = "Enter a street or a building.";
  opt("street", 200);
  opt("building", 150);
  opt("unit", 50);
  if (f.postalCode.trim() && !/^[A-Za-z0-9 -]{2,20}$/.test(f.postalCode.trim())) e.postalCode = "Use 2 to 20 letters, digits, spaces or dashes.";
  opt("deliveryNotes", 500);
  return e;
}

const toBody = (f: Form): SaveBuyerDeliveryAddressRequest => {
  const t = (v: string) => v.trim();
  const n = (v: string) => (v.trim() ? v.trim() : null);
  return {
    label: t(f.label), contactName: t(f.contactName), contactPhone: t(f.contactPhone), siteName: n(f.siteName), siteContactName: n(f.siteContactName),
    siteContactPhone: n(f.siteContactPhone), countryCode: f.countryCode, stateOrEmirate: t(f.stateOrEmirate), city: t(f.city), area: t(f.area),
    street: n(f.street), building: n(f.building), unit: n(f.unit), postalCode: n(f.postalCode), deliveryNotes: n(f.deliveryNotes), isDefault: f.isDefault,
  };
};

const FIELD_FOR_CODE: Record<string, keyof Errors> = {
  BUYER_ADDRESS_PHONE_INVALID: "contactPhone",
  BUYER_ADDRESS_COUNTRY_INVALID: "countryCode",
  BUYER_ADDRESS_EMIRATE_INVALID: "stateOrEmirate",
  BUYER_ADDRESS_LINE_REQUIRED: "line",
};

/**
 * Add / edit dialog. Create carries an Idempotency-Key that stays the same while the body is unchanged (a retry after a
 * network failure replays instead of creating twice); edits send If-Match with the address rowVersion. On a version
 * conflict the latest address is loaded into the form for the buyer to review. Typed values are never discarded on error.
 */
export function AddressFormDialog({
  open,
  onOpenChange,
  owner,
  editing,
  firstAddress,
  onSaved,
  onConflict,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owner: AddressOwner;
  editing: BuyerDeliveryAddressDto | null;
  firstAddress: boolean;
  onSaved: (address: BuyerDeliveryAddressDto) => void;
  onConflict?: () => void;
}) {
  const [form, setForm] = React.useState<Form>(blank);
  const [current, setCurrent] = React.useState<BuyerDeliveryAddressDto | null>(null);
  const [errors, setErrors] = React.useState<Errors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const idem = React.useRef<{ key: string; body: string } | null>(null);
  const [mapOpen, setMapOpen] = React.useState(false);
  const [filledFrom, setFilledFrom] = React.useState<"company" | "map" | null>(null);
  const contactFilled = React.useRef(false);

  // What the buyer gave us during verification. Only offered for the book it belongs to.
  const { status } = useAuth();
  const profileQuery = useQuery({
    queryKey: ["buyer", "profile"],
    queryFn: ({ signal }) => marketplaceService.buyerProfile(signal),
    enabled: open && status === "authenticated",
    retry: false,
    staleTime: 60_000,
  });
  const profile = profileQuery.data;
  const profileFits = !!profile && (owner.kind === "individual" || profile.organizationId?.toLowerCase() === owner.organizationId.toLowerCase());
  const contact = profileFits ? contactFromProfile(profile) : null;
  const companyAddress = profileFits ? addressFromProfile(profile) : null;

  React.useEffect(() => {
    if (!open) return;
    setForm(editing ? fromAddress(editing) : { ...blank, isDefault: firstAddress });
    setCurrent(editing);
    setErrors({});
    setServerError(null);
    setMapOpen(false);
    setFilledFrom(null);
    contactFilled.current = !!editing;
    idem.current = null;
  }, [open, editing, firstAddress]);

  // A new address starts with the buyer's own name and phone; they can change them.
  React.useEffect(() => {
    if (!open || contactFilled.current || !contact) return;
    contactFilled.current = true;
    setForm((f) => ({ ...f, contactName: f.contactName || contact.contactName, contactPhone: f.contactPhone || contact.contactPhone }));
  }, [open, contact]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const pin = pinFromNotes(form.deliveryNotes);

  const fillFromCompany = () => {
    if (!companyAddress) return;
    setForm((f) => ({
      ...f,
      label: f.label || companyAddress.label,
      contactName: f.contactName || contact?.contactName || "",
      contactPhone: f.contactPhone || contact?.contactPhone || "",
      countryCode: companyAddress.countryCode,
      stateOrEmirate: companyAddress.stateOrEmirate,
      city: companyAddress.city,
      area: companyAddress.area,
      street: companyAddress.street,
      postalCode: companyAddress.postalCode,
    }));
    setErrors({});
    setFilledFrom("company");
  };

  const fillFromPlace = (p: Place) => {
    const at: LatLng = { lat: p.lat, lng: p.lng };
    setForm((f) => ({
      ...f,
      countryCode: p.parts.countryCode ?? f.countryCode,
      stateOrEmirate: p.parts.stateOrEmirate ?? (p.parts.countryCode && p.parts.countryCode !== f.countryCode ? "" : f.stateOrEmirate),
      city: p.parts.city ?? f.city,
      area: p.parts.area ?? f.area,
      street: p.parts.street ?? f.street,
      building: p.parts.building ?? f.building,
      deliveryNotes: withMapPin(f.deliveryNotes, at),
    }));
    setErrors({});
    setMapOpen(false);
    setFilledFrom("map");
  };

  const save = async () => {
    const errs = validateAddress(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body = toBody(form);
    setBusy(true);
    setServerError(null);
    try {
      let saved: BuyerDeliveryAddressDto;
      if (current) {
        saved = await addressesService.update(owner, current.addressId, body, current.rowVersion);
      } else {
        const bodyJson = JSON.stringify(body);
        if (!idem.current || idem.current.body !== bodyJson) idem.current = { key: newId(), body: bodyJson };
        saved = await addressesService.create(owner, body, idem.current.key);
      }
      onSaved(saved);
      onOpenChange(false);
    } catch (e) {
      const code = addressCode(e);
      const field = code ? FIELD_FOR_CODE[code] : undefined;
      if (field) setErrors((x) => ({ ...x, [field]: addressMessage(e) }));
      setServerError(addressMessage(e));
      if (code === "BUYER_ADDRESS_VERSION_CONFLICT" && current) {
        try {
          const latest = await addressesService.get(owner, current.addressId);
          setCurrent(latest);
          setForm(fromAddress(latest));
        } catch {
          /* keep what the buyer typed */
        }
        onConflict?.();
      }
    } finally {
      setBusy(false);
    }
  };

  const uae = form.countryCode === "ARE";
  const field = (k: keyof Form) => ({ value: String(form[k] ?? ""), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never) });

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        size="lg"
        title={editing ? "Edit address" : "Add a delivery address"}
        description="Used to deliver your orders. Only you and your company's authorised members can see it."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={busy}>
              {editing ? "Save changes" : "Save address"}
            </Button>
          </>
        }
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="space-y-6"
        >
          {serverError && (
            <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger-soft-foreground">
              {serverError}
            </p>
          )}
          <section aria-label="Fill in faster" className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {companyAddress && (
                <button
                  type="button"
                  onClick={fillFromCompany}
                  className="flex items-start gap-3 rounded-xl border border-border p-3 text-left text-sm transition-colors hover:border-action-border hover:bg-surface-muted"
                >
                  <BuildingsIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">Use {owner.kind === "individual" ? "my address" : "my company address"}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{companyAddress.summary}</span>
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setMapOpen((o) => !o)}
                aria-expanded={mapOpen}
                className="flex items-start gap-3 rounded-xl border border-border p-3 text-left text-sm transition-colors hover:border-action-border hover:bg-surface-muted"
              >
                <MapTrifoldIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{pin ? "Move the pin on the map" : "Pick on map"}</span>
                  <span className="text-xs text-muted-foreground">Drop a pin on the exact gate. We fill the address and send the pin to the driver.</span>
                </span>
              </button>
            </div>
            {mapOpen && (
              <React.Suspense fallback={<p className="text-sm text-muted-foreground">Loading the map…</p>}>
                <MapPicker initial={pin} onPick={fillFromPlace} onCancel={() => setMapOpen(false)} />
              </React.Suspense>
            )}
            {filledFrom && !mapOpen && (
              <p className="flex items-center gap-1.5 text-xs text-success" role="status">
                <CheckCircleIcon weight="fill" className="size-4" aria-hidden />
                {filledFrom === "company" ? "Filled from your verified details. Check the area and building, then save." : "Filled from the map. Check the details, then save."}
              </p>
            )}
            {pin && !mapOpen && (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <MapPinIcon className="size-4 text-foreground" aria-hidden />
                <span>
                  Map pin saved ({pin.lat.toFixed(5)}, {pin.lng.toFixed(5)})
                </span>
                <a href={mapLink(pin)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                  View
                </a>
                <button type="button" className="inline-flex items-center gap-1 underline underline-offset-4" onClick={() => set("deliveryNotes", withMapPin(form.deliveryNotes, null))}>
                  <XIcon className="size-3" aria-hidden /> Remove pin
                </button>
              </p>
            )}
          </section>

          <FormField label="Address name" htmlFor="ad-label" required error={errors.label} hint="For example: Dubai warehouse, Head office.">
            <Input {...field("label")} maxLength={100} />
          </FormField>

          <fieldset className="space-y-4">
            <legend className="mb-1 text-sm font-semibold text-foreground">Contact</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Contact name" htmlFor="ad-contact" required error={errors.contactName}>
                <Input autoComplete="name" {...field("contactName")} maxLength={150} />
              </FormField>
              <FormField label="Contact phone" htmlFor="ad-phone" required error={errors.contactPhone}>
                <Input type="tel" autoComplete="tel" placeholder="+971 50 123 4567" {...field("contactPhone")} maxLength={25} />
              </FormField>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-1 text-sm font-semibold text-foreground">Delivery site (optional)</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Site name" htmlFor="ad-site" error={errors.siteName}>
                <Input {...field("siteName")} maxLength={150} />
              </FormField>
              <FormField label="Site contact" htmlFor="ad-site-contact" error={errors.siteContactName}>
                <Input {...field("siteContactName")} maxLength={150} />
              </FormField>
              <FormField label="Site phone" htmlFor="ad-site-phone" error={errors.siteContactPhone}>
                <Input type="tel" {...field("siteContactPhone")} maxLength={25} />
              </FormField>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-1 text-sm font-semibold text-foreground">Location</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Country" htmlFor="ad-country" required error={errors.countryCode}>
                <NativeSelect value={form.countryCode} onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value, stateOrEmirate: "" }))}>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label={uae ? "Emirate" : "State or region"} htmlFor="ad-emirate" required error={errors.stateOrEmirate}>
                {uae ? (
                  <NativeSelect value={form.stateOrEmirate} onChange={(e) => set("stateOrEmirate", e.target.value)}>
                    <option value="">Choose…</option>
                    {UAE_EMIRATES.map((em) => (
                      <option key={em} value={em}>
                        {em}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input {...field("stateOrEmirate")} maxLength={100} />
                )}
              </FormField>
              <FormField label="City" htmlFor="ad-city" required error={errors.city}>
                <Input autoComplete="address-level2" {...field("city")} maxLength={100} />
              </FormField>
              <FormField label="Area" htmlFor="ad-area" required error={errors.area} hint="For example: Al Quoz, Jebel Ali Free Zone.">
                <Input {...field("area")} maxLength={150} />
              </FormField>
              <FormField label="Street" htmlFor="ad-street" error={errors.street ?? errors.line} hint="A street or a building is required.">
                <Input autoComplete="address-line1" {...field("street")} maxLength={200} />
              </FormField>
              <FormField label="Building" htmlFor="ad-building" error={errors.building}>
                <Input {...field("building")} maxLength={150} />
              </FormField>
              <FormField label="Unit / floor" htmlFor="ad-unit" error={errors.unit}>
                <Input {...field("unit")} maxLength={50} />
              </FormField>
              <FormField label="Postal code" htmlFor="ad-postal" error={errors.postalCode} hint={uae ? "Not needed in the UAE." : undefined}>
                <Input autoComplete="postal-code" {...field("postalCode")} maxLength={20} />
              </FormField>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-foreground">Delivery instructions</legend>
            <FormField label="Notes for the driver (optional)" htmlFor="ad-notes" error={errors.deliveryNotes} hint={pin ? "The map pin is kept as the last line here so the driver gets it." : undefined}>
              <Textarea {...field("deliveryNotes")} maxLength={500} placeholder="For example: call before unloading; gate 3." />
            </FormField>
          </fieldset>

          {!editing && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" className="size-4 accent-foreground" checked={form.isDefault} onChange={(e) => set("isDefault", e.target.checked)} disabled={firstAddress} />
              Use as my default delivery address{firstAddress && " (your first address is the default)"}
            </label>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
