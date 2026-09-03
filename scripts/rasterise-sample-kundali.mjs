/**
 * Rasterise the sample Financial Kundali PDF into the page images the hero shows.
 *
 *   node scripts/rasterise-sample-kundali.mjs
 *
 * Why this exists: src/components/landing/SampleKundaliDocument.tsx used to
 * render sample-financial-kundali.pdf through react-pdf, which cost 5.6 MB of
 * PDF plus 374 kB of react-pdf/pdfjs on the landing page and forced the viewer
 * behind a tap gate. The same four pages as WebP are ~284 kB, so the report can
 * simply be scrolled. When the sample report changes, re-run this rather than
 * screenshotting pages by hand — hand-cropped pages drift in size and the
 * `width`/`height` attributes on the <img> stop matching, which reintroduces
 * layout shift in the hero.
 *
 * It renders through the copy of pdfjs-dist already in node_modules, inside the
 * Playwright Chromium that is already installed, because a canvas is the only
 * thing that turns a PDF page into pixels and neither poppler nor ImageMagick is
 * a dependency of this repo. Nothing is fetched from the network: the library,
 * its worker and the PDF are all served to the page from disk through a routed
 * stub origin.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PDF = path.join(ROOT, "src/assets/sample-financial-kundali.pdf");
const OUT_DIR = path.join(ROOT, "src/assets/sample-kundali");

/**
 * The viewer measures ~689px wide on desktop (measured, not assumed — an earlier
 * guess of ~430px produced 900px pages whose small print went soft on retina),
 * so 1400 is ~2x that. Raising it further costs landing-page bytes for detail
 * nobody can see; lowering it makes a text-heavy document blurry. See the width
 * note in scripts/optimize-images.sh.
 */
const WIDTH = Number(process.env.WIDTH || 1400);
const QUALITY = Number(process.env.QUALITY || 0.8);

const libSrc = fs.readFileSync(path.join(ROOT, "node_modules/pdfjs-dist/build/pdf.min.mjs"), "utf8");
const workerSrc = fs.readFileSync(path.join(ROOT, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"), "utf8");
const pdfBytes = fs.readFileSync(PDF);

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

// A stub origin, so the module and its worker load as ordinary same-origin URLs.
// pdfjs refuses to start without a real worker, and a blob: worker is blocked
// from importing, so routing is the path of least resistance.
await page.route("https://pdf.local/**", (route) => {
  const url = route.request().url();
  if (url.endsWith("/pdf.mjs")) return route.fulfill({ body: libSrc, contentType: "text/javascript" });
  if (url.endsWith("/worker.mjs")) return route.fulfill({ body: workerSrc, contentType: "text/javascript" });
  if (url.endsWith("/doc.pdf")) return route.fulfill({ body: pdfBytes, contentType: "application/pdf" });
  return route.fulfill({ body: "<!doctype html><meta charset=utf-8>", contentType: "text/html" });
});
await page.goto("https://pdf.local/");

const pages = await page.evaluate(async ({ WIDTH, QUALITY }) => {
  const pdfjsLib = await import("https://pdf.local/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://pdf.local/worker.mjs";
  const doc = await pdfjsLib.getDocument("https://pdf.local/doc.pdf").promise;

  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pdfPage = await doc.getPage(i);
    const base = pdfPage.getViewport({ scale: 1 });
    const viewport = pdfPage.getViewport({ scale: WIDTH / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    out.push({ i, w: canvas.width, h: canvas.height, data: canvas.toDataURL("image/webp", QUALITY) });
  }
  return out;
}, { WIDTH, QUALITY });

let total = 0;
const sizes = new Set();
for (const p of pages) {
  const buf = Buffer.from(p.data.split(",")[1], "base64");
  fs.writeFileSync(path.join(OUT_DIR, `page-${p.i}.webp`), buf);
  total += buf.length;
  sizes.add(`${p.w}x${p.h}`);
  console.log(`page-${p.i}.webp  ${p.w}x${p.h}  ${(buf.length / 1024).toFixed(0)} KB`);
}

console.log(`\ntotal: ${(total / 1024).toFixed(0)} KB  (the PDF is ${(pdfBytes.length / 1024).toFixed(0)} KB)`);
if (sizes.size > 1) {
  // The <img> tags declare one width/height for every page, so mixed sizes would
  // mean the wrong aspect ratio is reserved and the hero shifts as pages decode.
  console.warn(`\n⚠  pages are not all the same size (${[...sizes].join(", ")}).`);
  console.warn("   Update PAGE_W / PAGE_H in SampleKundaliDocument.tsx, or give each page its own.");
}

await browser.close();
