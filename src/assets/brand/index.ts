/**
 * Brand raster assets (logo, photography). Resolved at build time: when a file is not present the URL is
 * undefined and components render their designed fallback.
 */
const files = import.meta.glob<string>("./*.{png,svg,webp,jpg}", { eager: true, query: "?url", import: "default" });

export const brandLogoUrl: string | undefined = files["./stockout-logo.png"] ?? files["./stockout-logo.svg"];
export const loginHeroUrl: string | undefined = files["./login-hero.png"] ?? files["./login-hero.webp"];
/** Home hero photo (reference: warehouse with steel channels). Drop in src/assets/brand/home-hero.jpg */
export const homeHeroUrl: string | undefined = files["./home-hero.jpg"] ?? files["./home-hero.webp"] ?? files["./home-hero.png"];
