---
name: vedicfinance-tech-lead-review
description: Senior tech-lead code review — correctness, layering, reuse, naming, error handling, and this repo's specific architectural contracts. Use for "code review", "review my changes", "is this the right approach", "refactor", "clean this up", "tech debt", "before I open a PR", or when asked to review as a senior/lead engineer.
---

# VedicFinance — tech lead review

Review as the engineer accountable for this codebase long-term. Judge correctness and fit against existing patterns, not personal style.

## Scope

1. Explicit argument wins.
2. Else uncommitted diff.
3. Else commits ahead of `origin/af-prod`.
4. Else clean on `af-prod` → ask what to review.

**Report only. Never edit files.** Close with: *"Say `fix <n>` to apply any of these."*

## Output

Ranked most-severe first. Each: `file:line`, one-line claim, a **concrete failure scenario** (inputs/state → wrong output), severity `blocker / major / minor / nit`, fix sketch. Mark **pre-existing** issues as such. Say plainly when a diff is fine — don't manufacture findings.

## The compiler is not helping you

`tsconfig.app.json` sets `strict: false`, `noImplicitAny: false`, `noUnusedLocals: false`; root `tsconfig.json` adds `strictNullChecks: false`. ESLint sets `@typescript-eslint/no-unused-vars: "off"`, and `npm run lint` **exits 0 while reporting errors**.

Consequence: **null/undefined bugs and implicit `any` are invisible to tooling — review must catch them by hand.** Give real weight to:

- Values that can be `null`/`undefined` at runtime — `session?.user`, `data` from a Supabase `.single()`, `sessionStorage.getItem`, optional chart fields — used without a guard.
- `any` (explicit or inferred) crossing a module boundary, especially in `src/lib/`.
- Array access assumed non-empty; `JSON.parse` on possibly-absent storage without a try/catch.

Don't demand a clean `npm run lint`; check whether the diff adds *new* violations.

## Architectural contracts

Violations here are `major` even when the code works:

**Layering.** Logic lives in `src/lib/`; components render. A component computing scores, building prompts, or querying Supabase directly is misplaced. Insight computation belongs in `financial-kundali-engine.ts` as a `compute*` export, paired with a card in `src/components/financial-kundali/`.

**Single entry points.**
- Edge-function calls → `vedicfinance-api.ts`, `payment-api.ts`, `kundali-history.ts`. Never `supabase.functions.invoke` from a component.
- Redirects → `resolveDestination()` / `getRedirectForRoute()` in `src/lib/resolve-destination.ts`. A hand-rolled `<Navigate>` chain is a bug in waiting.
- One Supabase client — `src/lib/supabase.ts`.

**The mirrored astro code.** `src/lib/vedic-calc.ts` and `supabase/functions/generate-report/{astro,engine}.ts` are independent implementations of the same math (Deno can't import from `src/`). A change to one without the other silently desyncs client and server output. Always ask whether the diff mirrored it.

**The `rng()` call-order contract.** In the seeded engines (`astro-engine.ts`, `kundali-engine.ts`, `bonds-engine.ts`, `risk-engine.ts`, `investment-engine.ts`), inserting or reordering an `rng()` call rewrites every downstream value — a user's chart changes for no reason. New values go at the end of a function or use a fresh seed.

**The frozen Cosmic theme.** Per `.kiro/steering/theme-rules.md`, dark-theme styles on `/kundali` must not change; Vedic overrides scope under `.vedic-theme`. Inline styles in `src/components/financial-kundali/` are off-limits.

**Sign-out cache list.** New user-scoped storage keys must be registered in the `SIGNED_OUT` handler of `auth-context.tsx`, or data leaks between accounts.

**Route laziness.** New routes in `src/App.tsx` must be `React.lazy`; only `Index` and `Landing` are eager.

## Reuse before adding

Check the diff didn't reimplement something that exists:

- Storage/query: `report-store.ts`, `feedback-store.ts`, `useUserStatus`, `kundali-history.ts`
- Astrology: `vedic-calc.ts` (real), the seeded engines (mock), `sector-scoring-engine.ts`, `explanation-builder.ts` for prose
- UI: 63 shadcn primitives in `src/components/ui/`, `cn()` in `src/lib/utils.ts`, existing Tailwind tokens (`gold`, `signal-*`) and animations
- Edge functions: `_shared/{cors,get-report,vedic-helpers,zoho}.ts`

## Size and complexity smells

Current baselines — flag meaningful growth, and prefer extraction over appending:

| File | Lines |
|---|---|
| `src/index.css` | 1711 |
| `src/lib/financial-kundali-engine.ts` | 1629 |

`console.log` in `src/` is currently **4 occurrences in 2 files** — three in `src/lib/zoho-payments.ts` (which log `sessionId`, `orderId`, and the full widget result) and one in `src/lib/test-user.ts`. The payment ones log transaction identifiers to the browser console in production; worth flagging as pre-existing. Treat 4 as the ceiling — new debug logging in a diff is a finding.

## What not to flag

- Date-dependent output from the seeded engines — deliberate.
- Synchronous `sessionStorage` hydration in `report-store.ts` — deliberate, prevents skeleton flash.
- Generated shadcn files in `src/components/ui/` having empty interfaces or odd exports — regenerate territory, not hand-fix.
- `bun.lock` / `bun.lockb` — stale, npm is the package manager.
