import { describe, expect, it } from "vitest";
import { categoryPath, listingIdFromParam, listingPath, parseLandingSlug, slugify } from "../site";
import { isTestListing, listingSeo } from "../listing-seo";

const ID = "2193819f-e725-40b5-9680-d70922bf7030";

describe("SEO addresses", () => {
  it("makes readable slugs", () => {
    expect(slugify("PPR Pipe PN20 25 mm x 4 m (Green)")).toBe("ppr-pipe-pn20-25-mm-x-4-m-green");
    expect(slugify("Copper Cable 4 mm² — Dubai")).toBe("copper-cable-4-mm2-dubai");
    expect(slugify("Plumbing & Piping")).toBe("plumbing-and-piping");
  });

  it("builds listing paths and reads the id back (also from old id-only links)", () => {
    const p = listingPath(ID, "PPR Pipe PN20 25 mm", "Dubai");
    expect(p).toBe(`/listings/ppr-pipe-pn20-25-mm-dubai-${ID}`);
    expect(listingIdFromParam(p.split("/").pop())).toBe(ID);
    expect(listingIdFromParam(ID)).toBe(ID);
  });

  it("builds and parses category × emirate landing pages", () => {
    expect(categoryPath("PPR Pipes & Fittings", "Dubai")).toBe("/c/ppr-pipes-and-fittings-in-dubai");
    expect(categoryPath(null, "Abu Dhabi")).toBe("/c/surplus-stock-in-abu-dhabi");
    expect(categoryPath("Steel & Metals")).toBe("/c/steel-and-metals");
    expect(parseLandingSlug("ppr-pipes-and-fittings-in-ras-al-khaimah")).toMatchObject({ categorySlug: "ppr-pipes-and-fittings", emirate: { name: "Ras Al Khaimah" } });
    expect(parseLandingSlug("steel-and-metals")).toEqual({ categorySlug: "steel-and-metals" });
  });
});

describe("listing SEO", () => {
  const seo = listingSeo({
    listingId: ID,
    title: "PPR Pipe PN20 25 mm x 4 m (Green)",
    price: 14.5,
    currency: "AED",
    category: "PPR Pipes & Fittings",
    categoryTrail: ["Plumbing & Piping", "PPR Pipes & Fittings"],
    quantity: 420,
    unit: "pcs",
    inStock: true,
    city: "Jebel Ali Free Zone",
    emirate: "Dubai",
    images: ["https://cdn/x.jpg"],
  });

  it("uses the emirate in title and address, with keywords people search for", () => {
    expect(seo.title).toBe("PPR Pipe PN20 25 mm x 4 m (Green) – Surplus PPR Pipes & Fittings in Dubai");
    expect(seo.path).toBe(`/listings/ppr-pipe-pn20-25-mm-x-4-m-green-dubai-${ID}`);
    expect(seo.description).toContain("420 pcs available at AED 14.50 per pcs in Jebel Ali Free Zone, Dubai, UAE");
  });

  it("emits Product with an in-stock AED offer and a breadcrumb", () => {
    const [product, crumbs] = seo.jsonLd as Array<Record<string, unknown>>;
    expect(product).toMatchObject({ "@type": "Product", offers: { price: "14.50", priceCurrency: "AED", availability: "https://schema.org/InStock" } });
    expect(JSON.stringify(crumbs)).toContain("/c/ppr-pipes-and-fittings");
  });

  it("keeps internal test listings out of search", () => {
    expect(isTestListing("UAT TEST TAF verified-seller check - do not buy")).toBe(true);
    expect(isTestListing("PPR Pipe PN20")).toBe(false);
  });
});
