# E2E notes

Read this before writing an admin spec. Everything here was learned by a test
failing in a way that pointed at the app when the app was fine.

## It runs against production

There is one Supabase project and `npm run dev` points at it. Hence `workers: 1`,
hence the `QA Probe` / `qa-e2e-*@vedicfinance-qa.invalid` markers on everything these
specs create, and hence: **every fixture must be swept by marker, not by the ids
of the current run.** The run that needs cleaning up is the one that already
died.

A full run is ~20 minutes. A 30s wait can time out under that load, so re-run a
failure in isolation before believing it.

## Two locator traps that cost this suite whole files

Both produce a failure that reads as a broken feature. Neither is.

### 1. The admin cards render a result banner

`InternalTraffic` and `AdminAccess` echo what just happened — *"Added
198.51.100.77/32."*, *"Removed admin access for someone@example.com"* — and the
banner names the same value the row does.

So a card-wide `getByText(value)` matches **twice** (strict-mode failure), and
`toHaveCount(0)` after a delete can **never** reach zero however correctly the
row went away. Three tests failed this way, each taking the rest of its serial
file with it.

Assert the row, not the value:

```ts
// Wrong — also matches "Added 198.51.100.77/32."
await expect(card.getByText(FIXTURE_NETWORK)).toBeVisible();

// Right — the row's own text, or better, its own control
await expect(card.getByText(FIXTURE_NETWORK, { exact: true })).toBeVisible();
await expect(card.getByRole("button", { name: `Remove ${x}` })).toHaveCount(0);
```

### 2. `AdminTable` renders its data twice

A desktop `<table>` **and** a mobile card list, one hidden by CSS. Both are in
the DOM. A container-scoped count is therefore doubled, and comparing it against
`table tbody tr` compares two renderings against one — which reported 70 internal
badges against 60 rows and read as sessions being invented.

Scope both sides to the same rendering:

```ts
const table = panel.locator("table");
const rows = table.locator("tbody tr");
const badges = table.getByText("internal", { exact: true });
```

## Do not assert on whatever traffic production happens to have

The analytics panels show real rows. "The pages table lists /refund-policy" and
"the picker's count differs per device" are claims about the **panel**, but with
no fixture they are really claims about last month's traffic — and they fail on a
quiet month, which is not a defect. Coordinates are a 25% sample kept for 30
days, so a page having none is ordinary.

Seed what the assertion needs: `seedPageViews()`, `seedClickPoints()`. Sweep it
in a `finally` **and** in `afterAll`, and keep the teardown-is-clean test that
sits at the foot of those files.

Watch the guard assertions too. `expect(text).toMatch(/clicks/i)` is satisfied by
the string *"no clicks yet"*, so the check meant to prove there was data passed
on no data and pushed the real failure onto a later line, where it read as two
identical strings not being different.

## Serial files fail loudly and then go quiet

Every admin spec is `test.describe.configure({ mode: "serial" })`. One failure
skips every test after it in that file — reported as *"N did not run"*, which is
easy to read as a scheduling detail rather than as lost coverage. Fixing one
early failure routinely reveals several later ones that have never executed. Read
the "did not run" count as "unknown", not as "fine".

## `isVisible()` does not wait

`locator.isVisible()` answers about the DOM as it stands and returns
immediately. It accepts a `timeout`, which does nothing useful, so this is a
snapshot dressed as a wait:

```ts
// Wrong — resolves microseconds after the click, before any refetch
const appeared = await row.isVisible({ timeout: 15_000 }).catch(() => false);
```

One test used that to decide whether a feature was deployed, and so skipped
itself or ran depending on how the race landed — reporting an undeployed
migration when the truth was that the list had not refetched yet. Use
`waitFor()` (or `expect().toBeVisible()`) when you mean to wait:

```ts
const appeared = await row
  .waitFor({ state: "visible", timeout: 15_000 })
  .then(() => true)
  .catch(() => false);
```

## Fixed sleeps

`waitForTimeout(4000)` in a loop over ten lazy routes spends 40s of a 120s budget
doing nothing and *still* samples the page mid-spinner. Poll for the condition
instead — it is both more reliable and much faster.
