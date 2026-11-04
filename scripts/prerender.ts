/**
 * Build-time SEO prerender for www.stockoutme.com.
 *
 * Search engines and link previews (WhatsApp, Instagram, Facebook, LinkedIn) read the raw HTML, but the app is
 * rendered in the browser. After `vite build`, this script reads the public marketplace API and writes, into dist/:
 *   - listings/<slug>-<id>              one page per published listing (extension-less HTML file) (title, meta, Open Graph, Product JSON-LD,
 *                                        visible summary) — the app loads on top as usual
 *   - c/<category>[-in-<emirate>]       landing pages for category × emirate searches ("surplus pipes Dubai")
 *   - sitemap.xml, plus robots.txt from public/
 * It never fails the build: if the API is unreachable, the site deploys exactly as before, without these pages.
 */
import fs from "node:fs";
import path from "node:path";
import { isTestListing, listingSeo, type ListingSeoSource } from "../src/lib/seo/listing-seo";
import { landingCopy } from "../src/lib/seo/landing-copy";
import { EMIRATES, SITE_URL, absoluteUrl, categoryPath, listingPath } from "../src/lib/seo/site";
import { breadcrumbLd, organizationLd, websiteLd } from "../src/lib/seo/schema";
import type { SeoInput } from "../src/lib/seo/use-seo";

const DIST = path.resolve(process.argv[2] ?? "dist");
const API = (process.env.SEO_API_BASE_URL || process.env.VITE_API_BASE_URL || "https://stockout.flowb.io").replace(/\/$/, "");
const UA = "Mozilla/5.0 (compatible; StockOutPrerender/1.0; +https://www.stockoutme.com)";
const PAGE_SIZE = 50;
const MAX_RESULTS = 1000; // search service limit (page * pageSize <= 1000)

interface Card {
  listingId: string;
  listingNumber: string;
  title: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  categoryBreadcrumb: string[];
  brandName: string | null;
  conditionName: string | null;
  basePrice: number;
  currency: string;
  quantityUnitSymbol: string | null;
  quantityUnitName: string | null;
  sellableQuantity: number;
  isAvailable: boolean;
  expiresAtUtc: string | null;
  publishedAtUtc: string;
  primaryImage: { cdnUrl: string } | null;
  location: { city: string | null; stateOrEmirate: string | null };
}
interface SearchResult {
  items: Card[];
  pagination: { page: number; totalCount: number; hasNextPage: boolean };
  facets: { statesOrEmirates: Array<{ key: string; count: number }> };
}
interface Category {
  categoryId: string;
  name: string;
  children?: Category[];
}

const unwrap = <T>(j: unknown): T => (j && typeof j === "object" && "data" in j && "success" in j ? (j as { data: T }).data : (j as T));

async function get<T>(p: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(API + p, { headers: { Accept: "application/json", "User-Agent": UA } });
      if (!r.ok) throw new Error(`${r.status} ${p}`);
      return unwrap<T>(await r.json());
    } catch (e) {
      if (attempt >= 2) throw e;
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
    }
  }
}

const search = (q: Record<string, string | number>) =>
  get<SearchResult>(`/api/v1/search/listings?${new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString()}`);

async function allListings(): Promise<Card[]> {
  const out: Card[] = [];
  for (let page = 1; page * PAGE_SIZE <= MAX_RESULTS; page++) {
    const r = await search({ page, pageSize: PAGE_SIZE, sort: "date_desc" });
    out.push(...r.items);
    if (!r.pagination.hasNextPage || r.items.length === 0) break;
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const img = (p: string | null | undefined) => (!p ? null : /^https?:/.test(p) ? p : `${API}${p.startsWith("/") ? "" : "/"}${p}`);
const money = (n: number, c: string) => `${c} ${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

function head(s: SeoInput): string {
  const title = s.title.includes("StockOut") ? s.title : `${s.title} | StockOut`;
  const url = absoluteUrl(s.path);
  const image = absoluteUrl(s.image || "/og-image.jpg");
  const desc = s.description.replace(/\s+/g, " ").trim().slice(0, 300);
  const ld = (Array.isArray(s.jsonLd) ? s.jsonLd : s.jsonLd ? [s.jsonLd] : []).map(
    (b) => `<script type="application/ld+json" data-seo="ld">${JSON.stringify(b).replace(/</g, "\\u003c")}</script>`,
  );
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<meta name="robots" content="${s.noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="StockOut" />`,
    `<meta property="og:type" content="${s.type ?? "website"}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:locale" content="en_AE" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    ...ld,
  ].join("\n    ");
}

/** Template = built index.html. Its generic title/description are replaced; the app shell stays intact. */
function page(template: string, seo: SeoInput, body: string): string {
  let html = template
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta name="description"[^>]*>\s*/i, "")
    .replace(/<meta property="og:[^"]+"[^>]*>\s*/gi, "")
    .replace(/<meta name="twitter:[^"]+"[^>]*>\s*/gi, "")
    .replace(/<link rel="canonical"[^>]*>\s*/i, "")
    .replace(/<script type="application\/ld\+json"[\s\S]*?<\/script>\s*/gi, "");
  html = html.replace("</head>", `    ${head(seo)}\n  </head>`);
  // Readable content inside #root: crawlers and previews see it; the app replaces it when it starts.
  return html.replace(/<div id="root">[\s\S]*<\/div>\s*<\/body>/i, `<div id="root">${body}</div>\n  </body>`);
}

const shell = (inner: string) =>
  `<div style="max-width:1100px;margin:0 auto;padding:24px 16px;font-family:system-ui,sans-serif;color:#1a1a1a">` +
  `<nav style="font-size:14px;margin-bottom:16px"><a href="/">StockOut</a> · <a href="/search">Surplus stock</a> · <a href="/categories">Categories</a></nav>${inner}</div>`;

/** Writes an extension-less file at the exact URL path (IIS serves it as text/html via web.config, no redirect). */
function write(urlPath: string, html: string) {
  const file = path.join(DIST, ...urlPath.split("/").filter(Boolean));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

function flatten(nodes: Category[], trail: string[] = []): Array<Category & { trail: string[] }> {
  return nodes.flatMap((n) => [{ ...n, trail: [...trail, n.name] }, ...flatten(n.children ?? [], [...trail, n.name])]);
}

const cardHtml = (c: Card) => {
  const place = c.location.stateOrEmirate || c.location.city;
  return `<li><a href="${esc(listingPath(c.listingId, c.title, place))}">${esc(c.title)}</a> — ${esc(money(c.basePrice, c.currency))}${c.quantityUnitSymbol ? ` / ${esc(c.quantityUnitSymbol)}` : ""}${place ? ` · ${esc(place)}` : ""}</li>`;
};

async function main() {
  const indexFile = path.join(DIST, "index.html");
  if (!fs.existsSync(indexFile)) throw new Error(`${indexFile} not found: run vite build first`);
  const template = fs.readFileSync(indexFile, "utf8");
  const urls: Array<{ loc: string; lastmod?: string; priority: string }> = [
    { loc: "/", priority: "1.0" },
    { loc: "/categories", priority: "0.8" },
    { loc: "/search", priority: "0.7" },
  ];

  const [all, tree] = await Promise.all([allListings(), get<Category[]>("/api/v1/catalog/categories")]);
  const listings = all.filter((l) => !isTestListing(l.title));
  console.log(`prerender: ${listings.length} listings, ${flatten(tree).length} categories from ${API}`);

  // Listing pages
  for (const c of listings) {
    const src: ListingSeoSource = {
      listingId: c.listingId,
      title: c.title,
      description: c.description,
      price: c.basePrice,
      currency: c.currency,
      category: c.categoryName,
      categoryTrail: c.categoryBreadcrumb,
      brand: c.brandName,
      condition: c.conditionName,
      sku: c.listingNumber,
      quantity: c.sellableQuantity,
      unit: c.quantityUnitSymbol ?? c.quantityUnitName,
      inStock: c.isAvailable && c.sellableQuantity > 0,
      city: c.location.city,
      emirate: c.location.stateOrEmirate,
      images: [img(c.primaryImage?.cdnUrl)].filter((u): u is string => !!u),
      validUntil: c.expiresAtUtc,
    };
    const seo = listingSeo(src);
    const trail = c.categoryBreadcrumb.length ? c.categoryBreadcrumb : [c.categoryName];
    const body = shell(
      `<p style="font-size:13px">${trail.map((n) => `<a href="${esc(categoryPath(n))}">${esc(n)}</a>`).join(" › ")}</p>` +
        `<h1>${esc(seo.h1)}</h1>` +
        (src.images[0] ? `<img src="${esc(src.images[0])}" alt="${esc(c.title)}" width="480" style="max-width:100%;height:auto" />` : "") +
        `<p><strong>${esc(money(c.basePrice, c.currency))}</strong>${c.quantityUnitSymbol ? ` per ${esc(c.quantityUnitSymbol)}` : ""} · ${src.inStock ? `${c.sellableQuantity.toLocaleString("en-US")} ${esc(src.unit ?? "")} available` : "Out of stock"}${src.city || src.emirate ? ` · ${esc([src.city, src.emirate].filter(Boolean).join(", "))}, UAE` : ""}</p>` +
        `<p>${esc(seo.summary)}</p>` +
        (c.description ? `<p style="white-space:pre-line">${esc(c.description)}</p>` : "") +
        `<p><a href="${esc(categoryPath(c.categoryName, c.location.stateOrEmirate))}">More surplus ${esc(c.categoryName.toLowerCase())}${c.location.stateOrEmirate ? ` in ${esc(c.location.stateOrEmirate)}` : " in the UAE"}</a></p>`,
    );
    write(seo.path, page(template, seo, body));
    urls.push({ loc: seo.path, lastmod: c.publishedAtUtc?.slice(0, 10), priority: "0.9" });
  }

  // Landing pages: every category that has listings, each emirate where it has stock, and "all" per emirate.
  const counts = new Map<string, number>();
  for (const l of listings) for (const n of l.categoryBreadcrumb.length ? l.categoryBreadcrumb : [l.categoryName]) counts.set(n, (counts.get(n) ?? 0) + 1);
  const cats = flatten(tree).filter((c) => (counts.get(c.name) ?? 0) > 0);
  const targets: Array<{ name: string | null; categoryId?: string; trail: string[]; emirate: string | null }> = [{ name: null, trail: [], emirate: null }];
  for (const e of EMIRATES) if (listings.some((l) => l.location.stateOrEmirate === e.name)) targets.push({ name: null, trail: [], emirate: e.name });
  for (const c of cats) {
    targets.push({ name: c.name, categoryId: c.categoryId, trail: c.trail, emirate: null });
    const inCat = listings.filter((l) => (l.categoryBreadcrumb.length ? l.categoryBreadcrumb : [l.categoryName]).includes(c.name));
    for (const e of EMIRATES) if (inCat.some((l) => l.location.stateOrEmirate === e.name)) targets.push({ name: c.name, categoryId: c.categoryId, trail: c.trail, emirate: e.name });
  }
  for (const t of targets) {
    const copy = landingCopy(t.name, t.emirate);
    const p = categoryPath(t.name, t.emirate);
    const items = listings
      .filter((l) => (!t.name || (l.categoryBreadcrumb.length ? l.categoryBreadcrumb : [l.categoryName]).includes(t.name)) && (!t.emirate || l.location.stateOrEmirate === t.emirate))
      .slice(0, 60);
    const seo: SeoInput = {
      title: copy.title,
      description: copy.intro,
      path: p,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: copy.heading,
          url: absoluteUrl(p),
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: items.length,
            itemListElement: items.slice(0, 24).map((l, i) => ({ "@type": "ListItem", position: i + 1, name: l.title, url: absoluteUrl(listingPath(l.listingId, l.title, l.location.stateOrEmirate || l.location.city)) })),
          },
        },
        breadcrumbLd([{ name: "Marketplace", path: "/search" }, ...t.trail.map((n) => ({ name: n, path: categoryPath(n) })), ...(t.emirate ? [{ name: t.emirate, path: p }] : [])]),
        { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: copy.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
      ],
    };
    const emirateLinks = EMIRATES.filter((e) => e.name !== t.emirate)
      .map((e) => `<a href="${esc(categoryPath(t.name, e.name))}">${esc(copy.heading.replace(/ in .*$/, ""))} in ${esc(e.name)}</a>`)
      .join(" · ");
    const body = shell(
      `<h1>${esc(copy.heading)}</h1><p>${esc(copy.intro)}</p>` +
        (items.length ? `<h2>Available now</h2><ul>${items.map(cardHtml).join("")}</ul>` : "") +
        `<h2>Frequently asked questions</h2>${copy.faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}` +
        `<p style="font-size:13px">${emirateLinks}</p>`,
    );
    write(p, page(template, seo, body));
    urls.push({ loc: p, priority: t.name ? (t.emirate ? "0.7" : "0.8") : "0.8" });
  }

  // Home and categories keep the app shell but get the organisation / site search data.
  fs.writeFileSync(
    indexFile,
    template.replace("</head>", `    ${[organizationLd(), websiteLd()].map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`).join("\n    ")}\n  </head>`),
  );

  const today = new Date().toISOString().slice(0, 10);
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${esc(absoluteUrl(u.loc))}</loc><lastmod>${u.lastmod ?? today}</lastmod><priority>${u.priority}</priority></url>`).join("\n") +
    `\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST, "sitemap.xml"), xml);
  fs.writeFileSync(path.join(DIST, "prerender-manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), site: SITE_URL, pages: urls.map((u) => u.loc) }, null, 1));
  console.log(`prerender: wrote ${urls.length} sitemap URLs (${listings.length} listings, ${targets.length} landing pages)`);
}

main().catch((e) => {
  // Never block a deploy on SEO pages.
  console.warn(`prerender: skipped (${e instanceof Error ? e.message : String(e)})`);
});
