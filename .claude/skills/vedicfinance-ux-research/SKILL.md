---
name: vedicfinance-ux-research
description: Review a change as a UI/UX user researcher — comprehension, accessibility, information hierarchy, first-time-user experience, and what real feedback data says. Use for "UX review", "user research", "is this usable", "accessibility", "a11y", "confusing", "user testing", "heuristic evaluation", "does this make sense to users", or when designing a new screen or section.
---

# VedicFinance — UX research review

Review as a user researcher, not a visual designer. The question is whether a **finance-first user with no Vedic astrology background** understands what they're looking at and trusts it. Aesthetic critique belongs in `vedicfinance-ui-theming`.

## Scope

1. Explicit argument wins.
2. Else uncommitted diff.
3. Else commits ahead of `origin/af-prod`.
4. Else clean on `af-prod` → ask which screen or flow to evaluate.

**Report only. Never edit files.** Close with: *"Say `fix <n>` to apply any of these."*

## Output

Ranked by how many users hit it × severity of confusion. Each: `file:line` or screen name, the claim, the **user impact** ("a first-time user cannot tell whether…"), severity `blocker / major / minor / nit`, and a suggested change. Mark **pre-existing** issues as such.

## Use the real feedback data first

**VedicFinance already collects per-card user feedback.** Read it before speculating:

- `src/lib/feedback-store.ts` — Zustand store, `submitVote(cardId, "up" | "down")` and `submitComment(cardId, comment)`
- `src/components/financial-kundali/CardFeedback.tsx`, `FeedbackPanel.tsx` — the in-product widgets
- `supabase/migrations/006_card_feedback.sql` — table `card_feedback` (`user_id`, `card_id`, `vote`, `comment`, `created_at`)

Cards with a poor up/down ratio, or repeated comments, are evidence. Prefer "the `scam-risk` card has N down-votes and these comments" over an unevidenced heuristic opinion. If credentials aren't available to query, say so rather than inventing numbers.

## Standing gap #1 — motion accessibility (pre-existing)

`src/index.css` is 1711 lines and contains **zero `prefers-reduced-motion` handling**, while the app runs: `ticker-scroll` (55s infinite marquee), `twinkle`, `float-slow`, `pulse-glow`, `fade-up`, a full-screen opening animation (`src/pages/SplashScreen.tsx` on `af-prod`; `src/components/intro/` on `intro-trial-preet`), WebGL shader backgrounds, particle starfields, and auto-scrolling testimonial rows.

For users with vestibular disorders this is nausea-inducing, and continuous marquees are a WCAG 2.2.2 concern (moving content over 5s needs a pause mechanism). **Any diff adding animation without a `prefers-reduced-motion` guard is a `major` finding.**

The fix pattern is a single media block disabling or shortening animations — report it; don't write it.

## Accessibility checks

- **Alt text**: currently 55 `<img>` tags against 54 `alt=` occurrences — near-complete but not exact. Decorative images should carry `alt=""`, not be omitted. Zodiac/planet imagery carrying meaning needs real descriptions.
- **Keyboard**: the kundali sidebar (`src/components/kundali/KundaliSidebar.tsx`) drives section navigation — verify tab order, visible focus, and that scroll-spy state doesn't trap focus. Custom `<button>`-styled `<div>`s are a recurring risk.
- **Contrast**: the Vedic (light) theme is built from `!important` overrides layered onto a dark design (`src/index.css`, `.vedic-theme`). Light-on-light regressions are structurally easy — check text, muted labels, and chart axis colors in **both** themes.
- **Charts**: Recharts output needs a text equivalent. A score conveyed only by color fails for color-blind users — check for a number or label alongside `signal-positive/neutral/caution` coloring.
- **Forms**: birth details (`src/components/vedicfinance/BirthDetailsForm.tsx`, `LocationSearch.tsx`) — labels tied to inputs, errors announced, and the place-autocomplete usable by keyboard.

## Comprehension — the core risk

The product speaks Vedic (Mahadasha, Antardasha, Nakshatra, Lagna, Dhana Yoga, Atmakaraka, D9/Navamsa) to an audience that came for money. For each new term ask: is it defined in place, or does the user have to already know it?

`src/components/kundali/InsightInfoTooltip.tsx` is the existing in-place explanation mechanism — reuse it rather than adding glossaries.

Also check:
- **Trust and traceability.** The product's pitch is explainable, traceable insight. If a card shows a score with no visible reasoning path, that undermines the pitch — `explanation-builder.ts` and `ReasoningAccordion.tsx` exist for this.
- **Confidence communication.** `ConfidencePanel.tsx` / `InsightConfidence.tsx` express certainty. A prediction shown without its confidence reads as a promise.
- **No-data and error states.** What does a card render before the report resolves, or when generation fails? Empty cosmic cards look broken rather than loading.
- **Skepticism.** Many users arrive doubtful. Hedging language, disclaimers, and the absence of specific stock picks are product-critical, not legal boilerplate.

## First-time experience

The path is intro animation → landing → auth + birth details → ₹99 payment → kundali. Evaluate: how long before the user sees *any* personalized value; whether the intro animation is skippable; whether the locked/unlocked card split (`LockedCards.tsx` / `UnlockedCards.tsx`) makes the paid value legible; whether birth-time precision is explained (users often don't know their exact birth time — `birth_time_accuracy` exists in `user_profiles`, so check the UI surfaces that honestly).

## Precedent formats

`TOP_INSIGHTS_UI_ANALYSIS.md` is the house teardown format (section-by-section, with measured type sizes, colors, spacing). `docs/sections/01-…08-` document individual landing sections. Match that structure when writing a full evaluation.
