/**
 * SEO addresses. The canonical site is www.stockoutme.com; every other host (dev, GitHub Pages copy) is noindex.
 * Listing URLs carry a readable slug followed by the listing id: /listings/ppr-pipe-pn20-25-mm-dubai-1d34d692-…
 */
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || "https://www.stockoutme.com").replace(/\/$/, "");
export const SITE_HOST = new URL(SITE_URL).host;
export const SITE_NAME = "StockOut";

/**
 * Search-engine switch (VITE_SEO_INDEXING in deploy.yml):
 * - "off"  : every page noindex (pre-launch).
 * - "site" : only StockOut's own pages (home, sell, policies) are indexed, so a search for StockOut finds the site;
 *            listings, categories and search stay noindex and out of the sitemap while the catalogue is dummy data.
 * - "on"   : everything public is indexed and every listing is in the sitemap (real catalogue).
 */
export const SEO_MODE: "off" | "site" | "on" = (() => {
  const v = (import.meta.env.VITE_SEO_INDEXING as string | undefined)?.toLowerCase();
  return v === "on" ? "on" : v === "site" ? "site" : "off";
})();
/** Full indexing (listings included). */
export const SEO_INDEXING = SEO_MODE === "on";

/** StockOut's own pages, indexed from "site" mode on. */
export const SITE_PAGE_PATHS = ["/", "/sell", "/legal"];
export const isSitePage = (path: string) => {
  const p = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return SITE_PAGE_PATHS.includes(p) || p.startsWith("/legal/");
};

/** Whether a public page at this path may be indexed under the current mode. */
export const pathIndexable = (path: string) => SEO_MODE === "on" || (SEO_MODE === "site" && isSitePage(path));

/** Production host check (noindex everywhere else so copies don't compete with the real site). */
export const isCanonicalHost = () => typeof location !== "undefined" && location.host === SITE_HOST;

export function slugify(text: string | null | undefined, max = 70): string {
  const s = (text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[²³]/g, (c) => (c === "²" ? "2" : "3"))
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/-[^-]*$/, "") || s.slice(0, max);
}

const GUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Listing id from a route param that may be "<slug>-<guid>" or a bare guid. */
export function listingIdFromParam(param: string | undefined): string {
  const p = (param ?? "").replace(/\/$/, "");
  return GUID.exec(p)?.[1] ?? p;
}

/** Place used in listing addresses and titles: emirate, else city. */
export const listingPlace = (loc?: { city?: string | null; stateOrEmirate?: string | null } | null) => loc?.stateOrEmirate || loc?.city || null;

export function listingPath(listingId: string, title?: string | null, place?: string | null): string {
  const slug = slugify([title, place].filter(Boolean).join(" "));
  return `/listings/${slug ? `${slug}-` : ""}${listingId}`;
}

/** UAE emirates as used by the search index (stateOrEmirate) with their URL slugs. */
export const EMIRATES = [
  { name: "Dubai", slug: "dubai" },
  { name: "Abu Dhabi", slug: "abu-dhabi" },
  { name: "Sharjah", slug: "sharjah" },
  { name: "Ajman", slug: "ajman" },
  { name: "Ras Al Khaimah", slug: "ras-al-khaimah" },
  { name: "Umm Al Quwain", slug: "umm-al-quwain" },
  { name: "Fujairah", slug: "fujairah" },
] as const;

export const emirateBySlug = (slug?: string) => EMIRATES.find((e) => e.slug === slug);
export const emirateSlug = (name?: string | null) => EMIRATES.find((e) => e.name.toLowerCase() === (name ?? "").toLowerCase())?.slug;

/** Landing slug for "all categories". */
export const ALL_STOCK_SLUG = "surplus-stock";

/**
 * Landing page: /c/<category-slug> or /c/<category-slug>-in-<emirate-slug> (one path segment, so each page is a single
 * prerendered file); all categories use "surplus-stock" (e.g. /c/surplus-stock-in-dubai).
 */
export function categoryPath(categoryName: string | null, emirate?: string | null): string {
  const e = emirateSlug(emirate);
  return `/c/${categoryName ? slugify(categoryName) : ALL_STOCK_SLUG}${e ? `-in-${e}` : ""}`;
}

/** Splits a landing slug into category slug and emirate. */
export function parseLandingSlug(slug: string): { categorySlug: string; emirate?: (typeof EMIRATES)[number] } {
  for (const e of EMIRATES) if (slug.endsWith(`-in-${e.slug}`)) return { categorySlug: slug.slice(0, -`-in-${e.slug}`.length), emirate: e };
  return { categorySlug: slug };
}

export const absoluteUrl = (path: string) => (/^https?:/i.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);
