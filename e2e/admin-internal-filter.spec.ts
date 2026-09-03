/**
 * Internal-traffic filtering: the toggle, the notice, and the management card.
 *
 * ── Safety, because this writes to the live project ────────────────────────
 * There is one Supabase project. `internal_traffic` holds the REAL office
 * networks, and `remove-internal-entry` deletes permanently. So:
 *
 *   - every fixture uses an RFC 5737 documentation range (198.51.100.0/24),
 *     which can never be a real office address;
 *   - nothing here removes or disables a row it did not create — the ids are
 *     captured at insert time and only those are touched;
 *   - afterAll cleans up its own ids and nothing else.
 *
 * A test that deleted a real Vikhroli entry would silently un-filter the panel,
 * and nobody would notice until the numbers drifted.
 *
 * Migration 018 is not deployed yet, so the panel renders labelled sample data.
 * These tests therefore assert the panel's BEHAVIOUR — that the toggle refetches
 * with the right flag, that the notice distinguishes its four states, that the
 * card round-trips an entry — and never that a specific number is correct.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  cleanup,
  cleanupInternalFixtures,
  countInternalFixtures,
  createTestUser,
  setAdmin,
  type TestUser,
} from "./helpers/supabase-admin";
import { signInHeadless, applySession } from "./helpers/session";

let adminUser: TestUser;
let adminSession: unknown;

/** Ids this spec created, and the only ones it may ever remove. */
const created: string[] = [];

/** RFC 5737 TEST-NET-2 — reserved for documentation, never routable. */
const FIXTURE_NETWORK = "198.51.100.77/32";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  // Before, as well as after. A rule stranded by a run that died mid-test would
  // otherwise make the round-trip test below skip itself forever: its add is
  // refused as a duplicate, no row appears, and the spec reads that as "018 is
  // not deployed". Cleaning up only on the way out cannot repair a run that
  // never got there.
  await cleanupInternalFixtures([FIXTURE_NETWORK]);

  adminUser = await createTestUser("internal-admin");
  adminSession = await signInHeadless(adminUser);
  await setAdmin(adminUser.id, true);
});

test.afterAll(async () => {
  // Actually removed, not merely reported. This used to be a console.warn, on
  // the reasoning that a blanket delete would take the real office networks with
  // it — true of a blanket delete, but the fix is to scope it, not to skip it.
  // FIXTURE_NETWORK is RFC 5737 and can never be a real network.
  //
  // The cost of warning instead of deleting: when the round-trip test failed
  // between adding a rule and removing it, the rule stayed in the production
  // filter, and every later run of that test skipped itself — the add was
  // refused as a duplicate, so no row appeared and the spec concluded 018 was
  // undeployed. The regression test disabled itself, quietly, for good.
  //
  // Swept unconditionally rather than from `created`, because the run that needs
  // cleaning up is the one that already died before pushing to it.
  await cleanupInternalFixtures([FIXTURE_NETWORK]);
  created.length = 0;
  await cleanup([adminUser?.id].filter(Boolean) as string[]);
});

async function openAdmin(browser: import("@playwright/test").Browser, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await applySession(context, adminSession);
  const page = await context.newPage();
  await page.goto("/admin#admin-analytics");
  await expect(page.getByTestId("analytics-dashboard")).toBeVisible({ timeout: 30_000 });
  return { context, page };
}

test("the panel states which population it is showing, before any number", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const panel = page.getByTestId("analytics-dashboard");

  const notice = panel.getByTestId("internal-notice");
  await expect(notice).toBeVisible({ timeout: 30_000 });

  // Default is "real users": the panel exists to describe them, so that is what
  // it shows without anyone having to find a filter first.
  await expect(panel.getByRole("button", { name: "Real users" })).toHaveAttribute("aria-pressed", "true");
  await expect(await notice.textContent()).toMatch(/real users/i);

  // And the notice sits above the funnel it qualifies, not below it.
  const noticeBox = (await notice.boundingBox())!;
  const funnelBox = (await panel.getByText("Funnel ·", { exact: false }).boundingBox())!;
  expect(noticeBox.y, "the notice must be read before the numbers").toBeLessThan(funnelBox.y);

  await context.close();
});

test("toggling refetches with the flag, and the notice changes with it", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const panel = page.getByTestId("analytics-dashboard");
  const notice = panel.getByTestId("internal-notice");

  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("admin-user-management")) calls.push(r.postData() ?? "");
  });

  const filtered = await notice.textContent();

  await panel.getByRole("button", { name: "All traffic" }).click();

  // The server is asked again — the filter is not applied in the browser, and
  // cannot be: it needs a join the client cannot perform.
  await expect
    .poll(
      () =>
        calls.filter((c) => c.includes("analytics-overview") && c.includes('"excludeInternal":false'))
          .length,
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);

  await expect.poll(async () => await notice.textContent(), { timeout: 20_000 }).not.toBe(filtered);
  expect(await notice.textContent()).toMatch(/all traffic/i);

  await panel.getByRole("button", { name: "Real users" }).click();
  await expect
    .poll(
      () =>
        calls.filter((c) => c.includes("analytics-overview") && c.includes('"excludeInternal":true'))
          .length,
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);

  await context.close();
});

test("the heatmap follows the same filter as the funnel above it", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const panel = page.getByTestId("analytics-dashboard");

  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("admin-user-management")) calls.push(r.postData() ?? "");
  });

  await page.getByTestId("click-heatmap").scrollIntoViewIfNeeded();
  await panel.getByRole("button", { name: "All traffic" }).click();

  // Two panels describing different populations for the same week, with nothing
  // on screen explaining why, is the bug this guards.
  await expect
    .poll(
      () => calls.filter((c) => c.includes("click-map") && c.includes('"excludeInternal":false')).length,
      { timeout: 25_000 },
    )
    .toBeGreaterThan(0);

  await context.close();
});

test("the choice survives a reload, per operator", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const panel = page.getByTestId("analytics-dashboard");

  await panel.getByRole("button", { name: "All traffic" }).click();
  await page.waitForTimeout(1500);

  await page.reload();
  await expect(page.getByTestId("analytics-dashboard")).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByTestId("analytics-dashboard").getByRole("button", { name: "All traffic" }),
  ).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });

  // A different browser profile is a different operator, and must not inherit it.
  const other = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await applySession(other, adminSession);
  const otherPage = await other.newPage();
  await otherPage.goto("/admin#admin-analytics");
  await expect(
    otherPage.getByTestId("analytics-dashboard").getByRole("button", { name: "Real users" }),
  ).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });

  await other.close();
  await context.close();
});

test("the management card lives with the IP data, and explains itself", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);

  const card = page.getByTestId("internal-traffic");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible({ timeout: 30_000 });

  // It sits inside IP Addresses, above the sessions it explains.
  const ips = page.locator("#admin-ips");
  await expect(ips.getByTestId("internal-traffic")).toHaveCount(1);
  const cardBox = (await card.boundingBox())!;
  const tableBox = (await page.getByTestId("visitor-sessions").boundingBox())!;
  expect(cardBox.y).toBeLessThan(tableBox.y);

  // Filter, not blocklist — stated where someone deciding whether to add a rule
  // will actually read it.
  await expect(card.getByText("stays visible", { exact: false })).toBeVisible();
  await expect(card.getByRole("button", { name: /Add my current IP/ })).toBeVisible();

  await context.close();
});

test("a network round-trips: add, disable, enable, remove", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const card = page.getByTestId("internal-traffic");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible({ timeout: 30_000 });

  // Documentation range only. Never a real address — see the header.
  await card.getByLabel("IP address or range").fill(FIXTURE_NETWORK);
  await card.getByLabel("Office label").fill("QA-FIXTURE");
  await card.getByRole("button", { name: "Add", exact: true }).first().click();

  const row = card.locator("div", { hasText: FIXTURE_NETWORK }).last();

  // waitFor, not isVisible. `locator.isVisible()` does NOT retry — it answers
  // about the DOM as it stands and returns immediately, timeout option or not.
  // So this was a snapshot taken microseconds after the click, before the list
  // had refetched, and the test skipped or ran depending on how the race landed.
  // When it skipped it blamed an undeployed migration, which sent whoever read
  // the log looking at the database instead of at the assertion.
  const appeared = await row
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  if (!appeared) {
    // Genuinely absent after a real wait: 018 is undeployed, so the card is
    // showing sample rows and the write could not land. Skip rather than assert
    // a false pass — and say why.
    test.skip(true, "internal_traffic is not deployed yet; card is showing sample data");
  }

  // Recorded so cleanup can only ever touch what this test made.
  created.push(FIXTURE_NETWORK);

  // `exact` matters, and not for tidiness: the card also renders a result banner
  // reading "Added 198.51.100.77/32.", which a substring match hits as well as
  // the row itself. Two matches is a strict-mode failure, so this assertion
  // could never pass once the banner existed — and it took the six tests after
  // it down with it, this file being serial.
  await expect(card.getByText(FIXTURE_NETWORK, { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Disable" }).click();
  await expect(row.getByRole("button", { name: "Enable" })).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "Enable" }).click();
  await expect(row.getByRole("button", { name: "Disable" })).toBeVisible({ timeout: 15_000 });

  await row.getByRole("button", { name: new RegExp(`Remove ${FIXTURE_NETWORK}`) }).click();
  // Same reason as above, and here it would have been worse than a failure: the
  // banner still names the network after a removal, so a substring match could
  // never reach zero even when the row had genuinely gone.
  await expect(card.getByText(FIXTURE_NETWORK, { exact: true })).toHaveCount(0, {
    timeout: 15_000,
  });

  await context.close();
});

test("a range broad enough to empty the panel is refused", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const card = page.getByTestId("internal-traffic");
  await card.scrollIntoViewIfNeeded();

  // 0.0.0.0/0 would subtract every session, and the panel would read as a
  // collapse in traffic rather than as a typo.
  await card.getByLabel("IP address or range").fill("0.0.0.0/0");
  await card.getByRole("button", { name: "Add", exact: true }).first().click();

  // Two claims that hold whether or not the action is deployed yet, and both
  // matter more than the exact wording: the address is never accepted, and the
  // refusal is *reported* rather than swallowed. A silently ignored click would
  // leave the operator believing a rule exists when none does.
  const errorMessage = card.getByTestId("internal-traffic-error");
  await expect(errorMessage).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText("0.0.0.0/0", { exact: true })).toHaveCount(0);

  // Once admin-user-management carries this action, the message is specific.
  // Until then the deployed function answers "invalid action", which is a true
  // statement about the deployment rather than about the address — so this is
  // asserted conditionally instead of being allowed to fail for the wrong reason.
  // The rule itself is covered exhaustively in _shared/internal-traffic.test.ts.
  const message = (await errorMessage.textContent()) ?? "";
  if (!/invalid action/i.test(message)) {
    expect(message, "a rejected CIDR should say why").toMatch(/too broad|not a valid/i);
  }

  await context.close();
});

test("teardown leaves no fixture rule in the production filter", async () => {
  // A stranded rule is not cosmetic: it sits in the live internal-traffic filter
  // and it silently disables the round-trip test above on every future run.
  await cleanupInternalFixtures([FIXTURE_NETWORK]);
  expect(await countInternalFixtures([FIXTURE_NETWORK])).toBe(0);
});

test("internal sessions are marked in the Visitors table, never hidden", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);

  const sessions = page.getByTestId("visitor-sessions");
  await sessions.scrollIntoViewIfNeeded();
  await expect(sessions).toBeVisible({ timeout: 30_000 });

  // The requirement in one assertion: rows still render, and internal ones carry
  // a badge rather than being absent.
  const table = sessions.locator("table");
  const rows = table.locator("tbody tr");
  await expect.poll(async () => await rows.count(), { timeout: 30_000 }).toBeGreaterThan(0);

  // Scoped to the table, the same rendering `rows` counts. AdminTable renders
  // the data TWICE — a desktop table and a mobile card list, one hidden by CSS —
  // so a container-wide locator counts every internal session once per
  // rendering and compares it against a single rendering's rows. That is not a
  // near miss: it reported 70 badges against 60 rows and read as internal
  // sessions being invented, when the real figure was 35 of 60.
  const badges = table.getByText("internal", { exact: true });
  const badgeCount = await badges.count();
  if (badgeCount > 0) {
    await expect(badges.first()).toBeVisible();
    // Badged rows are inside the table, i.e. shown, not filtered out.
    expect(badgeCount).toBeLessThanOrEqual(await rows.count());
  }

  await context.close();
});
