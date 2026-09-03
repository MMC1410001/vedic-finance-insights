/**
 * Column sorting across the /admin tables.
 *
 * The unit tests (src/test/tableSort.test.tsx) cover the comparator against a
 * three-row fixture. What they cannot cover is the thing that actually matters
 * to an operator: that after sorting, the row you click is still the row that
 * gets acted on. That assertion needs the real table, real data volume, and a
 * real click.
 *
 * The Visitors & IPs table runs on the dev mock here, because migration 018 is
 * not applied and visitor_events does not exist. That is fine for sorting — the
 * mechanism under test is the ordering, not the provenance of the rows — but it
 * means this file proves nothing about the server side of that feature.
 *
 * Writes to the PRODUCTION project; admin goes on this file's own user only.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { createTestUser, setAdmin, cleanup, type TestUser } from "./helpers/supabase-admin";
import { signInHeadless, applySession } from "./helpers/session";

let adminUser: TestUser;
let plainUser: TestUser;
let adminSession: unknown;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  adminUser = await createTestUser("sort-admin");
  plainUser = await createTestUser("sort-plain");
  adminSession = await signInHeadless(adminUser);
  await setAdmin(adminUser.id, true);
  // A profile row with is_admin false, so this account shows up in list-users
  // and gives the row-identity test a row it is safe to open a dialog on.
  await setAdmin(plainUser.id, false);
});

test.afterAll(async () => {
  await cleanup([adminUser?.id, plainUser?.id].filter(Boolean) as string[]);
});

async function openAdmin(browser: import("@playwright/test").Browser, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await applySession(context, adminSession);
  const page = await context.newPage();
  await page.goto("/admin");
  await expect(page.locator("#admin-users")).toBeVisible({ timeout: 30_000 });
  // The section anchor exists immediately; the table does not. Until list-users
  // resolves the section reads "Loading users..." with no <table> at all, which
  // silently tripped every row guard in this file and skipped the assertions.
  await waitForRows(page.locator("#admin-users"));
  return { context, page };
}

/** Block until a section has actually rendered data rows. */
async function waitForRows(scope: Locator, min = 1) {
  await expect
    .poll(async () => rowCount(scope), {
      timeout: 45_000,
      message: "table never rendered any rows",
    })
    .toBeGreaterThanOrEqual(min);
}

/** The desktop table inside a section (the mobile card stack is a sibling). */
const deskTable = (scope: Locator) => scope.locator("table").first();

/** Header sort button by label, scoped to one table. */
const header = (scope: Locator, label: string) =>
  deskTable(scope).locator("thead button").filter({ hasText: label }).first();

/** One column's cells, top to bottom, skipping any colspan expansion row. */
async function column(scope: Locator, index: number): Promise<string[]> {
  return scope.evaluate(
    (root, i) =>
      [...root.querySelectorAll("table")][0]
        ? [...[...root.querySelectorAll("table")][0].querySelectorAll("tbody > tr")]
            .filter((tr) => tr.children.length > 2)
            .map((tr) => (tr.children[i as number]?.textContent ?? "").trim())
        : [],
    index,
  );
}

/** Count of data rows currently rendered. */
async function rowCount(scope: Locator) {
  return (await column(scope, 0)).length;
}

const users = (page: Page) => page.locator("#admin-users");
const visitors = (page: Page) => page.getByTestId("visitor-sessions");

/** Non-blank values only — the em-dash placeholder is not data. */
const real = (xs: string[]) => xs.filter((x) => x && x !== "—");
const blanksAtEnd = (xs: string[]) => {
  const firstBlank = xs.findIndex((x) => !x || x === "—");
  if (firstBlank === -1) return true;
  return xs.slice(firstBlank).every((x) => !x || x === "—");
};

test("Users → Email cycles asc, desc, then back to the server order", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const scope = users(page);
  const original = await column(scope, 1);

  await header(scope, "Email").click();
  const asc = await column(scope, 1);
  expect(real(asc)).toEqual([...real(asc)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })));

  await header(scope, "Email").click();
  const desc = await column(scope, 1);
  expect(real(desc)).toEqual([...real(asc)].reverse());

  // The third click is the one that is easy to get wrong, and the reason the
  // hook returns null rather than toggling forever: rows arrive newest-first and
  // there must be a way back to that.
  await header(scope, "Email").click();
  expect(await column(scope, 1)).toEqual(original);
  await context.close();
});

test("blanks sort last in BOTH directions, not floated to the top", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);

  // The regression: negating an ascending comparator for descending negates the
  // blank rule with it. An account with no email is absent, not "greater than"
  // every email.
  for (const [label, idx] of [["Email", 1], ["Username", 2]] as const) {
    const scope = users(page);
    await header(scope, label).click();
    expect(blanksAtEnd(await column(scope, idx)), `Users/${label} ascending`).toBe(true);
    await header(scope, label).click();
    expect(blanksAtEnd(await column(scope, idx)), `Users/${label} descending`).toBe(true);
    await header(scope, label).click(); // reset
  }
  await context.close();
});

test("Visitors → IP orders numerically, not lexically", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const scope = visitors(page);
  await expect(deskTable(scope)).toBeVisible({ timeout: 30_000 });
  await waitForRows(scope, 3);

  await header(scope, "IP").click();
  const asc = real(await column(scope, 1)).map((s) => s.replace(/\s*\+\d+$/, ""));

  // Lexical order puts .63 before .9 because "6" < "9". Compare against a
  // genuine numeric ordering of the same values.
  const numeric = [...asc].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
  expect(asc).toEqual(numeric);

  const lexical = [...asc].sort();
  if (JSON.stringify(numeric) !== JSON.stringify(lexical)) {
    // Only meaningful when the two orders actually differ for this data.
    expect(asc).not.toEqual(lexical);
  }
  await context.close();
});

test("Users → Stage orders by funnel position, not alphabetically", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const scope = users(page);
  const RANK: Record<string, number> = { Onboarding: 0, "Awaiting Payment": 1, Active: 2 };

  // descFirst, so one click puts the furthest-along accounts on top.
  await header(scope, "Stage").click();
  const ranks = (await column(scope, 3)).map((s) => RANK[s]);
  expect(ranks.every((r) => r !== undefined), "unrecognised stage label").toBe(true);
  for (let i = 1; i < ranks.length; i++) {
    expect(ranks[i], `stage order broke at row ${i + 1}`).toBeLessThanOrEqual(ranks[i - 1]);
  }
  // Alphabetically this would be Active → Awaiting Payment → Onboarding, i.e.
  // progress running backwards. Descending-by-rank must start at Active.
  expect(RANK[(await column(scope, 3))[0]]).toBe(2);
  await context.close();
});

test("# renumbers to the visible order, and stays unsortable", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const scope = users(page);
  await header(scope, "Email").click();
  const nums = await column(scope, 0);
  expect(nums.slice(0, 5)).toEqual(["1", "2", "3", "4", "5"]);

  const ths = await deskTable(scope).evaluate((t) =>
    [...t.querySelectorAll("th")].map((th) => ({
      text: (th.textContent ?? "").trim(),
      hasButton: !!th.querySelector("button"),
      ariaSort: th.getAttribute("aria-sort"),
    })),
  );
  const num = ths.find((t) => t.text === "#")!;
  const action = ths.find((t) => t.text === "Action")!;
  expect(num.hasButton, "# should not be sortable").toBe(false);
  expect(num.ariaSort).toBeNull();
  expect(action.hasButton, "Action should not be sortable").toBe(false);
  await context.close();
});

test("aria-sort tracks the three states", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const scope = users(page);

  const state = () =>
    deskTable(scope).evaluate(
      (t) => [...t.querySelectorAll("th")].find((th) => th.textContent?.trim().startsWith("Created"))?.getAttribute("aria-sort"),
    );

  expect(await state()).toBe("none");
  await header(scope, "Created").click();
  // Created is descFirst — newest first is the useful end.
  expect(await state()).toBe("descending");
  await header(scope, "Created").click();
  expect(await state()).toBe("ascending");
  await header(scope, "Created").click();
  expect(await state()).toBe("none");
  await context.close();
});

test("after sorting, a row action still targets the row that was clicked", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const scope = users(page);

  // Find this file's own throwaway account, sort the table around it, then open
  // its delete dialog and check the dialog names it. A sort that scrambled row
  // identity would delete somebody else's account — the worst defect this
  // feature could have, and nothing else covers it.
  await header(scope, "Created").click(); // newest first; the QA user is newest
  await scope.getByPlaceholder("Search by name or email...").fill(plainUser.email);
  await page.waitForTimeout(400);

  const row = deskTable(scope).locator("tr", { hasText: plainUser.email });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Delete Account" }).click();

  const dialog = page.locator("div", { hasText: "This will permanently delete this user" }).last();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(plainUser.email, { exact: false })).toBeVisible();

  // Cancel. The account is removed by afterAll, not by exercising the delete
  // path against production here.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("This will permanently delete this user")).toHaveCount(0);
  await context.close();
});

test("sort survives a filter change and the footer count stays honest", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const scope = visitors(page);
  await expect(deskTable(scope)).toBeVisible({ timeout: 30_000 });
  await waitForRows(scope, 3);

  await header(scope, "Events").click(); // descFirst → most events first
  const before = (await column(scope, 5)).map(Number);
  for (let i = 1; i < before.length; i++) expect(before[i]).toBeLessThanOrEqual(before[i - 1]);

  await scope.getByRole("button", { name: "Guest (No Account)" }).click();
  await page.waitForTimeout(300);

  const after = (await column(scope, 5)).map(Number);
  for (let i = 1; i < after.length; i++) {
    expect(after[i], "sort lost after filtering").toBeLessThanOrEqual(after[i - 1]);
  }

  const footer = await scope.getByText(/Showing \d+ of \d+ sessions/).textContent();
  const [, shown] = footer!.match(/Showing (\d+) of (\d+)/)!;
  expect(Number(shown), "footer disagrees with the rendered rows").toBe(after.length);
  await context.close();
});

test("mobile: every table offers a usable sort picker with no bare-index labels", async ({ browser }) => {
  const { context, page } = await openAdmin(browser, 390);
  await expect
    .poll(async () => page.locator('select[aria-label="Sort column"]').filter({ visible: true }).count(), { timeout: 45_000 })
    .toBeGreaterThan(0);

  const selects = page.locator('select[aria-label="Sort column"]').filter({ visible: true });
  const n = await selects.count();
  expect(n, "no mobile sort control rendered").toBeGreaterThan(0);

  for (let i = 0; i < n; i++) {
    const opts = await selects.nth(i).locator("option").evaluateAll((os) => os.map((o) => o.textContent ?? ""));
    expect(opts[0], `select ${i}`).toBe("Default order");
    expect(opts.length, `select ${i} has no sortable columns`).toBeGreaterThan(1);
    // A JSX-labelled column with no `sortLabel` falls back to its column index,
    // so an option reading "5" is a real defect rather than a label.
    for (const o of opts.slice(1)) {
      expect(o, `select ${i} option is a bare index`).not.toMatch(/^\d+$/);
      expect(o.trim().length, `select ${i} empty option`).toBeGreaterThan(0);
    }
  }
  await context.close();
});

test("mobile: the direction button is inert until a column is chosen", async ({ browser }) => {
  const { context, page } = await openAdmin(browser, 390);

  // Scoped to Users rather than the first select on the page. The Analytics
  // section's tables ship with a defaultSort (most-viewed first, most-clicked
  // first), so their direction button is correctly enabled on arrival and this
  // test's premise — "nothing is sorted yet" — does not hold for them.
  const users = page.locator("#admin-users");
  await expect
    .poll(async () => users.locator('select[aria-label="Sort column"]').filter({ visible: true }).count(), { timeout: 45_000 })
    .toBeGreaterThan(0);

  const select = users.locator('select[aria-label="Sort column"]').filter({ visible: true }).first();
  const dirButton = select.locator("xpath=following-sibling::button[1]");

  await expect(dirButton).toBeDisabled();
  const label = (await select.locator("option").nth(1).textContent())!;
  await select.selectOption({ label });
  await expect(dirButton).toBeEnabled();

  const first = await dirButton.getAttribute("aria-label");
  await dirButton.click();
  expect(await dirButton.getAttribute("aria-label")).not.toBe(first);

  await select.selectOption({ label: "Default order" });
  await expect(dirButton).toBeDisabled();
  await context.close();
});
