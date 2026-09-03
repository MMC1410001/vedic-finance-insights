# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branch reality — read first

This repo has 64 branches and **`main` is a dead prototype** (last commit May 5, a Lovable mock-data demo with no Supabase, payments, or real astronomy). Do not treat `main` as the baseline and do not merge toward it.

Active line: **`af-prod`** (repo owner) and its descendants. The working tree is normally on `af-prod` or a feature branch off it. Confirm with `git branch --show-current` before reasoning about what exists — file layout differs drastically between `main` and the active branches.

## Commands

Node 22 via `.nvmrc` (`nvm use`). npm only — `bun.lock` / `bun.lockb` are committed but stale; ignore them. Note production (`render.yaml`) builds on **Node 20**.

```bash
npm ci                 # install
npm run dev            # Vite dev server on http://localhost:8080 (not 5173)
npm run build          # -> dist/
npm run build:dev      # development-mode build (keeps lovable-tagger)
npm run preview        # serve the build
npm run start          # serve dist on $PORT (production, via `serve`)
npm run lint           # eslint
npm test               # vitest run
npm run test:watch     # vitest watch
```

Single test: `npx vitest run src/test/sectorMappings.test.ts` or `npx vitest run -t "name"`.

**The app needs `.env` to run.** Copy `.env.example` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Without them the Supabase client is constructed with `undefined` and every auth-gated route fails. Ask for the values — don't invent them.

Two traps worth knowing up front:

- `npm run lint` **exits 0 while reporting errors.** It is not a gate; read the output.
- **Playwright works, and it runs against production.** The config that imported the missing
  `lovable-agent-playwright-config` has been replaced; `npm run test:e2e` runs 97 specs in `e2e/`.
  It is `workers: 1` on purpose — the specs count rows in shared tables and there is only one
  Supabase project. A full run takes ~20 minutes, and 30s waits time out under that load, so
  re-run a failure in isolation before believing it.

## Architecture

React 18 + Vite (SWC) + TypeScript SPA → Supabase (Postgres, Auth, 10 Edge Functions) → Zoho Payments, OpenAI, Prokerala. Full diagrams in `docs/ARCHITECTURE.md`. Path alias `@` → `./src`.

Deployed as a static SPA (`vercel.json` rewrites everything to `index.html`; `render.yaml` serves `dist`). All server logic lives in Supabase edge functions, not in this build.

### Routes and guards (`src/App.tsx`)

`Index` and `Landing` load eagerly; **everything else is `React.lazy`** inside `<Suspense fallback={null}>`. Keep new routes lazy.

| Access | Routes |
|---|---|
| Public | `/`, `/home`, `/auth`, `/kundali`, `/payment`, `/shared/:slug`, `/coming-soon`, `/boost-wealth`, `/upcoming-features`, legal pages |
| `ProtectedRoute` (auth) | `/dashboard`, `/profile`, `/business-timing`, `/vedic-trading`, `/chat` |
| `PaidRoute` | `/ai-chat` |
| Unguarded (note) | `/admin` |

**`/kundali` is free and `/ai-chat` is the paid feature** — the reverse of how it
once worked, and the reverse of what this table said until the error was caught.
The report is the funnel's top, not its prize: `/payment` is unguarded so an
anonymous visitor can see the ₹99 offer, and `chat-access.ts` holds the one
denial policy that `PaidRoute` and every in-app chatbot button share. Check
`src/App.tsx` before trusting any restatement of this, including this one.

Guards never decide redirects themselves — they delegate to `getRedirectForRoute()` in `src/lib/resolve-destination.ts`, the single source of routing truth alongside `resolveDestination()`. `sessionStorage.guestMode === "true"` bypasses `ProtectedRoute` — it is set by "Continue as guest" on the onboarding form, so it is reachable in production, not a demo-only flag. `PaidRoute` deliberately does **not** honour it; letting it through would waive payment.

### Service layer (`src/lib/`)

This is where logic lives; components render. Grouped:

- **Backend**: `supabase.ts` (the one client), `vedicfinance-api.ts` (edge-function calls), `payment-api.ts`, `zoho-payments.ts`, `kundali-history.ts`, `auth-context.tsx`
- **Routing/state**: `resolve-destination.ts`, `report-store.ts` + `feedback-store.ts` (Zustand), `kundali-theme-context.tsx`
- **Analytics**: `analytics.ts` (the one dataLayer writer, dual-sinks to our own log), `event-queue.ts` (batched writer — the *only* thing that queues an event), `click-tracking.ts` (one capture-phase delegated listener), `visitor-tracking.ts` (the immediate path, funnel milestones only), `RouteTracker.tsx`, `admin-api.ts` (`invokeAdmin` — use it for every admin edge call; plain `functions.invoke` discards the body of a non-2xx and reports every error as "non-2xx status code"), `tracking-scope.ts` (`trackingSuppressed()` — consult before recording anything), `tracked-pages.ts` (the one page catalogue: labels, `normalisePath()`, and what gets sampled), `utm.ts` (campaign capture — first/last touch, URL cleaning, the `stamp_first_touch` RPC; see `docs/CAMPAIGN-UTM-GUIDE.md`)
- **Astrology**: `vedic-calc.ts` (real, astronomy-engine), `financial-kundali-engine.ts`, `sector-scoring-engine.ts`, `sectorMappings.ts`, `business-timing-engine.ts`, `daily-trading-engine.ts`, `explanation-builder.ts`, plus the seeded mock engines (`astro-engine.ts`, `kundali-engine.ts`, `bonds-engine.ts`, `risk-engine.ts`, `investment-engine.ts`)

State split: **TanStack Query** for server state (`useUserStatus`), **Zustand** for the kundali report and feedback, **`sessionStorage`** as the hydration source and cross-page carrier, **React context** for auth and kundali theme.

### Six facts that cause real bugs

1. **Astro logic is duplicated.** `supabase/functions/generate-report/{astro,engine}.ts` is a Deno reimplementation of `src/lib/vedic-calc.ts` — edge functions can't import from `src/`. Change one without the other and server reports disagree with the client for the same birth details.
2. **Sign-out cache clearing is a manual list.** The `SIGNED_OUT` handler in `src/lib/auth-context.tsx` enumerates the `sessionStorage` keys to clear (plus `localStorage.moonSign` and a `financialSummary_*` prefix scan). Any new user-scoped cache key must be added there, or the next user on that browser sees the previous user's data.
3. **Click tracking is capture-then-enrich, and both halves are load-bearing.** `click-tracking.ts` listens on `document` in the **capture** phase (a bubble listener loses every click whose handler calls `stopPropagation`), which means it cannot know the click's name; `analytics()` runs later and attaches the GTM tag to that same queued row. Give either half its own write and every named tag doubles. See ANALYTICS.md → "The first-party event log".
4. **The heatmap preview must show the page it claims.** `/auth` and `/payment` redirect a signed-in session on mount, so the overlay used to sit on the wrong page while still labelling it. `isHeatmapPreview()` suppresses those two redirects — and requires the page to be *actually framed*, not just flagged, because skipping `/payment`'s `hasPaid` redirect in a real tab would put the ₹99 offer back in front of a paid user. A mismatch detector hides the canvas for anything added later. See ANALYTICS.md → "Pages that redirect themselves".
5. **Nothing may record itself.** `trackingSuppressed()` in `src/lib/tracking-scope.ts` gates *both* tracking paths, and it is a data-integrity rule rather than a preference: the /admin heatmap frames real pages, so without it opening that panel writes rows — from the office IP — into the table it is displaying. `/admin` is suppressed for the same reason. Any new event source must consult it.
6. **Internal-traffic filtering is per session, not per event.** The Vikhroli office balances across three ISPs *per request*, so one visit's events carry several different addresses. `internal_sessions` in `admin_analytics()` decides once per session and everything derives from that; matching event-by-event would leave every internal session partly counted — a plausible number that is wrong. `payment_orders` has no IP and is filtered by account instead, or the funnel reports more completions than starts.

## Project rules that are binding

### Do not touch the kundli generation algorithm

**The mathematical logic that generates the kundli is off-limits unless the user explicitly asks to change it.** "Explicitly" means a direct instruction to change the chart math — not an inference from a bug report, a refactor request, a cleanup task, or output that merely looks wrong.

Protected files, and the protected surface within them:

| File | Protected logic |
|---|---|
| `src/lib/vedic-calc.ts` | Ayanamsa (Lahiri/Chitrapaksha), tropical→sidereal conversion, Julian Day, planetary longitudes, Rahu/Ketu derivation, ascendant/Lagna, nakshatra and pada, sign/degree derivation, `computeDasha`, `buildVedicChart` |
| `supabase/functions/generate-report/astro.ts` | The Deno mirror of all of the above, plus `houseFromSign`, `DASHA_SEQ` / `DASHA_YRS`, `SIGN_LORDS`, `ZODIAC` |
| `supabase/functions/generate-report/engine.ts` | Chart construction and financial scoring built on those primitives, plus the dignity tables (`EXALTATION`, `DEBILITATION`, `OWN_SIGNS`) |
| `src/lib/kundali-engine.ts` | Chart-shaping logic and its seeded derivation |

This includes constants, not just code paths: ayanamsa values, precession rate, dasha sequence and durations, dignity tables, nakshatra boundaries, house-derivation rules. **Changing a number here changes every user's chart.**

Also covered: the `rng()` call order in the seeded engines (`astro-engine.ts`, `kundali-engine.ts`, `bonds-engine.ts`, `risk-engine.ts`, `investment-engine.ts`). Inserting or reordering a call silently rewrites every downstream value.

**Still fine without asking** — anything that cannot change output: types and interfaces, comments and docstrings, formatting, renaming a local variable, adding a pure read-only helper, adding tests, and fixing a genuine crash (null guard, out-of-bounds) *provided the computed values are identical*.

**If you believe the math is wrong**, say so and stop. Report the specific function, the expected vs actual value, and your reasoning — then wait. Do not "fix" it as part of another task. Vedic chart calculation has multiple legitimate conventions (ayanamsa variant, house system, node type), so what looks like a bug is often a deliberate choice.

If a change is authorized, it must be **mirrored** in both `src/lib/vedic-calc.ts` and `supabase/functions/generate-report/{astro,engine}.ts`, or client and server output diverge for the same birth details.

### Rules inherited from `.kiro/steering/`

`.kiro/steering/` holds project rules written for another AI tool. **They apply here too.**

- `theme-rules.md` — the Cosmic (dark) theme on `/kundali` is **frozen**. All Vedic/light overrides scope under `.vedic-theme` in `src/index.css`. Inline dark styles in `src/components/financial-kundali/` must not be touched.
- `design-guidelines.md` — palette, typography, card/CTA/motion specs.

`.kiro/specs/sector-favorability-analysis/` is a written spec (requirements/design/tasks) governing `sector-scoring-engine.ts` and `sectorMappings.ts`. Read it before touching either.

Product constraint enforced in the `chat` edge function prompt and the sector spec: **never emit specific stock/security/crypto recommendations or exact monetary predictions.**

## Skills

**Building** — load the matching skill before non-trivial work:

- `supabase-data-layer` — edge functions, migrations, RLS, auth, guards, Query/Zustand
- `vedic-astro-engines` — charts, dashas, transits, scoring, forecasts
- `vedicfinance-ui-theming` — components, styling, themes, animation, charts
- `vedicfinance-testing` — Vitest, fast-check, mocking, Playwright status

**Reviewing** — report-only personas, default scope is the current diff:

- `vedicfinance-tech-lead-review` — correctness, layering, architectural contracts
- `vedicfinance-security-review` — secrets, RLS, service-role, admin auth, payments
- `vedicfinance-qa-review` — regression rows from `QA-Bandwidth.md` (which lives in that skill's own directory, not the repo root), manual verification
- `vedicfinance-performance-review` — image weight, bundle budgets, render cost
- `vedicfinance-ux-research` — comprehension, a11y, feedback data
- `vedicfinance-pm-review` — scope, spec format, customer-facing claims

These are distinct from the built-in `/code-review` and `/security-review`, which remain available.

## Other docs in-repo

Substantial and mostly current — check these before asking or assuming.

### Product & strategy

| Doc | What it's for | Reach for it when |
|---|---|---|
| `PRFAQ.md` (142) | Customer-facing positioning, v2.0, prepared by Preet / reviewed by Rushi. The strongest public claims live here. | Changing anything users were promised. **Caveat: it claims Swiss Ephemeris + Placidus houses, which the code does not implement.** |
| `FEATURES.md` (179) | Feature + architecture reference — the seven financial scores and what each measures, engine-by-engine. | Naming, adding, or altering a score or insight module. Carries the same ephemeris caveat. |
| `VedicFinance-Strategic-Note.md` (231) | User persona (urban Indian professionals 22–40), market framing, differentiation. | Weighing whether a feature fits the audience. |

### Architecture & implementation

| Doc | What it's for | Reach for it when |
|---|---|---|
| `docs/ARCHITECTURE.md` (810) | The system diagrams — SPA → Supabase → external services, the route/guard map, auth and state flow. Most complete technical overview. | Onboarding to the system, or making a structural change. |
| `PAYMENT_INTEGRATION.md` (166) | The **shipped** ₹99 Zoho architecture: 3 edge functions, DB as source of truth. | Understanding how payment works today. |
| `ANALYTICS.md` (670) | Both measurement systems: the GTM/GA4 tag contract (31 agreed names, matched as exact strings) **and** the first-party event log behind /admin → Analytics. Carries the capture-then-enrich rule and the deploy caveat. | Touching `analytics.ts`, the event queue, click tracking, or the Analytics section. Read before adding a tag. |
| `zoho-payment-guide.md` (326) | The **implementation plan** that produced it — replacing a simulated `localStorage` + `Math.random()` flow with real Supabase edge functions. | Tracing why the payment code is shaped the way it is. |
| `ZOHO_PAYMENT_INTEGRATION_GUIDE.md` (1170) | **Generic vendor reference**, written against a Go + Next.js implementation — *not* this stack. | Looking up Zoho API semantics. Don't mistake it for a description of this codebase. |
| `PLAN-admin-user-management.md` (132) | Why the admin panel and `admin-user-management` edge function exist — resetting payment state to re-test with the same Google account. | Touching admin. Explains the service-role dependency. |

### Design, UX & QA

| Doc | What it's for | Reach for it when |
|---|---|---|
| `.kiro/steering/theme-rules.md` | **Binding** — the Cosmic dark theme is frozen; Vedic overrides scope under `.vedic-theme`. | Any `/kundali` styling change. |
| `.kiro/steering/design-guidelines.md` | **Binding** — palette, typography, card/CTA/motion specs. | Any UI work. |
| `.kiro/specs/sector-favorability-analysis/` | The house spec format: numbered `requirements.md` → `design.md` → checkbox `tasks.md`. Governs `sector-scoring-engine.ts`. | Editing sector code, or writing a spec for a new feature. |
| `docs/sections/` (10 files) | Landing sections documented individually — AstroTicker, Hero, FAQ, Testimonials, Footer, SplashScreen, and more. | Editing or reusing a landing section. |
| `TOP_INSIGHTS_UI_ANALYSIS.md` (271) | A section-by-section UI teardown with measured type sizes, colors, spacing. | Writing a UI evaluation — it's the precedent format. |

`README.md` (5 lines) is an untouched Lovable stub — ignore it.
