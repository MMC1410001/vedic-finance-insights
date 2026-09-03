---
name: vedicfinance-performance-review
description: Review a change for performance — bundle size, image weight, render cost, re-render churn, lazy loading, and animation/WebGL overhead. Use for "performance", "optimize", "slow", "bundle size", "load time", "why is this laggy", "Lighthouse", "memory", or before shipping anything that adds a dependency, asset, or animation.
---

# VedicFinance — performance review

Optimize what actually costs the user time. In this app that is, in order: **images, then JS bundle, then render churn.** Don't lead with memoization when 42 MB of PNGs are shipping.

## Scope

1. Explicit argument wins.
2. Else uncommitted diff.
3. Else commits ahead of `origin/af-prod`.
4. Else clean on `af-prod` → ask what to review.

**Report only. Never edit files.** Close with: *"Say `fix <n>` to apply any of these."*

## Output

Ranked by **user-visible impact**, not ease of fix. Each: `file:line`, the claim, an **estimated cost** (kB, ms, or re-render count), severity, fix sketch. Mark **pre-existing** issues as such.

## Standing issue #1 — image weight (pre-existing, biggest win)

`src/assets/` is **42 MB**; a production `dist/` is **39 MB**. Individual PNGs:

| Asset | Size |
|---|---|
| `dashboard-hero-asset.png` | 2.9 MB |
| `astrologer.png` | 2.9 MB |
| `auth-bg.png` | 2.0 MB |
| `testimonial-images/*.png` | 1.5–1.8 MB each |
| `horoscopes/*.png`, `investement-options/*.png` | 1.2–1.5 MB each |

All PNG. No WebP/AVIF, no responsive `srcset`, no compression step in the build. A single hero image outweighs the entire JS bundle.

**Any diff adding an uncompressed PNG over ~200 kB is a `major` finding.** The systemic fix (convert to WebP/AVIF, add `srcset`, lazy-load below-the-fold) is out of scope for a review — report it, don't start it.

## Bundle baselines

From a clean `npm run build` — treat as the regression baseline and flag meaningful growth:

| Chunk | Raw | Gzip |
|---|---|---|
| `index-*.js` (main) | 1054 kB | 315 kB |
| `vendor-recharts` | 565 kB | 158 kB |
| `HomeNew` | 503 kB | 83 kB |
| `vendor-three` | 447 kB | 113 kB |
| `vendor-pdf` (jspdf + html-to-image) | 373 kB | 124 kB |
| `html2canvas.esm` | 201 kB | 48 kB |
| `FinancialKundali` | 144 kB | 36 kB |
| `vendor-motion` | 132 kB | 44 kB |

Vite warns about >500 kB chunks on every build — that warning is expected, not new.

**`vite.config.ts` already defines `manualChunks`** (`vendor-three`, `vendor-recharts`, `vendor-motion`, `vendor-pdf`). Extend that map; don't propose a fresh chunking strategy as if none existed.

The main chunk at 1054 kB is the standing target. Anything pulled into it — a top-level import in an eagerly-loaded module — hits every visitor including bounces.

## Loading rules

- `src/App.tsx` loads only `Index` and `Landing` eagerly; everything else is `React.lazy` under `<Suspense fallback={null}>`. **A new eager route is a `major` finding.**
- Three.js and `@paper-design/shaders` components must be lazy — `SectionBackground`-style `React.lazy` — so WebGL never blocks first paint.
- PDF export (`jspdf`, `html2canvas`, `html-to-image`) must stay behind a dynamic import triggered by the export action, never a module-level import in a rendered page.
- `src/index.css` opens with a Google Fonts `@import` pulling four families (Cinzel Decorative, Plus Jakarta Sans, Playfair Display with 18 weights/italics, Inter). A CSS `@import` is render-blocking and serialized after the stylesheet loads — a standing FCP cost, and a reason to resist adding weights.

## Render cost

- **Zustand**: subscribe per slice — `useReportStore(s => s.scores)`. Subscribing to the whole store re-renders on every unrelated field change. A new whole-store subscription is a real finding.
- **TanStack Query**: `useUserStatus` deliberately uses `staleTime: 30_000` / `gcTime: 60_000`. The short `gcTime` is intentional (stale paid/unpaid state persisted on mobile). Don't "optimize" it upward.
- **Engines are called during render** in several pages. `financial-kundali-engine.ts` is ~1600 lines of computation — check new `compute*` calls are inside `useMemo` keyed on the birth details, not recomputed every render.
- **Animations**: prefer `transform`/`opacity`. `ticker-scroll` already uses `translate3d`. Animating layout properties, or running many simultaneous infinite animations (`twinkle`, `float-slow`, `pulse-glow`) on a long page, causes real jank on mid-range mobile.
- **Charts**: Recharts is the heaviest vendor chunk. Reuse existing chart components rather than importing new Recharts primitives into new bundles.

## Deliberate patterns — do not "optimize" these

- `report-store.ts` hydrates from `sessionStorage` **synchronously at store creation**. That's on purpose: it prevents a skeleton flash between pages. Moving it into `useEffect` is a regression, not an improvement.
- Seeded engines mixing `new Date()` into output — a correctness/product decision, not a caching bug.
- `hmr.overlay: false` in `vite.config.ts` — a dev-experience choice.

## Measuring

```bash
npm run build          # per-chunk sizes, raw + gzip
du -sh dist src/assets # total weight
```

Report measured numbers. Don't estimate a bundle delta you can build and read.
