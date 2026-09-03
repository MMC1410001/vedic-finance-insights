/**
 * The pages of the sample Financial Kundali, as images.
 *
 * ── Why images and not the PDF ──────────────────────────────────────────────
 * This used to render `sample-financial-kundali.pdf` through react-pdf. That put
 * three costs on the landing page: the PDF is 5.6 MB, react-pdf + pdfjs-dist add
 * 374 kB of JS, and pdfjs fetches its worker from unpkg.com at runtime. The
 * weight is why the viewer was behind a "Tap to read full report" gate in the
 * first place — nobody wanted to spend 6 MB on a visitor who never looked.
 *
 * The same four pages rasterised to WebP at 1400px are **284 kB in total**, so the
 * gate stops being necessary: the whole report can just sit there and be
 * scrolled. Only page 1 (95 kB) is eager — against the 49 kB poster it replaces
 * that is +46 kB above the fold, which buys text that is legible on a retina
 * screen. The other three pages are lazy.
 *
 * The trade is that the text is no longer selectable or zoomable past 1400px.
 * For a teaser in the hero that is the right trade — until it was tapped, this
 * was a flat poster image anyway.
 *
 * ── Regenerating these ──────────────────────────────────────────────────────
 * If the sample report changes, re-rasterise from the PDF rather than
 * screenshotting by hand — `scripts/rasterise-sample-kundali.mjs` renders every
 * page at 1400px through the copy of pdfjs already in node_modules.
 */

import page1 from "@/assets/sample-kundali/page-1.webp";
import page2 from "@/assets/sample-kundali/page-2.webp";
import page3 from "@/assets/sample-kundali/page-3.webp";
import page4 from "@/assets/sample-kundali/page-4.webp";

/**
 * Every page is rasterised at this size, so the intrinsic ratio is shared and
 * can be declared once. Declared on the element so the hero reserves the right
 * box and does not shift as pages decode.
 *
 * 1400 because the viewer measures ~689px wide on desktop, and this is a
 * document full of small text — at 900px it was undersupplied on any retina
 * screen and the type went soft. Keep these two numbers in step with WIDTH in
 * scripts/rasterise-sample-kundali.mjs; the script warns if the pages ever come
 * out at mixed sizes, which would invalidate a single shared ratio.
 */
const PAGE_W = 1400;
const PAGE_H = 1650;

const PAGES = [page1, page2, page3, page4];

export default function SampleKundaliDocument() {
  return (
    <div>
      {PAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={`Sample Financial Kundali, page ${i + 1} of ${PAGES.length}`}
          width={PAGE_W}
          height={PAGE_H}
          /**
           * Page 1 is above the fold and is the first thing a visitor sees in
           * the hero, so it is fetched eagerly and at high priority — it is
           * standing in for what used to be the poster. The rest are lazy: they
           * are below the fold of a 420px scroll box and most visitors never
           * reach them.
           */
          loading={i === 0 ? "eager" : "lazy"}
          fetchpriority={i === 0 ? "high" : "low"}
          decoding="async"
          className="block w-full h-auto"
          /**
           * Overhang, matching what the react-pdf version did: the report has a
           * white margin of its own, and pulling each page out past the
           * container lets `overflow-hidden` clip it so the gold border sits
           * flush against the frame instead of floating inside a white gutter.
           */
          style={{
            marginLeft: "-8px",
            marginTop: i === 0 ? "-8px" : "0",
            width: "calc(100% + 16px)",
            maxWidth: "none",
          }}
        />
      ))}
    </div>
  );
}
