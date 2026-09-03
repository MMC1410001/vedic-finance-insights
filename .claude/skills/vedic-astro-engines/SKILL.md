---
name: vedic-astro-engines
description: Use when working on astrology or financial-insight computation — natal charts, planetary longitudes, ayanamsa, nakshatras, dashas, transits, house/sign logic, sector favorability, or any engine in src/lib that produces scores, timelines, or forecasts. Triggers on "kundali", "chart", "planet", "graha", "dasha", "nakshatra", "lagna", "ascendant", "transit", "ayanamsa", "sidereal", "navamsa", "D9", "sector", "score", "forecast", "timeline", "astronomy-engine".
---

# VedicFinance — Vedic astro & scoring engines

> **Standing rule — the kundli generation math is off-limits** unless the user explicitly asks to change it. That covers ayanamsa, sidereal conversion, longitudes, Rahu/Ketu, ascendant, nakshatra, house derivation, dasha sequence/durations, dignity tables, and `rng()` call order. Types, comments, formatting, and tests are fine. If you think the math is wrong, **report it and stop** — don't fix it inside another task. Full statement in `CLAUDE.md` → "Do not touch the kundli generation algorithm".

There are **two unrelated tiers of astrology code** in this repo. Confusing them produces either fake precision or broken determinism. Identify which tier you're in before editing.

## Tier 1 — real astronomy (`src/lib/vedic-calc.ts`)

Genuine sub-arcminute planetary positions via `astronomy-engine`. Tropical longitudes converted to sidereal by subtracting **Lahiri (Chitrapaksha) ayanamsa**.

Public surface: `toJulianDay`, `ayanamsa` / `lahiriAyanamsa`, per-body `*Longitude()` functions (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, `rahuLongitude`), `ascendantLongitude(jd, lat, lon)`, `getNakshatra(sidLon)`, `signFromLon`, `computeDasha(moonSidLon, birthDate)`, and the top-level `buildVedicChart(input: BirthInput): VedicChart`. Constants `ZODIAC_SIGNS` and `SIGN_LORDS` live here.

Rules:
- Ketu is always Rahu + 180°. Don't compute it independently.
- Everything downstream expects **sidereal** longitudes. Passing a tropical value silently shifts every planet by ~24° — roughly one sign, so results look plausible while being wrong.
- Ascendant needs latitude/longitude and true UT. `src/components/vedicfinance/LocationSearch.tsx` is how birth place becomes coordinates; don't default them to 0.
- `business-timing-engine.ts` and `daily-trading-engine.ts` also build on `astronomy-engine` — real math, same rules.

### The server copy is duplicated, not shared

`supabase/functions/generate-report/astro.ts` and `engine.ts` are a **Deno reimplementation** of the same astronomy and scoring (exaltation/debilitation/own-sign tables, dasha sequence, chart builder). Deno edge functions cannot import from `src/`.

Any change to chart construction, dasha, or scoring must be **mirrored in both places**, or the report the server generates will disagree with what the client renders for the same birth details. When you touch one, say explicitly in your summary whether you mirrored it.

## Tier 2 — seeded mock engines

`astro-engine.ts`, `kundali-engine.ts`, `bonds-engine.ts`, `risk-engine.ts`, `investment-engine.ts` are **mock data generators** — `astro-engine.ts` says so on line 1. `sector-scoring-engine.ts` uses the same seeding to derive its chart input.

The pattern: `hashString(<concatenated birth fields>)` seeds a `seededRandom` LCG, and every field is pulled from that stream in order.

**The determinism contract — `rng()` call order is part of the API.** Inserting, removing, or reordering a single `rng()` call changes every value produced after it in that function. A user's "chart" changes under them for no visible reason. If you must add a value, append it at the end of the function, or derive it from a fresh seed.

Second trap: several generators mix `new Date()` into the seed or output (`generateRecommendation` seeds on `new Date().toDateString()`; timelines anchor to the current month). Output therefore **drifts daily**. Don't write snapshot tests against them, and don't promise users a stable number.

Shared vocabulary lives in `astro-engine.ts`: the `BirthDetails` type and the `"favorable" | "neutral" | "challenging"` impact union that other engines and the `signal-*` Tailwind colors both key off.

## Insight engines

`financial-kundali-engine.ts` (~1600 lines) turns `ChartData` + `ReportScores` into the `/kundali` page content: `computeMoneyArchetype`, `computeYearForecast`, `computeCareerInsights`, `computeLoanInsights`, `computeWealthTimeline`, `computeExpenseInsights`, `computeInvestmentPersonality`, `computeJobVsBusiness`, `computeForeignSettlement`. Each maps 1:1 to a component in `src/components/financial-kundali/`. Add a new insight as a `compute*` export here plus its card — don't compute inside the component.

`explanation-builder.ts` produces the human-readable text. Keep prose generation there, out of the scoring engines.

## Sector favorability — spec-governed

`sector-scoring-engine.ts` + `sectorMappings.ts` (7 sectors × 9 planets) implement a written spec: `.kiro/specs/sector-favorability-analysis/{requirements,design,tasks}.md`.

**Read the spec before changing either file.** It fixes the glossary (Atmakaraka, Amatyakaraka, D9 confirmation, Primary/Secondary/Income/Active sector), the pipeline (`deriveChartInput` → `scoreSectors` → `normalizeSectors` → `identifyOutputSectors` → `computeSectorFavorability`), and the five `FavorabilityLabel` values. `src/test/sectorMappings.test.ts` cites its requirement numbers.

## Product constraint

Never emit specific stock, security, or crypto recommendations, or exact monetary predictions. This is enforced in the `chat` edge function's system prompt and stated in the sector spec — hold the same line in any new engine or copy.
