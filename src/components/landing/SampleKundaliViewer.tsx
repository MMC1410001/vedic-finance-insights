/**
 * SampleKundaliViewer — preview of a sample Financial Kundali in the hero.
 *
 * The whole report is here and scrollable on arrival. There is no tap, no
 * "open" affordance and no loading state to wait through: a visitor who wants to
 * read it just scrolls.
 *
 * ── Why there used to be a gate ─────────────────────────────────────────────
 * The report was rendered from a 5.6 MB PDF through react-pdf (a further 374 kB
 * of JS), which is far too much to hand every visitor for something above the
 * fold — so it sat behind a "Tap to read full report" poster. Deferring the cost
 * was the only lever available while the cost was that large.
 *
 * Rasterising the four pages to WebP removed the cost instead: 284 kB for the
 * set, of which only page 1 (95 kB) is eager — a 46 kB increase on the poster it
 * replaces, against 5.6 MB saved the moment anyone reads it. The gate had
 * nothing left to protect. See SampleKundaliDocument.
 *
 * Note Hero.tsx mounts this twice — a desktop copy and a mobile copy — so keep
 * it cheap, and remember that anything queried in a test exists twice in the DOM.
 */

import SampleKundaliDocument from "./SampleKundaliDocument";

export function SampleKundaliViewer() {
  return (
    <div
      className="relative rounded-2xl overflow-hidden w-full sample-kundali-viewer"
      style={{
        background: "transparent",
        boxShadow: "none",
        /**
         * Height comes from the parent, deliberately.
         *
         * This used to set `clamp(320px, 55vw, 420px)` itself while Hero's mobile
         * mount wrapped it in a fixed 220px box with `overflow: hidden` — so the
         * bottom 100px was clipped away. That did not matter while the content
         * was a static poster, but it does now the box scrolls: a scroller whose
         * lower third is invisible drops the reader mid-sentence and hides where
         * the scrollbar ends. Each mount site sizes it now.
         */
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        // The page keeps scrolling once this box reaches its end, rather than
        // trapping the gesture. `contain` would do the opposite — it is the
        // wrong default for a small scroller sitting in the middle of a hero.
        overscrollBehaviorY: "auto",
        // Momentum scrolling on iOS, which this box now relies on to be usable.
        WebkitOverflowScrolling: "touch",
      }}
    >
      <SampleKundaliDocument />
    </div>
  );
}
