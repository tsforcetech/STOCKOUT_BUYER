import { SITE_NAME, SITE_URL, absoluteUrl } from "./site";

export const organizationLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/apple-touch-icon.png`,
  areaServed: { "@type": "Country", name: "United Arab Emirates" },
  description: "B2B marketplace for verified surplus stock, excess inventory and unused construction and industrial materials in the UAE.",
});

export const websiteLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
});

export const breadcrumbLd = (items: Array<{ name: string; path: string }>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
});

export interface ProductLdInput {
  name: string;
  description?: string | null;
  images: string[];
  sku?: string | null;
  brand?: string | null;
  category?: string | null;
  price?: number | null;
  currency?: string | null;
  inStock: boolean;
  condition?: string | null;
  quantity?: number | null;
  place?: string | null;
  sellerName?: string | null;
  path: string;
  validUntil?: string | null;
}

const conditionUrl = (c?: string | null) => {
  const s = (c ?? "").toLowerCase();
  if (/refurb/.test(s)) return "https://schema.org/RefurbishedCondition";
  if (/used|second/.test(s)) return "https://schema.org/UsedCondition";
  if (/damag/.test(s)) return "https://schema.org/DamagedCondition";
  return "https://schema.org/NewCondition";
};

export const productLd = (p: ProductLdInput) => ({
  "@context": "https://schema.org",
  "@type": "Product",
  name: p.name,
  description: p.description || `${p.name} — surplus stock available${p.place ? ` in ${p.place}` : ""}, UAE.`,
  image: p.images.map(absoluteUrl),
  ...(p.sku ? { sku: p.sku } : {}),
  ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
  ...(p.category ? { category: p.category } : {}),
  ...(typeof p.price === "number" && p.price > 0 && p.currency
    ? {
        offers: {
          "@type": "Offer",
          url: absoluteUrl(p.path),
          price: p.price.toFixed(2),
          priceCurrency: p.currency,
          availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: conditionUrl(p.condition),
          ...(p.validUntil ? { priceValidUntil: p.validUntil.slice(0, 10) } : {}),
          ...(p.quantity ? { inventoryLevel: { "@type": "QuantitativeValue", value: p.quantity } } : {}),
          areaServed: { "@type": "Country", name: "United Arab Emirates" },
          ...(p.place ? { availableAtOrFrom: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: p.place, addressCountry: "AE" } } } : {}),
          seller: { "@type": "Organization", name: p.sellerName || "Verified StockOut seller" },
        },
      }
    : {}),
});
