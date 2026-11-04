import { breadcrumbLd, productLd } from "./schema";
import { categoryPath, listingPath } from "./site";
import type { SeoInput } from "./use-seo";

/** Listing fields used for SEO, shared by the live page and the build-time prerender. */
export interface ListingSeoSource {
  listingId: string;
  title: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  category?: string | null;
  categoryTrail?: string[] | null;
  brand?: string | null;
  condition?: string | null;
  sku?: string | null;
  quantity?: number | null;
  unit?: string | null;
  inStock: boolean;
  city?: string | null;
  emirate?: string | null;
  images: string[];
  validUntil?: string | null;
}

const money = (p?: number | null, c?: string | null) =>
  typeof p === "number" && p > 0 && c ? `${c} ${p.toLocaleString("en-US", { minimumFractionDigits: p % 1 ? 2 : 0, maximumFractionDigits: 2 })}` : null;

/** Internal test listings (e.g. "UAT TEST … do not buy") are kept out of search engines. */
export const isTestListing = (title: string) => /\bUAT\b|do not buy|\btest listing\b/i.test(title);

export function listingSeo(l: ListingSeoSource): SeoInput & { h1: string; summary: string } {
  // Emirate first: people search "pipes Dubai", not the industrial area; the area stays in the description.
  const place = l.emirate || l.city || null;
  const where = [l.city, l.emirate && l.emirate !== l.city ? l.emirate : null].filter(Boolean).join(", ");
  const path = listingPath(l.listingId, l.title, place);
  const cat = l.category ? `surplus ${l.category.toLowerCase()}` : "surplus stock";
  const priceText = money(l.price, l.currency);
  const qty = l.quantity && l.inStock ? `${l.quantity.toLocaleString("en-US")}${l.unit ? ` ${l.unit}` : ""} available` : l.inStock ? "Available" : "Currently out of stock";
  const title = `${l.title} – ${l.category ? `Surplus ${l.category}` : "Surplus Stock"} in ${place ?? "UAE"}`;
  const summary = [
    `${l.title}${l.brand ? ` by ${l.brand}` : ""}${l.condition ? ` (${l.condition.toLowerCase()})` : ""}.`,
    `${qty}${priceText ? ` at ${priceText}${l.unit ? ` per ${l.unit}` : ""}` : ""}${where ? ` in ${where}` : ""}, UAE.`,
    `Buy ${cat} from verified UAE sellers on StockOut.`,
  ].join(" ");
  const description = l.description ? `${summary} ${l.description}` : summary;
  const trail = (l.categoryTrail?.length ? l.categoryTrail : l.category ? [l.category] : []).filter(Boolean);
  return {
    title,
    noindex: isTestListing(l.title),
    h1: l.title,
    summary,
    description,
    path,
    type: "product",
    image: l.images[0] ?? null,
    jsonLd: [
      productLd({
        name: l.title,
        description: l.description || summary,
        images: l.images,
        sku: l.sku,
        brand: l.brand,
        category: trail.join(" > ") || l.category,
        price: l.price,
        currency: l.currency,
        inStock: l.inStock,
        condition: l.condition,
        quantity: l.quantity,
        place: where || null,
        path,
        validUntil: l.validUntil,
      }),
      breadcrumbLd([
        { name: "Marketplace", path: "/search" },
        ...trail.map((name) => ({ name, path: categoryPath(name) })),
        { name: l.title, path },
      ]),
    ],
  };
}
