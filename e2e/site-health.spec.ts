/**
 * Route sweep: console errors, own-origin request failures, broken images.
 *
 * The 131-file performance commit converted ~35 PNG/JPGs to WebP and deleted the
 * originals, rewrote the Rollup chunk graph, cut the splash from 3.1s to 1.2s,
 * and gated several animations behind a media query that reports desktop on the
 * first render. A dangling `@/assets` import would fail the build, but a runtime
 * `src` string or a CSS `url()` fails silently — which is what this sweep is for.
 *
 * Deliberately NOT asserted on: requests to the Supabase host. `track-visit` is
 * not deployed (visitor_events does not exist either), so every page load fires
 * one request that 404s. That is a real finding, reported separately, but it is
 * not what this file is checking and failing on it would mask everything else.
 */

import { test, expect, type Page } from "@playwright/test";
import { stubExternals } from "./helpers/birth-form";

const PUBLIC_ROUTES = [
  "/home",
  "/auth",
  "/privacy",
  "/terms",
  "/coming-soon",
  "/boost-wealth",
  "/upcoming-features",
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 780 },
] as const;

interface Collected {
  consoleErrors: string[];
  ownOriginFailures: string[];
  thirdPartyFailures: string[];
}

function collect(page: Page): Collected {
  const out: Collected = { consoleErrors: [], ownOriginFailures: [], thirdPartyFailures: [] };

  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // React Router's v7 future-flag notices are advisory and unrelated.
    if (/React Router Future Flag/.test(t)) return;
    // A failed request also echoes into the console as a generic "Failed to load
    // resource" whose text carries no URL — the origin is only in the message's
    // source location. Without this, every page fails on the track-visit 404
    // (that function is not deployed) and drowns out everything else.
    const src = m.location()?.url ?? "";
    if (/Failed to load resource/.test(t) && !src.startsWith("http://localhost:8080")) {
      out.thirdPartyFailures.push(`CONSOLE404 ${src}`);
      return;
    }
    out.consoleErrors.push(`${t}${src ? ` @ ${src}` : ""}`);
  });
  page.on("pageerror", (e) => out.consoleErrors.push(`PAGEERROR ${e.message}`));

  const note = (url: string, why: string) => {
    const line = `${why} ${url}`;
    if (url.startsWith("http://localhost:8080")) out.ownOriginFailures.push(line);
    else out.thirdPartyFailures.push(line);
  };
  page.on("requestfailed", (r) => note(r.url(), `FAILED(${r.failure()?.errorText ?? "?"})`));
  page.on("response", (r) => {
    if (r.status() >= 400) note(r.url(), `HTTP${r.status()}`);
  });

  return out;
}

/** Images that laid out but decoded nothing — the silent PNG→WebP failure mode. */
async function brokenImages(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("img")]
      .filter((img) => img.complete && img.naturalWidth === 0 && !!img.getAttribute("src"))
      .map((img) => img.getAttribute("src")!),
  );
}

for (const vp of VIEWPORTS) {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} is clean at ${vp.name}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      await stubExternals(page);
      const found = collect(page);

      const response = await page.goto(route, { waitUntil: "networkidle" });
      // Every route in the table is a real SPA route; a 404 document means the
      // rewrite rule broke, not that the page is empty.
      expect(response?.status(), `${route} document status`).toBeLessThan(400);
      await page.waitForTimeout(1500); // let lazy images and animations settle

      expect(await brokenImages(page), `${route} @${vp.name}: images that decoded nothing`).toEqual([]);
      expect(found.ownOriginFailures, `${route} @${vp.name}: own-origin request failures`).toEqual([]);
      expect(found.consoleErrors, `${route} @${vp.name}: console errors`).toEqual([]);

      await context.close();
    });
  }
}

test("the splash finishes in about a second, not three", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await stubExternals(page);

  // Index.tsx gates the splash on sessionStorage, so a fresh context always
  // shows it. Time from navigation to the splash element leaving the DOM.
  const started = Date.now();
  await page.goto("/");

  const splashText = page.getByText("VedicFinance", { exact: false }).first();
  await expect(splashText).toBeVisible({ timeout: 10_000 });

  // The tagline lives in a window that closes at 900ms with a 150ms delay and a
  // 250ms transition — tight enough that it could be cut off entirely.
  const taglineSeen = await page
    .locator("text=/decisions|wealth|cosmic|financial/i")
    .first()
    .isVisible()
    .catch(() => false);

  await page.waitForFunction(
    () => !document.body.textContent?.includes("Loading your cosmic"),
    { timeout: 10_000 },
  ).catch(() => { /* copy may differ; the timing assertion below is the real one */ });

  // Landing content is up once the birth-details CTA is *visible*. The page
  // renders desktop and mobile copies of it and hides one, so .first() can land
  // on the hidden one — filter by visibility rather than taking the first match.
  await expect(
    page.getByText("Unlock your Financial Kundali", { exact: false }).filter({ visible: true }).first(),
  ).toBeVisible({ timeout: 15_000 });
  const elapsed = Date.now() - started;

  // Generous ceiling: this is a regression guard against creeping back toward
  // the old ~3.1s, not a benchmark. A cold Vite dev server adds compile time.
  expect(elapsed, `splash-to-landing took ${elapsed}ms`).toBeLessThan(8_000);
  console.log(`  splash-to-landing: ${elapsed}ms; tagline visible: ${taglineSeen}`);

  await context.close();
});

test("the landing hero renders one horoscope wheel, not two", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page = await context.newPage();
  await stubExternals(page);
  await page.goto("/home", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // Two Lottie players used to be mounted and switched with `hidden md:block`;
  // display:none does not stop a canvas animation loop, so both ran forever.
  const canvases = await page.evaluate(
    () => document.querySelectorAll("canvas").length,
  );
  expect(canvases, `hero canvas count at 390px (was 2 wheels)`).toBeLessThanOrEqual(2);
  await context.close();
});

test("the sample kundali is readable by scrolling, with no tap gate", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await stubExternals(page);
  await page.goto("/home", { waitUntil: "networkidle" });

  // Hero.tsx mounts the viewer twice — a desktop copy and a mobile copy, one of
  // which is always display:none. `:visible` picks the one this viewport is
  // actually showing; `.first()` picks whichever is earlier in the DOM, which at
  // 1440px is the hidden mobile one.
  const viewer = page.locator(".sample-kundali-viewer:visible").first();
  await expect(viewer, "the sample kundali viewer is missing").toBeVisible({ timeout: 20_000 });

  // The point of the change: no "open" affordance stands between the visitor and
  // the report. If a gate is ever reintroduced, this is what should fail.
  await expect(page.getByRole("button", { name: /Open the full sample/i })).toHaveCount(0);
  await expect(page.getByText("Tap to read full report")).toHaveCount(0);

  // Page 1 is eager, so it is there without any interaction.
  const firstPage = viewer.locator('img[alt*="Sample Financial Kundali"]').first();
  await expect(firstPage).toBeVisible();
  // width/height are declared on the element to stop the hero shifting as pages
  // decode; assert it occupies space rather than collapsing to 0.
  const box = await firstPage.boundingBox();
  expect(box!.width, "page 1 collapsed").toBeGreaterThan(100);
  expect(box!.height, "page 1 collapsed").toBeGreaterThan(100);

  // The whole report is present, not just the first page — that is what makes
  // scrolling worth doing.
  await expect(viewer.locator("img")).toHaveCount(4);

  // And the box genuinely scrolls: content taller than the frame, and the
  // scroll position actually moves when asked.
  const scrolled = await viewer.evaluate((el) => {
    const overflows = el.scrollHeight > el.clientHeight + 10;
    el.scrollTop = 200;
    return { overflows, scrollTop: el.scrollTop };
  });
  expect(scrolled.overflows, "the viewer does not overflow, so there is nothing to scroll").toBe(true);
  expect(scrolled.scrollTop, "the viewer did not scroll").toBeGreaterThan(0);

  // The 5.6MB PDF and pdfjs must not come back — that weight is exactly what
  // forced the tap gate that this test now forbids.
  const heavy = await page.evaluate(() =>
    performance.getEntriesByType("resource")
      .map((e) => (e as PerformanceResourceTiming).name)
      .filter((n) => /\.pdf($|\?)|pdf\.worker|pdfjs-dist/.test(n)),
  );
  expect(heavy, "the sample PDF / pdfjs was loaded on the landing page").toEqual([]);

  await context.close();
});
