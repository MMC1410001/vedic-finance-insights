---
name: vedicfinance-testing
description: Use when generating, writing, running, or debugging tests, or when asked whether a change is covered or safe. Covers unit-test case generation for engines, pure utilities, hooks, and components. Triggers on "write tests", "generate tests", "add test coverage", "unit test", "test cases", "test", "vitest", "property test", "fast-check", "playwright", "e2e", "coverage", "mock", "Testing Library", "does this break anything".
---

# VedicFinance — testing

## Commands

```bash
npm test                                       # vitest run — single pass
npm run test:watch                             # vitest watch
npx vitest run src/test/sectorMappings.test.ts # single file
npx vitest run -t "structural completeness"    # single case by name
npm run lint                                   # eslint
```

Run under Node 22 (`nvm use` — `.nvmrc` pins it).

**After switching branches, re-run `npm ci`.** Dependencies differ sharply across this repo's branches — `main` has no `fast-check`, `@supabase/supabase-js`, or `astronomy-engine`. A stale `node_modules` shows up as `Failed to resolve import "fast-check"`, which looks like a broken test but is a stale install.

## Config

`vitest.config.ts` is **separate from `vite.config.ts`** — a plugin or alias added to one does not apply to the other. It sets `environment: "jsdom"`, `globals: true`, `setupFiles: ["./src/test/setup.ts"]`, and collects only `src/**/*.{test,spec}.{ts,tsx}`. The `@` → `./src` alias is re-declared there.

`src/test/setup.ts` imports `@testing-library/jest-dom` and stubs `window.matchMedia` (jsdom lacks it, and `use-mobile.tsx` calls it). If a test dies on a missing browser API, extend that file rather than stubbing per-test.

## Reality of current coverage

Two files only:

- `src/test/example.test.ts` — `expect(true).toBe(true)`. A placeholder.
- `src/test/sectorMappings.test.ts` — real property-based tests.

**A green suite proves almost nothing about this app.** Never report "tests pass" as evidence that a change is safe. Say what you actually verified, and if a change is untested, say so.

## Generating unit tests

### Where to put them

Tests live in `src/test/`, named after the module under test: `src/test/<module>.test.ts` (existing files are `example.test.ts`, `sectorMappings.test.ts`). Import the subject by relative path (`../lib/…`) or the `@` alias — both resolve. Use `.tsx` only when rendering components.

`globals: true` is set, so `describe`/`it`/`expect` need no import — but `sectorMappings.test.ts` imports them explicitly from `vitest` anyway. **Match that**: explicit imports, plus `vi` when mocking.

### Pick targets by value, not by coverage percentage

Test in this order:

1. **Pure decision logic with branches** — highest value per line. `resolveDestination` / `getRedirectForRoute` (`src/lib/resolve-destination.ts`) encode the entire funnel in ~8 branches and are trivially testable. `assignFavorabilityLabel` (`src/lib/sector-scoring-engine.ts`) has five boundaries. These are the best first tests in the repo.
2. **Real astronomy** — `vedic-calc.ts` is deterministic for a given instant, so known-chart assertions are meaningful.
3. **Insight engines** — the `compute*` exports in `financial-kundali-engine.ts`, tested for shape and range.
4. **Components** — only where logic is visible in output. Rendering a card to assert it has a `<div>` is noise.

Skip: generated shadcn primitives in `src/components/ui/`, and anything whose only behavior is composing JSX.

### Boundary-first case generation

For a scoring or banding function, generate cases at **every threshold and one either side**, not arbitrary midpoints:

```ts
import { describe, it, expect } from "vitest";
import { assignFavorabilityLabel } from "@/lib/sector-scoring-engine";

describe("assignFavorabilityLabel", () => {
  it.each([
    [100, "Highly Favorable"], [80, "Highly Favorable"], [79, "Favorable"],
    [60, "Favorable"],         [59, "Emerging"],         [40, "Emerging"],
    [39, "Neutral"],           [20, "Neutral"],          [19, "Weak"], [0, "Weak"],
  ])("scores %i as %s", (score, label) => {
    expect(assignFavorabilityLabel(score)).toBe(label);
  });
});
```

For the funnel, enumerate the state space — three booleans, eight combinations — rather than picking a few:

```ts
import { getRedirectForRoute, type UserState } from "@/lib/resolve-destination";

const state = (isAuthenticated: boolean, onboardingDone: boolean, hasPaid: boolean): UserState =>
  ({ isAuthenticated, onboardingDone, hasPaid });

it("sends an onboarded but unpaid user to /payment", () => {
  expect(getRedirectForRoute(state(true, true, false), "paid")).toBe("/payment");
});
it("lets a fully active user through", () => {
  expect(getRedirectForRoute(state(true, true, true), "paid")).toBeNull();
});
```

### Engines — assert invariants, never exact values

`BirthDetails` is `{ name, dateOfBirth, timeOfBirth, placeOfBirth }` (all strings). Build one fixture and reuse it:

```ts
const DETAILS = {
  name: "Test User", dateOfBirth: "1995-03-15",
  timeOfBirth: "06:30", placeOfBirth: "Mumbai",
};
```

Then assert **shape, range, enum membership, and same-input determinism** — never a sampled number, because `rng()` call order is a refactor away from changing:

```ts
it("returns 12 months with scores in range and a known verdict", () => {
  const timeline = generateTimeline(DETAILS);
  expect(timeline).toHaveLength(12);
  for (const m of timeline) {
    expect(m.score).toBeGreaterThanOrEqual(0);
    expect(m.score).toBeLessThanOrEqual(100);
    expect(["growth", "stagnant", "pressure"]).toContain(m.type);
  }
});

it("is deterministic for identical input", () => {
  expect(generateTimeline(DETAILS)).toEqual(generateTimeline(DETAILS));
});

it("differentiates distinct birth details", () => {
  const other = { ...DETAILS, dateOfBirth: "1988-11-02" };
  expect(generateTimeline(other)).not.toEqual(generateTimeline(DETAILS));
});
```

That last one is worth writing everywhere — personalization is the product, and identical output for different users is a blocker-class bug.

Anything date-seeded needs a frozen clock, or it passes today and fails tomorrow:

```ts
beforeEach(() => vi.setSystemTime(new Date("2026-01-15T00:00:00Z")));
afterEach(() => vi.useRealTimers());
```

### Real astronomy — assert with tolerance

`buildVedicChart(input: BirthInput)` takes `{ year, month, day, hour, minute, tzOffset, lat, lon }` and returns `{ jd, ayanamsa, ascendant, planets, houses, dasha }`. Positions are exact for an instant, so compare against a known chart with an arcminute tolerance rather than exact equality:

```ts
expect(chart.planets.find(p => p.name === "Sun")!.siderealLon).toBeCloseTo(331.2, 1);
expect(chart.houses).toHaveLength(12);
for (const p of chart.planets) {
  expect(p.siderealLon).toBeGreaterThanOrEqual(0);
  expect(p.siderealLon).toBeLessThan(360);
  expect(p.house).toBeGreaterThanOrEqual(1);
  expect(p.house).toBeLessThanOrEqual(12);
}
```

Ketu must always sit exactly 180° from Rahu — a good invariant to pin.

### Mocking Supabase for hooks and components

`vi.mock` is hoisted, so declare the mock before importing the subject:

```ts
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { onboarding_done: true, has_paid: false }, error: null }),
    })),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
    functions: { invoke: vi.fn() },
  },
}));
```

Anything using `useUserStatus` needs a `QueryClientProvider` wrapper. Disable retries so failure cases don't hang the test:

```tsx
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
```

Components reading `sessionStorage` (guest mode, `kundliReport`) need it seeded in `beforeEach` and cleared in `afterEach` — jsdom persists it across tests in a file.

**Prefer testing the pure function over the component that calls it.** A `resolve-destination` test covers more real routing logic than a `PaidRoute` render test, with none of the mocking.

### Checklist for a generated test file

- Explicit `vitest` imports; `vi` when mocking
- One shared fixture, not inline literals repeated per case
- Boundaries covered, including either side of each threshold
- Error/empty path covered — Supabase failures return `{ onboardingDone: false, hasPaid: false }`, so fail-closed behavior is testable
- No exact engine values, no snapshots of seeded output
- Timers restored, `sessionStorage` cleared
- Run it before reporting: `npx vitest run src/test/<file>.test.ts`

## Property-based tests are the house style

`fast-check` is a devDependency. `sectorMappings.test.ts` is the reference: it imports `* as fc from "fast-check"`, pins the valid domains (9 `PlanetName`s, 7 `SectorId`s), and asserts structural invariants over the whole mapping table rather than example rows.

Its describe/it blocks cite the governing spec — e.g. `Property 3: sectorMappings Structural Completeness / Validates: Requirements 2.2, 2.3, 2.4`, pointing at `.kiro/specs/sector-favorability-analysis/requirements.md`. **Follow that convention** when testing spec-governed code: name the property and cite the requirement.

Good candidates for property tests here: score ranges stay within bounds, every label maps to exactly one band, normalization preserves ordering, chart houses stay in 1–12, longitudes stay in [0, 360).

## Testing the engines — two traps

1. **Seeded engines drift by date.** `astro-engine.ts`, `bonds-engine.ts`, `risk-engine.ts`, `investment-engine.ts` and `kundali-engine.ts` mix `new Date()` into seeds and outputs. Snapshot tests against them fail tomorrow. Assert invariants (ranges, enum membership, array lengths, determinism *within* a fixed clock) instead. If you need a fixed clock, use `vi.setSystemTime`.
2. **`rng()` call order is the contract.** A test that pins exact generated values will break on any harmless refactor. Test shape, not sampled numbers.

For real astronomy (`vedic-calc.ts`) the opposite holds: positions are deterministic for a given instant, so known-chart assertions with a tolerance (arcminutes) are appropriate and valuable.

## Mocking Supabase

There is no test project, seeded database, or MSW setup. Anything touching `src/lib/supabase.ts`, `vedicfinance-api.ts`, `payment-api.ts`, or `kundali-history.ts` must be mocked with `vi.mock`. Guards (`ProtectedRoute`, `PaidRoute`) and `useUserStatus` need a `QueryClientProvider` wrapper plus a mocked `useAuth`. Prefer testing `resolveDestination` / `getRedirectForRoute` directly — they are pure and hold the actual routing logic.

## Playwright is broken as committed

`playwright.config.ts` and `playwright-fixture.ts` import `lovable-agent-playwright-config`, which is **not in `package.json`**. `npx playwright test` fails at config load, and browsers aren't installed (`npx playwright install`, ~500 MB).

`.playwright-mcp/` holds screenshots, PDFs, and YAML from MCP-driven browser sessions — artifacts, not a test suite.

Don't propose e2e tests without first resolving that dependency, and flag it rather than silently rewriting the config.

## `npm run lint` is not a gate

It reports errors (`no-explicit-any`, empty interfaces in generated shadcn files, `require()` in `tailwind.config.ts`) while **exiting 0**. Read its output; don't rely on the exit code. Check whether you added *new* violations rather than demanding a clean run.
