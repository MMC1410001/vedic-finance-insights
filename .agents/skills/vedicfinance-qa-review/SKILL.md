---
name: vedicfinance-qa-review
description: Review a change as a QA engineer — what could break, what needs manual verification, which regression rows apply, what edge cases are unhandled. Use when asked to "QA this", "test plan", "what should I test", "regression", "did this break anything", "verify before release", or before merging to af-prod.
---

# VedicFinance — QA review

You are the QA engineer for VedicFinance. Your job is to find what breaks *for a user*, not what looks wrong in the code.

## Scope

1. Explicit argument (path, `all`, branch) wins.
2. Else `git status --porcelain` non-empty → review the uncommitted diff.
3. Else `git rev-list --count origin/af-prod..HEAD` > 0 → review those commits.
4. Else (clean, on `af-prod`) → say so and ask what to review. Don't audit the whole app unprompted.

**Report only. Never edit files.** Close with: *"Say `fix <n>` to apply any of these."*

## Output

Findings ranked most-severe first. Each: `file:line`, one-line claim, a **concrete reproduction** (steps → expected → actual), severity `blocker / major / minor / nit`. Mark anything **pre-existing** as such — don't blame the current diff for it.

Then a **Manual verification checklist** mapping the change onto the row numbers in `QA-Bandwidth.md`, which sits beside this file.

## The regression checklist already exists

`QA-Bandwidth.md` (in this skill's own directory — it is reviewer tooling, not product docs) is the manual test plan: 24 numbered items across 4 days (~33 hours). **Map changed files onto its rows; don't invent a parallel plan.** Check `npm run test:e2e` first — rows 22 and parts of 1 and 24 are automated, so re-testing them by hand is wasted bandwidth.

| Day | Rows | Area |
|---|---|---|
| 1 | 1–5 | Landing, sign-up, sign-in, OAuth edge cases, session management |
| 2 | 6–10 | Payment happy path, payment edge cases, guards, report generation, personalization |
| 3 | 11–17 | Earnings, risk, investments, life path, sidebar/nav, PDF export, theme switcher |
| 4 | 18–24 | AI chat widget + full page, shared kundali, profile, admin, coming-soon, cross-browser |

The doc names a **revenue-critical subset** for a 2-day sprint: rows 1, 2, 6, 9, 10, 11–14, 16, 20. If time is short, that's the cut. It also flags rows 9, 10, 20, 21 as the best Playwright candidates — relevant once e2e is unblocked.

Blockers it records: the Zoho widget needs a sandbox environment, and Google OAuth needs a test account.

## Automated coverage is nearly nonexistent

Two test files, 9 tests (`example.test.ts` is a placeholder; `sectorMappings.test.ts` is real). **Playwright is broken** — `playwright.config.ts` imports `lovable-agent-playwright-config`, which is not in `package.json`.

So: never let "tests pass" stand as a release verdict. Say plainly which findings are machine-verified and which need a human.

## Repo-specific traps to check every time

- **Sign-out data leak.** `src/lib/auth-context.tsx` clears an explicit list of `sessionStorage` keys on `SIGNED_OUT`. Any new user-scoped cache key that isn't in that list means the next user on the same browser sees the previous user's chart. Test: sign in as A → generate → sign out → sign in as B → check for A's data.
- **Personalization is the product.** Per the QA doc, keep **at least 3 birth profiles** that yield different archetypes (Cautious Builder / Bold Speculator / Natural Magnate). If two profiles render identical scores, that's a blocker, not a nit.
- **Both themes, always.** Any `/kundali` change must be checked in Cosmic *and* Vedic. The Vedic theme is built from `!important` overrides, so it breaks independently of the dark theme.
- **PDF export in both themes** (row 16) — jsPDF + html2canvas rendering diverges from screen; check page breaks and clipped cards.
- **Payment edge cases** (row 7): cancel the widget, refresh mid-payment, background the tab during polling, replay an already-paid user. `has_paid` in `user_profiles` is the source of truth; `useUserStatus` caches it for 30s, so a just-paid user can sit on `/payment` briefly.
- **Guest mode.** `sessionStorage.guestMode === "true"` bypasses `ProtectedRoute` and `PaidRoute` entirely. Verify a feature isn't accidentally relying on it, and that it isn't reachable in production.
- **Shared kundali** (`/shared/:slug`) must load with **no auth** and must not expose anything beyond the intended report.
- **Date-drifting output.** Several engines seed on `new Date()`, so screenshots taken on different days legitimately differ. Don't file that as a bug.

## Known pre-existing issues — reference, don't re-report

No `prefers-reduced-motion` support anywhere. Visitor/IP analytics is written but **not deployed** — `visitor_events` does not exist and `track-visit` 404s, so every page load fires a tracking call that fails and the admin Visitors panel shows dev sample data; nothing downstream of it can be tested. Check whether the diff makes these worse; don't present them as new discoveries.

Two entries here went stale and are now fixed, so do not report them: the admin panel's hardcoded client-side password is gone (access is server-side `is_admin`, verified in the `admin-user-management` edge function), and `src/assets/` is ~6.8 MB rather than 42 MB after the WebP conversion.
