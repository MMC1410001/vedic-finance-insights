/**
 * Are generated kundalis actually visible on the admin panel?
 *
 * Verified end to end for both audiences, because the 2026-08-18 outage broke
 * exactly one of them: guest saves failed for three days while signed-in saves
 * kept working, so anything that checks only one audience proves nothing.
 *
 * One file with describe.serial rather than three spec files: the specs share
 * fixtures (two seeded users, two generated rows) and the admin assertion is
 * meaningless unless the two generation steps ran first. Playwright gives each
 * file its own module state, so splitting them would mean re-deriving the
 * fixtures three times against a production table.
 *
 * Everything here writes to the PRODUCTION project — there is no other one.
 * Rows are named with QA_PREFIX and removed in afterAll, which runs on failure.
 */

import { test, expect, type Browser } from "@playwright/test";
import {
  createTestUser, setAdmin, findKundalis, findAllQaKundalis, cleanup,
  QA_PREFIX, runTag, type TestUser,
} from "./helpers/supabase-admin";
import { signInHeadless, applySession } from "./helpers/session";
import { stubExternals, fillBirthForm, SUBMIT_LABEL } from "./helpers/birth-form";

const RUN = runTag();
const GUEST_NAME = `${QA_PREFIX} Guest ${RUN}`;
const USER_NAME = `${QA_PREFIX} Signedin ${RUN}`;

let signedInUser: TestUser;
let adminUser: TestUser;
let adminSession: unknown;
let signedInSession: unknown;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  signedInUser = await createTestUser("user");
  adminUser = await createTestUser("admin");
  signedInSession = await signInHeadless(signedInUser);
  adminSession = await signInHeadless(adminUser);
  await setAdmin(adminUser.id, true);
});

test.afterAll(async () => {
  await cleanup([signedInUser?.id, adminUser?.id].filter(Boolean) as string[]);
});

/** The one rendered copy of a name — see the note in the admin spec. */
function visibleText(scope: import("@playwright/test").Locator, text: string) {
  return scope.getByText(text, { exact: false }).filter({ visible: true });
}

/**
 * Open the kundali list if it happens to be closed.
 *
 * This used to be an unconditional click on the section header, with a comment
 * saying the section was collapsed by default. It is expanded by default now
 * (Admin.tsx explains why: guest kundalis appear nowhere else on the page), so
 * that click *collapsed* it and the row assertions below failed against an empty
 * section. Driving the labelled control and only when it says "Expand" is
 * correct whichever way the default goes next.
 */
async function ensureExpanded(scope: import("@playwright/test").Locator) {
  const opener = scope.getByLabel("Expand");
  if (await opener.count()) await opener.click();
}

/** Fill the form and wait for the row to land, rather than for a DOM signal. */
async function generateAs(browser: Browser, name: string, session?: unknown) {
  const context = await browser.newContext();
  if (session) await applySession(context, session);
  const page = await context.newPage();
  await stubExternals(page);

  // /home, not /: Index.tsx gates a splash overlay on sessionStorage, which a
  // fresh context always trips.
  await page.goto("/home");
  await fillBirthForm(page, name);
  await page.getByRole("button", { name: SUBMIT_LABEL }).first().click();

  await expect.poll(async () => (await findKundalis(name)).length, {
    timeout: 90_000,
    message: `no kundli_reports row appeared for "${name}"`,
  }).toBeGreaterThan(0);

  await context.close();
}

test("guest (incognito, no session) generates a kundali that reaches the database", async ({ browser }) => {
  await generateAs(browser, GUEST_NAME);

  const rows = await findKundalis(GUEST_NAME);
  // Exactly one, not "at least one": Landing.tsx:44-80 runs its own
  // generateReport + saveKundaliReport off the same sessionStorage.kundliRequest
  // that FinancialKundali uses. Two rows here is a duplicate-write defect, not
  // a flaky assertion.
  expect(rows).toHaveLength(1);
  expect(rows[0].user_id).toBeNull();
  expect(rows[0].share_slug).toBeTruthy();
});

test("signed-in user generates a kundali linked to their account", async ({ browser }) => {
  await generateAs(browser, USER_NAME, signedInSession);

  const rows = await findKundalis(USER_NAME);
  expect(rows).toHaveLength(1);
  expect(rows[0].user_id).toBe(signedInUser.id);
});

test("both kundalis are visible on the admin panel", async ({ browser }) => {
  const context = await browser.newContext();
  await applySession(context, adminSession);
  const page = await context.newPage();

  await page.goto("/admin");

  const list = page.getByTestId("all-kundali-list");
  await expect(list).toBeVisible({ timeout: 30_000 });
  await ensureExpanded(list);

  // The admin must see rows it does not own — that is the whole point of
  // seeding a separate admin user. If the generator were the admin, this could
  // pass on "users read own reports" instead of the admin path.
  //
  // filter({ visible: true }) is required, not cosmetic: AdminTable renders the
  // desktop table AND the mobile card stack into the DOM simultaneously and
  // picks between them with `hidden sm:block` / `sm:hidden`, so every name
  // matches twice and a bare getByText trips strict mode.
  // Scoped to the section: the signed-in user's name also appears in the Users
  // table below, so an unscoped query matches two different sections.
  await expect(visibleText(list, GUEST_NAME)).toBeVisible({ timeout: 30_000 });
  await expect(visibleText(list, USER_NAME)).toBeVisible();

  const guestRow = list.locator("tr", { hasText: GUEST_NAME });
  await expect(guestRow.getByText("Guest", { exact: true })).toBeVisible();
  const userRow = list.locator("tr", { hasText: USER_NAME });
  await expect(userRow.getByText("Signed-In", { exact: true })).toBeVisible();

  await context.close();
});

test("admin panel shows both kundalis on a 375px phone", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await applySession(context, adminSession);
  const page = await context.newPage();

  await page.goto("/admin");
  const list = page.getByTestId("all-kundali-list");
  await expect(list).toBeVisible({ timeout: 30_000 });
  await ensureExpanded(list);

  await expect(visibleText(list, GUEST_NAME)).toBeVisible({ timeout: 30_000 });
  await expect(visibleText(list, USER_NAME)).toBeVisible();

  // The regression this replaced: the table was wrapped in overflow-hidden, so
  // on a phone the right-hand columns rendered but could not be reached.
  const scrollsSideways = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(scrollsSideways, "admin page scrolls horizontally at 375px").toBe(false);

  await context.close();
});

test("teardown leaves no QA rows behind", async () => {
  await cleanup([]);
  expect(await findAllQaKundalis()).toHaveLength(0);
});
