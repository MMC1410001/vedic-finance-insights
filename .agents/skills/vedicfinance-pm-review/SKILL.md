---
name: vedicfinance-pm-review
description: Review a change as a product manager — does it match the committed scope, does it contradict a customer-facing claim, is it specced, does it move the funnel. Use for "product review", "PM review", "does this match the spec", "is this in scope", "should we build this", "PRFAQ", "requirements", "write a spec", or when planning a new feature.
---

# VedicFinance — product review

Review as the PM accountable for what VedicFinance promises publicly. The core question is not "is this coded well" but **"does this match what we told users we do, and does it move the funnel?"**

## Scope

1. Explicit argument wins.
2. Else uncommitted diff.
3. Else commits ahead of `origin/af-prod`.
4. Else clean on `af-prod` → ask what to review, or what feature to spec.

**Report only. Never edit files.** Close with: *"Say `fix <n>` to apply any of these."*

## Output

Ranked by user/business impact. Each finding: what changed, which document or requirement it affects, the risk, severity `blocker / major / minor / nit`. Mark **pre-existing** drift as such. Separate **"contradicts a shipped claim"** (serious) from **"undocumented"** (fixable by writing it down).

## The product documents

| Doc | Role |
|---|---|
| `PRFAQ.md` | Customer-facing positioning, v2.0, prepared by Preet, reviewed by Rushi. The strongest claims live here. |
| `FEATURES.md` | Feature + architecture reference — the seven financial scores, engines, UI modules |
| `VedicFinance-Strategic-Note.md` | Strategy and market framing |
| `PAYMENT_INTEGRATION.md`, `ZOHO_PAYMENT_INTEGRATION_GUIDE.md` | The ₹99 one-time flow |
| `PLAN-admin-user-management.md` | Admin scope |
| `QA-Bandwidth.md` (in `vedicfinance-qa-review/`) | Release cost — ~33 hours manual QA per full pass |
| `docs/sections/` | Landing sections, section by section |

## Standing drift #1 — the ephemeris claim (pre-existing, unresolved)

`PRFAQ.md` and `FEATURES.md` both state the platform computes charts with the **Swiss Ephemeris (`pyswisseph`)** and a **Placidus house system**.

Neither exists in this repo. There is no `swisseph` dependency anywhere. The code uses **`astronomy-engine`** (`src/lib/vedic-calc.ts`) with Lahiri ayanamsa, and houses derived by sign (`houseFromSign` in `supabase/functions/generate-report/astro.ts`), not Placidus.

This is a **customer-facing accuracy claim in an approved PRFAQ that the product does not implement.** It is the standing example of doc-vs-code drift, and the question it raises applies to every change: *does this alter something a public document promises?* Either the docs get corrected or the implementation changes — that's a product decision, not an engineering one.

## Claims to protect

- **Determinism and traceability.** The PRFAQ promises "deterministic," "fully traceable," "no hallucination," with a rule-fire log explaining each score. Any change adding unexplained randomness, or an insight users can't trace to a rule, contradicts the core pitch. Note several engines seed on `new Date()`, so output legitimately shifts day to day — worth deciding whether "deterministic" survives that.
- **Grounded AI.** The chat advisor is claimed to be grounded strictly in computed chart data. The `chat` edge function's system prompt enforces this. Changes that let the model free-associate break a headline promise.
- **No financial advice.** Hard rule, enforced in the chat prompt and the sector spec: **no specific stock, security, or crypto recommendations; no exact monetary predictions.** In India this is regulatory exposure, not just tone. Treat a violation as `blocker`.
- **₹99 one-time.** Pricing and the single paid unlock (`/kundali`) are load-bearing across PRFAQ, payment docs, and QA. Changes to what's free vs paid need explicit sign-off — check `PaidRoute` coverage and the free/locked split on the landing page.
- **Seven scores.** `FEATURES.md` enumerates them (Natal Wealth, Income, Savings, Investment, Risk, Expense, Timing). Adding or renaming one is a documentation change too.

## New features follow the spec format

`.kiro/specs/sector-favorability-analysis/` is the house pattern — copy its structure:

1. `requirements.md` — introduction, a **glossary** of domain terms, numbered requirements (`2.1`, `2.2`, …)
2. `design.md` — the layered approach (config file → deterministic engine → explanation builder → UI components → page)
3. `tasks.md` — checkbox tasks, each citing `_Requirements: 2.1, 2.2_`, with optional `*`-marked test tasks naming the property under test

Tests then cite those requirement numbers (`src/test/sectorMappings.test.ts`). If a feature is being built without this, flag it — the format is what makes the "traceable" claim real.

## Funnel

`/` (intro + landing) → `/auth` (sign-in + birth details) → `/payment` (₹99) → `/kundali`. `resolveDestination()` in `src/lib/resolve-destination.ts` encodes it; `useUserStatus` supplies `{ isAuthenticated, onboardingDone, hasPaid }`.

Ask of any funnel change: does it add a step before value is shown, change what's visible pre-payment, or alter where a CTA lands? `/shared/:slug` is the public sharing loop and the main organic acquisition surface — protect it.

Placeholders currently routed to `ComingSoon`: `/business-timing`, `/vedic-trading`, `/chat`, plus `/boost-wealth` and `/upcoming-features`. Shipping one means the marketing surface promising it should be checked too.

## Cost of a change

Every user-visible change adds manual QA — `QA-Bandwidth.md` (in the `vedicfinance-qa-review` skill directory) prices a full pass at ~33 hours, with a revenue-critical 2-day subset. Automated coverage now offsets part of that: 14 Vitest files and 4 working Playwright specs, which between them cover row 22 and parts of rows 1 and 24. Say which QA day(s) a change re-triggers, and whether `npm run test:e2e` already covers them.
