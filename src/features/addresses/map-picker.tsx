import * as React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CircleNotchIcon, CrosshairIcon, MagnifyingGlassIcon, MapPinIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UAE_CENTRE, geocode, type LatLng, type Place } from "./geocode";

const PIN = L.divIcon({
  className: "",
  html: '<svg width="32" height="40" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 39s13-13.1 13-23A13 13 0 0 0 3 16c0 9.9 13 23 13 23z" fill="#111" stroke="#fff" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#e4f222"/></svg>',
  iconSize: [32, 40],
  iconAnchor: [16, 39],
});

/**
 * Map pin picker: search a place, use the device location, or tap / drag the pin. The pin is looked up once it
 * stops moving, and "Use this location" hands the place (with address parts) back to the form.
 */
export default function MapPicker({ initial, onPick, onCancel }: { initial: LatLng | null; onPick: (place: Place) => void; onCancel: () => void }) {
  const box = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<L.Map | null>(null);
  const marker = React.useRef<L.Marker | null>(null);
  const [pin, setPin] = React.useState<LatLng | null>(initial);
  const [place, setPlace] = React.useState<Place | null>(null);
  const [looking, setLooking] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Place[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const movePin = React.useCallback((p: LatLng, zoom?: number) => {
    setPin(p);
    setPlace(null);
    const m = map.current;
    if (!m) return;
    if (marker.current) marker.current.setLatLng(p);
    else {
      marker.current = L.marker(p, { icon: PIN, draggable: true, keyboard: true, title: "Delivery pin", alt: "Delivery pin" }).addTo(m);
      marker.current.on("dragend", () => {
        const ll = marker.current!.getLatLng();
        setPin({ lat: ll.lat, lng: ll.lng });
        setPlace(null);
      });
    }
    m.setView(p, zoom ?? Math.max(m.getZoom(), 16));
  }, []);

  React.useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { center: initial ?? UAE_CENTRE, zoom: initial ? 17 : 11, attributionControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => movePin({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = m;
    if (initial) movePin(initial, 17);
    // The dialog animates open; size the map once it has its final width.
    const t = window.setTimeout(() => m.invalidateSize(), 250);
    return () => {
      window.clearTimeout(t);
      m.remove();
      map.current = null;
      marker.current = null;
    };
  }, [initial, movePin]);

  // Look the pin up once it has stopped moving for a moment (and at most once a second).
  React.useEffect(() => {
    if (!pin || place) return;
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      setLooking(true);
      setError(null);
      geocode
        .reverse(pin, ctl.signal)
        .then(setPlace)
        .catch((e: unknown) => !ctl.signal.aborted && setError(e instanceof Error ? e.message : "Address lookup failed."))
        .finally(() => !ctl.signal.aborted && setLooking(false));
    }, 1000);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [pin, place]);

  const search = async () => {
    const q = query.trim();
    if (q.length < 3) return;
    setSearching(true);
    setError(null);
    try {
      const found = await geocode.search(q);
      setResults(found);
      if (found.length === 1) choose(found[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const choose = (p: Place) => {
    movePin({ lat: p.lat, lng: p.lng }, 17);
    setResults(null);
  };

  const locate = () => {
    if (!navigator.geolocation) return setError("This browser can't share its location. Search or tap the map instead.");
    setError(null);
    setLooking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => movePin({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 18),
      () => {
        setLooking(false);
        setError("We couldn't get your location. Allow location access, or search or tap the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-3 rounded-xl border border-border p-3" data-testid="map-picker">
      <div className="flex flex-col gap-2 sm:flex-row">
        {/* Not a <form>: this sits inside the address form, and Enter here must search, not save the address. */}
        <div className="flex min-w-0 flex-1 gap-2" role="search">
          <Input
            aria-label="Search for a place"
            placeholder="Search a building, street or area"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              void search();
            }}
          />
          <Button type="button" variant="secondary" loading={searching} aria-label="Search" onClick={() => void search()}>
            <MagnifyingGlassIcon />
          </Button>
        </div>
        <Button type="button" variant="secondary" onClick={locate}>
          <CrosshairIcon /> My location
        </Button>
      </div>

      {results && (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm" aria-label="Search results">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">No places found. Try a nearby landmark, or tap the map.</li>
          ) : (
            results.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button type="button" className="w-full px-3 py-2 text-left hover:bg-surface-muted" onClick={() => choose(r)}>
                  {r.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      <div ref={box} className="h-64 w-full overflow-hidden rounded-lg bg-surface-muted sm:h-72" role="application" aria-label="Map. Tap to place the delivery pin, or drag the pin." />

      <div className="flex min-h-10 items-start gap-2 text-sm">
        <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1" aria-live="polite">
          {!pin ? (
            <span className="text-muted-foreground">Tap the map where the delivery should arrive, or search above.</span>
          ) : looking && !place ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <CircleNotchIcon className="size-4 animate-spin" aria-hidden /> Finding the address…
            </span>
          ) : place?.label ? (
            place.label
          ) : (
            <span className="text-muted-foreground">Pin placed. We couldn't name this spot, so check the address fields after.</span>
          )}
        </p>
      </div>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={!pin || (looking && !place)} onClick={() => pin && onPick(place ?? { ...pin, label: "", parts: {} })}>
          Use this location
        </Button>
      </div>
    </div>
  );
}
