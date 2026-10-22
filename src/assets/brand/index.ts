/**
 * Brand raster assets (logo, photography). Resolved at build time: when a file is not present the URL is
 * undefined and components render their designed fallback.
 */
const files = import.meta.glob<string>("./*.{png,svg,webp,jpg}", { eager: true, query: "?url", import: "default" });

/** Official logo from the Stockout Brand Guidelines (V1.0, July 2026): black wordmark for light backgrounds, white for dark. */
export const brandLogoUrl: string | undefined = files["./stockout-logo.svg"];
export const brandLogoWhiteUrl: string | undefined = files["./stockout-logo-white.svg"];
/** The folded-arrow "O" icon on its own (favicon, compact spots). */
export const brandMarkUrl: string | undefined = files["./stockout-mark.svg"];
export const loginHeroUrl: string | undefined = files["./login-hero.png"] ?? files["./login-hero.webp"];
/** Home hero photo (reference: warehouse with steel channels). Drop in src/assets/brand/home-hero.jpg */
export const homeHeroUrl: string | undefined = files["./home-hero.jpg"] ?? files["./home-hero.webp"] ?? files["./home-hero.png"];
