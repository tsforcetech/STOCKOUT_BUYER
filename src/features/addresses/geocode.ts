/**
 * Map pin ↔ address text, via OpenStreetMap Nominatim (free, no key; usage policy: ≤ 1 request a second, no
 * autocomplete, so we only look up on an explicit search or when the pin stops moving).
 * The address API has no latitude/longitude yet (backend BE-13), so the pin travels to the driver as a map link in
 * the delivery notes until those fields exist.
 */
import { UAE_EMIRATES } from "@/api/types/addresses";

const NOMINATIM = "https://nominatim.openstreetmap.org";

export interface LatLng {
  lat: number;
  lng: number;
}

/** The parts of our address form a map lookup can fill. */
export interface PlaceParts {
  countryCode?: string; // alpha-3
  stateOrEmirate?: string;
  city?: string;
  area?: string;
  street?: string;
  building?: string;
}

export interface Place extends LatLng {
  label: string;
  parts: PlaceParts;
}

interface NominatimAddress {
  [k: string]: string | undefined;
}
interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: NominatimAddress;
}

const ISO_EMIRATE: Record<string, (typeof UAE_EMIRATES)[number]> = {
  "AE-AZ": "Abu Dhabi",
  "AE-DU": "Dubai",
  "AE-SH": "Sharjah",
  "AE-AJ": "Ajman",
  "AE-UQ": "Umm Al Quwain",
  "AE-RK": "Ras Al Khaimah",
  "AE-FU": "Fujairah",
};

/** "Dubai Emirate", "emirate of sharjah", "RAK" → one of the seven emirates; null when it isn't one. */
export function toEmirate(value: string | null | undefined): (typeof UAE_EMIRATES)[number] | null {
  if (!value) return null;
  const v = value
    .toLowerCase()
    .replace(/emirate( of)?/g, "")
    .replace(/[^a-z]/g, "");
  if (!v) return null;
  if (v === "rak") return "Ras Al Khaimah";
  if (v === "uaq") return "Umm Al Quwain";
  if (v === "auh") return "Abu Dhabi";
  return UAE_EMIRATES.find((e) => e.toLowerCase().replace(/[^a-z]/g, "") === v) ?? null;
}

const first = (a: NominatimAddress, keys: string[]) => keys.map((k) => a[k]).find((v) => !!v?.trim())?.trim();

/** Nominatim result → our form's fields. Only parts the map actually knows are set. */
export function placeFromNominatim(r: NominatimResult): Place {
  const a = r.address ?? {};
  const uae = a.country_code?.toLowerCase() === "ae";
  const emirate = uae ? (ISO_EMIRATE[a["ISO3166-2-lvl4"] ?? ""] ?? toEmirate(a.state)) : null;
  const named = r.name && r.name !== a.road ? r.name : undefined;
  const number = a.house_number ? `${a.house_number}` : undefined;
  const parts: PlaceParts = {
    countryCode: uae ? "ARE" : undefined,
    stateOrEmirate: emirate ?? (uae ? undefined : a.state),
    city: first(a, ["city", "town", "village", "municipality"]) ?? emirate ?? undefined,
    area: first(a, ["neighbourhood", "industrial", "quarter", "suburb", "city_district", "residential", "hamlet"]),
    street: first(a, ["road", "pedestrian", "street"]),
    building: [first(a, ["building"]) ?? named, number].filter(Boolean).join(", ") || undefined,
  };
  return { lat: Number(r.lat), lng: Number(r.lon), label: r.display_name, parts };
}

async function call<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${NOMINATIM}${path}${path.includes("?") ? "&" : "?"}format=jsonv2&addressdetails=1&accept-language=en`, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("The map lookup isn't available right now. Fill the address in by hand.");
  return (await res.json()) as T;
}

export const geocode = {
  reverse: async (at: LatLng, signal?: AbortSignal): Promise<Place> => {
    const r = await call<NominatimResult & { error?: string }>(`/reverse?lat=${at.lat.toFixed(6)}&lon=${at.lng.toFixed(6)}&zoom=18`, signal);
    if (r.error) return { ...at, label: "", parts: {} };
    return { ...placeFromNominatim(r), lat: at.lat, lng: at.lng }; // keep the exact pin, not the matched building's centre
  },
  search: async (q: string, signal?: AbortSignal): Promise<Place[]> => {
    const rows = await call<NominatimResult[]>(`/search?q=${encodeURIComponent(q)}&countrycodes=ae&limit=5`, signal);
    return rows.map(placeFromNominatim);
  },
};

export const mapLink = (p: LatLng) => `https://maps.google.com/?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

const PIN_LINE = /^Map pin: https:\/\/maps\.google\.com\/\?q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\s*$/m;

/** Adds (or replaces) the "Map pin: …" line in the delivery notes, keeping whatever else the buyer wrote. */
export function withMapPin(notes: string, p: LatLng | null): string {
  const rest = notes
    .split("\n")
    .filter((l) => !PIN_LINE.test(l))
    .join("\n")
    .trim();
  if (!p) return rest;
  return rest ? `${rest}\nMap pin: ${mapLink(p)}` : `Map pin: ${mapLink(p)}`;
}

/** The pin saved in the delivery notes, if any. */
export function pinFromNotes(notes: string | null | undefined): LatLng | null {
  const m = PIN_LINE.exec(notes ?? "");
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

/** Centre of the UAE map when there's no pin yet (Dubai). */
export const UAE_CENTRE: LatLng = { lat: 25.2048, lng: 55.2708 };
