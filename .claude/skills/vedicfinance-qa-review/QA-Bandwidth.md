# VedicFinance — QA Testing Bandwidth

**Total Estimate:** 3–4 working days (1 QA tester, manual)

> Lives with the `vedicfinance-qa-review` skill that consumes it, not at the repo root — it is
> tooling for reviewers, not product documentation.

---

## Day 1 — Auth & Onboarding

| # | Area | Test Scope | Est. Hours |
|---|------|-----------|------------|
| 1 | Landing Page | All sections render, responsive (mobile/tablet/desktop), CTA routing | 1.5 |
| 2 | Sign-Up Flow | Google OAuth, birth details form, place autocomplete, validation errors | 2 |
| 3 | Sign-In Flow | Existing user login, non-existent account error, tab=signin param | 1.5 |
| 4 | OAuth Edge Cases | Redirect recovery, pending birth data persistence, browser back/forward | 1.5 |
| 5 | Session Management | Sign-out clears all data, no stale data on re-login, guest mode | 1 |

**Day 1 Total: ~7.5 hours**

---

## Day 2 — Payment & Report Generation

| # | Area | Test Scope | Est. Hours |
|---|------|-----------|------------|
| 6 | Payment — Happy Path | ₹99 Zoho widget opens, payment completes, redirect to /kundali | 1.5 |
| 7 | Payment — Edge Cases | Cancel widget, page refresh resume, background tab polling, timeout | 2 |
| 8 | Payment — Guards | Already-paid user skip, PaidRoute protection, direct URL access | 1 |
| 9 | Report Generation | API call succeeds, all 9 insight modules populate with real data | 2 |
| 10 | Data Personalization | 3 different birth profiles produce visibly different scores/archetypes | 1.5 |

**Day 2 Total: ~8 hours**

---

## Day 3 — Kundali Dashboard

| # | Area | Test Scope | Est. Hours |
|---|------|-----------|------------|
| 11 | Earnings Section | Income Growth Timeline, Peak Earning Years, Income Constellation, Salary Windows | 1.5 |
| 12 | Risk Section | Scam Risk panel, Dasha Risk Meter, Loan/EMI/Debt analysis, Financial Risk Summary | 1.5 |
| 13 | Investments Section | Investment Baskets (6 asset classes), Luxury Asset Timing, Best Business Start | 1.5 |
| 14 | Life Path Section | Job vs Business, Foreign Settlement, Inheritance & Weakness | 1 |
| 15 | Sidebar & Navigation | Section scroll highlighting, collapse/expand, mobile hamburger menu | 1 |
| 16 | PDF Export | Download triggers, content completeness, page breaks, both themes | 1 |
| 17 | Theme Switcher | Cosmic → Vedic toggle, all cards render correctly in both themes | 1 |

**Day 3 Total: ~8.5 hours**

---

## Day 4 — AI Chat, Sharing & Misc

| # | Area | Test Scope | Est. Hours |
|---|------|-----------|------------|
| 18 | AI Chat — Widget | Floating bubble opens, send message, receive response, quick suggestions | 1.5 |
| 19 | AI Chat — Full Page | /ai-chat renders, back navigation, theme support, no-birth-data error | 1 |
| 20 | Shareable Kundali | Link generation, /shared/:slug loads without auth, correct data displays | 1.5 |
| 21 | Profile Page | Birth details display, kundali history list, share/copy links | 1 |
| 22 | Admin Panel | Access denied for non-admins (no password any more — server-side `is_admin`), five-section nav + scroll-spy, funnel KPIs match in both places, column sorting, Visitors & IPs, both admin themes, 390px | 2 |
| 23 | Coming Soon Pages | Boost Wealth, Upcoming Features, Business Timing, Vedic Trading placeholders | 0.5 |
| 24 | Cross-Browser | Chrome + Safari (desktop & mobile), responsive breakpoints | 1.5 |

**Day 4 Total: ~9 hours**

---

## Summary

| Day | Focus | Hours |
|-----|-------|-------|
| Day 1 | Auth & Onboarding | 7.5 |
| Day 2 | Payment & Report Generation | 8 |
| Day 3 | Kundali Dashboard (all sections) | 8.5 |
| Day 4 | AI Chat, Sharing & Misc | 9 |
| **Total** | | **~33 hours** |

---

## Notes

- **Test Data:** Minimum 3 birth profiles needed that produce different archetypes (e.g., Cautious Builder, Bold Speculator, Natural Magnate) to validate personalization.
- **Blockers:** Zoho payment widget requires a test/sandbox environment. Google OAuth needs a test account.
- **Reduced Scope (2-day sprint):** Focus on items #1, 2, 6, 9, 10, 11–14, 16, 20 only — covers the revenue-critical path.
- **Automation Potential:** Items #9, 10, 20, 21 are strong candidates for Playwright E2E tests.
- **Already automated (26 Aug 2026):** `npm run test:e2e` covers row 22 in depth and parts of rows 1 and 24 —
  `e2e/admin-panel.spec.ts` (sections, scroll-spy, KPI mirror, both themes, 390px),
  `e2e/admin-table-sort.spec.ts` (sorting across all four tables), and
  `e2e/site-health.spec.ts` (7 routes × 2 viewports for console errors, failed requests and
  undecoded images, plus splash timing). Run it before spending manual hours on those rows.
- **Not automatable today:** rows 6–8 need the Zoho sandbox; anything touching visitor/IP
  analytics needs migration 018 applied and `track-visit` deployed — until then those rows
  cannot pass or fail, only stall.
