import * as React from "react";
import { SITE_NAME, absoluteUrl, isCanonicalHost } from "./site";

export interface SeoInput {
  /** Full page title (the site name is appended unless it is already there). */
  title: string;
  description: string;
  /** Path of the canonical page on www.stockoutme.com. */
  path: string;
  image?: string | null;
  type?: "website" | "product";
  /** Keep out of search results (private or thin pages). */
  noindex?: boolean;
  /** One or more schema.org objects. */
  jsonLd?: object | object[] | null;
}

const DEFAULT_IMAGE = "/og-image.jpg";

function meta(attr: "name" | "property", key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === null) return el?.remove();
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function link(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Applies title, description, canonical, robots, Open Graph / Twitter and JSON-LD for the current page. */
export function applySeo(s: SeoInput) {
  const title = s.title.includes(SITE_NAME) ? s.title : `${s.title} | ${SITE_NAME}`;
  const description = s.description.replace(/\s+/g, " ").trim().slice(0, 300);
  const url = absoluteUrl(s.path);
  const image = absoluteUrl(s.image || DEFAULT_IMAGE);
  document.title = title;
  meta("name", "description", description);
  meta("name", "robots", s.noindex || !isCanonicalHost() ? "noindex, follow" : "index, follow, max-image-preview:large");
  link("canonical", url);
  meta("property", "og:site_name", SITE_NAME);
  meta("property", "og:type", s.type ?? "website");
  meta("property", "og:title", title);
  meta("property", "og:description", description);
  meta("property", "og:url", url);
  meta("property", "og:image", image);
  meta("property", "og:locale", "en_AE");
  meta("name", "twitter:card", "summary_large_image");
  meta("name", "twitter:title", title);
  meta("name", "twitter:description", description);
  meta("name", "twitter:image", image);
  document.head.querySelectorAll('script[data-seo="ld"]').forEach((n) => n.remove());
  const blocks = s.jsonLd ? (Array.isArray(s.jsonLd) ? s.jsonLd : [s.jsonLd]) : [];
  for (const b of blocks) {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.dataset.seo = "ld";
    el.textContent = JSON.stringify(b);
    document.head.appendChild(el);
  }
}

export function useSeo(s: SeoInput | null) {
  const key = s ? JSON.stringify(s) : "";
  React.useEffect(() => {
    if (s) applySeo(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
