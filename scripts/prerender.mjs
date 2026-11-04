// Runs scripts/prerender.ts (bundled with esbuild, which ships with Vite) against dist/. Never fails the build.
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const out = path.resolve("node_modules/.cache/prerender.mjs");
fs.mkdirSync(path.dirname(out), { recursive: true });
try {
  await build({
    entryPoints: ["scripts/prerender.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    outfile: out,
    logLevel: "warning",
    define: { "import.meta.env.VITE_SITE_URL": JSON.stringify(process.env.VITE_SITE_URL ?? "") },
  });
  process.argv[2] = process.argv[2] ?? "dist";
  await import(pathToFileURL(out).href);
} catch (e) {
  console.warn(`prerender: skipped (${e instanceof Error ? e.message : String(e)})`);
}
