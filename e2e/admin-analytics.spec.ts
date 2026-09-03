/**
 * /admin → Analytics: the first-party behaviour dashboard.
 *
 * Two things make this worth a real browser rather than jsdom. The heatmap is a
 * canvas sized by a ResizeObserver against a laid-out box, and the range control
 * has to actually refetch — neither is observable without layout and a network
 * log.
 *
 * ── What this can and cannot assert today ──────────────────────────────────
 * Migration 018 and the two edge functions are not deployed, so
 * analytics-overview returns an error and the panel renders its DEV sample data
 * (labelled SAMPLE DATA, which these tests check for explicitly rather than
 * ignoring). So this spec covers the panel's own behaviour — layout, controls,
 * refetching, both themes, the failure posture — and deliberately does NOT
 * assert that any number is correct. That check belongs after deploy, walking a
 * real funnel by hand.
 *
 * Everything here writes to the PRODUCTION project — there is only one. The admin
 * flag goes on a user this file creates and nobody else; afterAll removes it.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  cleanup,
  cleanupQaVisits,
  countQaVisits,
  createTestUser,
  seedPageViews,
  setAdmin,
  type TestUser,
} from "./helpers/supabase-admin";
import { signInHeadless, applySession } from "./helpers/session";

let adminUser: TestUser;
let adminSession: unknown;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  adminUser = await createTestUser("analytics-admin");
  adminSession = await signInHeadless(adminUser);
  await setAdmin(adminUser.id, true);
});

test.afterAll(async () => {
  await cleanup([adminUser?.id].filter(Boolean) as string[]);
});

async function openAnalytics(
  browser: import("@playwright/test").Browser,
  opts?: { width?: number; height?: number },
) {
  const context = await browser.newContext(
    opts ? { viewport: { width: opts.width ?? 1440, height: opts.height ?? 900 } } : undefined,
  );
  await applySession(context, adminSession);
  const page = await context.newPage();
  await page.goto("/admin#admin-analytics");

  const panel = page.getByTestId("analytics-dashboard");
  await expect(panel).toBeVisible({ timeout: 30_000 });
  // The funnel is the last thing to paint; without it the controls exist but
  // there is nothing under them to assert against.
  await expect(panel.getByText("Funnel ·", { exact: false })).toBeVisible({ timeout: 30_000 });
  return { context, page, panel };
}

/** Numeric text of a stat tile, by its label. */
async function tileValue(panel: ReturnType<Page["getByTestId"]>, label: string) {
  const tile = panel.locator("div", { hasText: label }).last();
  return (await tile.textContent())?.trim() ?? "";
}

test("Analytics is its own section, separate from Overview", async ({ browser }) => {
  const { context, page } = await openAnalytics(browser);

  // Both exist, and each holds what belongs to it: account counts and pipeline
  // health in Overview, behaviour in Analytics. They were one section until the
  // second grew a dashboard.
  await expect(page.locator("#admin-overview")).toHaveCount(1);
  await expect(page.locator("#admin-analytics")).toHaveCount(1);

  await expect(page.locator("#admin-overview").getByText("Total Users").first()).toBeVisible();
  await expect(page.locator("#admin-analytics").getByTestId("analytics-dashboard")).toBeVisible();
  // The behaviour dashboard must not have leaked into Overview.
  await expect(page.locator("#admin-overview").getByTestId("analytics-dashboard")).toHaveCount(0);

  await context.close();
});

test("the sidebar jumps to Analytics and the deep link lands on it", async ({ browser }) => {
  const { context, page } = await openAnalytics(browser);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  await page
    .locator('nav[aria-label="Admin sections"]')
    .filter({ visible: true })
    .getByRole("button", { name: /Analytics/ })
    .click();
  await page.waitForTimeout(900);

  const top = await page
    .locator("#admin-analytics-heading")
    .evaluate((el) => el.getBoundingClientRect().top);
  // Clear of the sticky offset, not merely somewhere on the page.
  expect(top, "the Analytics heading is not near the top after a jump").toBeLessThan(700);
  expect(top, "the Analytics heading is scrolled off the top").toBeGreaterThan(-40);

  await context.close();
});

test("the two headline conversion rates are both present", async ({ browser }) => {
  const { context, panel } = await openAnalytics(browser);

  // These are the questions the panel was built to answer, so they get the top
  // row rather than being derivable from the funnel below.
  await expect(panel.getByText("Guest kundali → Google sign-in")).toBeVisible();
  await expect(panel.getByText("Pay clicked → payment completed")).toBeVisible();
  // Exact. The Audience section further down carries "Average session duration",
  // which a substring match also hits — and only once that panel's fetch had
  // resolved, so this test failed or passed depending on render timing.
  await expect(panel.getByText("Average session", { exact: true })).toBeVisible();
  await expect(panel.getByText("Left without navigating")).toBeVisible();

  await context.close();
});

test("the funnel narrows, and every step is labelled", async ({ browser }) => {
  const { context, panel } = await openAnalytics(browser);

  // Scoped, not `.first()`. The Campaigns funnel carries four of these five
  // labels verbatim, so an unscoped `.first()` could be satisfied entirely by
  // that funnel and still pass with the site-wide one missing.
  const siteFunnel = panel.getByTestId("site-funnel");
  for (const step of [
    "Sessions",
    "Kundali generated",
    "Signed in",
    "Payment started",
    "Payment completed",
  ]) {
    await expect(siteFunnel.getByText(step, { exact: true })).toBeVisible();
  }

  // Scoped to the site-wide funnel: the Campaigns panel renders the same
  // component further down the same section, so an unscoped selector picks up
  // eleven bars from two different funnels.
  const widths = await siteFunnel
    .getByTestId("funnel-bar")
    .evaluateAll((els) => els.map((el) => (el as HTMLElement).getBoundingClientRect().width));

  expect(widths.length, "expected five funnel bars").toBe(5);

  // Monotonic WITHIN the session-counted group only. The fifth stage is counted
  // from payment_orders, restarts the baseline, and is legitimately allowed to
  // exceed the pay clicks above it — a browser event can be lost while the
  // payment row is authoritative. Asserting across that break is what made this
  // test demand that a database fact be smaller than a beacon.
  const sessionStages = widths.slice(0, 4);
  for (let i = 1; i < sessionStages.length; i++) {
    expect(sessionStages[i], `step ${i + 1} is wider than step ${i}`).toBeLessThanOrEqual(
      sessionStages[i - 1] + 1,
    );
  }

  // And the break is explained on screen, not left for the reader to infer.
  await expect(siteFunnel.getByText(/not a subset of the pay clicks above/)).toBeVisible();

  await context.close();
});

test("payment completion is stated as a database fact, not a browser event", async ({ browser }) => {
  const { context, panel } = await openAnalytics(browser);

  // The distinction matters enough to be on screen: a client-reported purchase
  // is forgeable, so this number comes from payment_orders.
  //
  // Scoped to the site funnel. The Campaigns funnel states the same thing about
  // its own Paid stage, so an unscoped match resolves to two elements and fails
  // strict mode — which said nothing about whether either was visible.
  await expect(
    panel.getByTestId("site-funnel").getByText("From payment_orders, not the browser"),
  ).toBeVisible();
  await expect(panel.getByText("pay clicks did", { exact: false })).toBeVisible();

  await context.close();
});

test("the range control refetches rather than filtering in the browser", async ({ browser }) => {
  const { context, page, panel } = await openAnalytics(browser);

  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("admin-user-management")) calls.push(r.postData() ?? "");
  });

  /**
   * Windows travel as resolved ISO bounds, not a day count — a custom from/to
   * cannot be expressed as a number of days back from now, so the day count was
   * dropped entirely. This measures the span the server was actually asked for.
   */
  const spanDays = (body: string): number | null => {
    if (!body.includes("analytics-overview")) return null;
    const call = JSON.parse(body) as { from?: string; to?: string };
    if (!call.from || !call.to) return null;
    return Math.round((Date.parse(call.to) - Date.parse(call.from)) / 86_400_000);
  };

  await panel.getByRole("button", { name: "7d", exact: true }).click();
  await expect
    .poll(() => calls.some((c) => spanDays(c) === 7), { timeout: 15_000 })
    .toBe(true);

  await panel.getByRole("button", { name: "90d", exact: true }).click();
  await expect
    .poll(() => calls.some((c) => spanDays(c) === 90), { timeout: 15_000 })
    .toBe(true);

  // And the chosen range stays visibly selected.
  await expect(panel.getByRole("button", { name: "90d", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByRole("button", { name: "7d", exact: true })).toHaveAttribute("aria-pressed", "false");

  await context.close();
});

test("the pages table exposes exit rate and can be sorted by it", async ({ browser }) => {
  const { context, panel } = await openAnalytics(browser);

  await expect(panel.getByText("Pages, and where people leave")).toBeVisible();

  const header = panel.locator("thead button", { hasText: "Exit rate" }).first();
  await expect(header).toBeVisible();

  const column = () =>
    panel
      .locator("table")
      .first()
      .locator("tbody tr td:last-child")
      .evaluateAll((els) => els.map((el) => parseFloat(el.textContent ?? "0")));

  await header.click();
  const first = await column();
  await header.click();
  const second = await column();

  expect(first.length, "the pages table rendered no rows").toBeGreaterThan(1);
  // Three-state sort: the second click reverses. Comparing the two orders is the
  // assertion; the direction the first click picks is a separate concern.
  expect(second).toEqual([...first].reverse());

  await context.close();
});

/**
 * The footer's legal pages, in the pages table, with their names.
 *
 * They were tracked all along — Footer.tsx reaches them with a react-router
 * <Link>, so RouteTracker records a page_view, and the pages CTE groups every
 * path it finds with no allow-list. They were missing from the panel because the
 * dev mock hardcoded six paths.
 */
const FOOTER_PAGES = ["/terms", "/privacy", "/disclaimer", "/refund-policy", "/services"];

test("the pages table lists the footer pages, named", async ({ browser }) => {
  // Seeded, because the pages table only lists paths somebody visited in the
  // window and three of these five have had no real traffic in 30 days. Without
  // this the test asserted a fact about production traffic rather than about the
  // panel, and failed on a quiet month. Removed again in the finally below, and
  // swept by marker in the teardown at the foot of this file.
  await seedPageViews(FOOTER_PAGES);

  const { context, panel } = await openAnalytics(browser);

  try {
  const table = panel.locator("table").first();
  await expect(table).toBeVisible();

  const rows = await table
    .locator("tbody tr td:first-child")
    .evaluateAll((els) => els.map((el) => el.textContent ?? ""));

  for (const path of FOOTER_PAGES) {
    expect(rows.some((r) => r.includes(path)), `${path} missing from the pages table`).toBe(true);
  }

  // Named, not just pathed — "/refund-policy" reading "Refund policy" is the
  // half of "map pages with their names" that reached the heatmap picker first.
  // This is the assertion the fixture exists to keep alive; it is the one that
  // would have been lost by weakening the test to fit whatever traffic existed.
  const refund = rows.find((r) => r.includes("/refund-policy"))!;
  expect(refund).toMatch(/refund policy/i);
  const disclaimer = rows.find((r) => r.includes("/disclaimer"))!;
  expect(disclaimer).toMatch(/disclaimer/i);
  } finally {
    await context.close();
    await cleanupQaVisits();
  }
});

test("named GTM tags are visibly distinguished from derived labels", async ({ browser }) => {
  const { context, panel } = await openAnalytics(browser);

  await expect(panel.getByText("What gets clicked")).toBeVisible();
  // The distinction is load-bearing: a derived label changes if the button's
  // text changes, and an agreed tag string does not.
  await expect(panel.getByText("tag", { exact: true }).first()).toBeVisible();
  await expect(panel.getByText("derived", { exact: true }).first()).toBeVisible();

  await context.close();
});

test("the heatmap paints a canvas and states the vertical caveat", async ({ browser }) => {
  const { context, page } = await openAnalytics(browser);

  const heatmap = page.getByTestId("click-heatmap");
  await heatmap.scrollIntoViewIfNeeded();
  await expect(heatmap).toBeVisible();

  // How to read a position is stated on screen, because a reader who assumes the
  // wrong thing about `y` draws the wrong conclusion from the picture.
  //
  // This used to assert "Vertical is approximate", which the panel has not said
  // since `click_points.doc_h` shipped: y is now a real depth taken against the
  // page height each click was recorded on, rather than a fraction of whatever
  // the admin iframe happened to measure. The test was still guarding the claim
  // the product deliberately reversed.
  await expect(heatmap.getByText("Horizontal position is a fraction of the layout width", { exact: false })).toBeVisible();
  await expect(heatmap.getByText("Vertical is a real depth in pixels", { exact: false })).toBeVisible();

  const canvas = heatmap.locator("canvas");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(1200);

  // Sized to its laid-out box by the ResizeObserver, and actually drawn into
  // rather than left blank.
  const painted = await canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    if (c.width === 0 || c.height === 0) return { width: c.width, height: c.height, nonBlank: 0 };
    const ctx = c.getContext("2d")!;
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let nonBlank = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) nonBlank++;
    return { width: c.width, height: c.height, nonBlank };
  });

  expect(painted.width, "the heatmap canvas has no width").toBeGreaterThan(100);
  expect(painted.height, "the heatmap canvas has no height").toBeGreaterThan(100);
  expect(painted.nonBlank, "the heatmap canvas was never drawn into").toBeGreaterThan(0);

  await context.close();
});

test("the heatmap device filter refetches for the chosen class", async ({ browser }) => {
  const { context, page } = await openAnalytics(browser);

  const heatmap = page.getByTestId("click-heatmap");
  await heatmap.scrollIntoViewIfNeeded();

  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("admin-user-management")) calls.push(r.postData() ?? "");
  });

  await heatmap.getByRole("button", { name: "Desktop" }).click();
  await expect
    .poll(() => calls.filter((c) => c.includes("click-map") && c.includes('"desktop"')).length, {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);

  await context.close();
});

test("the panel labels sample data instead of passing it off as traffic", async ({ browser }) => {
  const { context, panel } = await openAnalytics(browser);

  // While 018 is undeployed the dev preview is what renders, and the badge is
  // the thing that stops it being read as real. If this ever fails because the
  // badge is gone, check whether the deploy happened — do not delete the test.
  const badge = panel.getByText("SAMPLE DATA", { exact: true });
  const sampled = await badge.isVisible().catch(() => false);

  const labels = panel.getByText("generated sample data", { exact: false });

  // The badge describes the OVERVIEW's data source only. Campaigns and Audience
  // each fetch their own RPC and fall back to their own mock independently — so
  // with 019 undeployed they can legitimately be showing (and labelling) sample
  // data while the funnel above them is real. Counting every label in the
  // section conflated three separate data sources, and failed or passed
  // depending on which panel had finished painting.
  const overviewLabels = panel.getByText("These figures are", { exact: false });

  if (sampled) {
    await expect(labels.first()).toBeVisible();
    // The overview's own banner specifically, not just any panel's.
    await expect(overviewLabels).toHaveCount(1);
    // Two surfaces say it, and both need to: the summary banner and the heatmap
    // caveat can each be read without the other in view.
    expect(await labels.count(), "only one surface labelled the sample").toBeGreaterThanOrEqual(2);
    await expect(panel.getByText("018_visitor_events.sql", { exact: false })).toBeVisible();
  } else {
    // Real overview data: the overview must not claim to be sampled.
    await expect(overviewLabels).toHaveCount(0);
  }

  // Whatever each panel's source, none may show generated data without saying
  // so. That is the invariant the count above was a poor proxy for.
  for (const id of ["campaigns-panel", "audience-panel"]) {
    const section = panel.getByTestId(id);
    if (!(await section.isVisible().catch(() => false))) continue;
    const banner = section.getByText("generated sample data", { exact: false });
    const bannerCount = await banner.count();
    if (bannerCount > 0) {
      await expect(banner.first()).toBeVisible();
      await expect(section.getByText("mockVisitors=0", { exact: false }).first()).toBeVisible();
    }
  }

  await context.close();
});

test("both admin themes render the section legibly, with no Vedic leakage", async ({ browser }) => {
  const { context, page, panel } = await openAnalytics(browser);

  for (const pass of ["first", "second"] as const) {
    await expect(panel.getByText("Funnel ·", { exact: false })).toBeVisible();

    // The /kundali Vedic stylesheet must never reach /admin — the panel has its
    // own complete --admin-* token set for both themes.
    await expect(page.locator(".vedic-theme")).toHaveCount(0);

    const contrast = await panel.evaluate((el) => {
      const style = getComputedStyle(el as HTMLElement);
      return { colour: style.color, background: getComputedStyle(document.body).backgroundColor };
    });
    expect(contrast.colour, `${pass} theme: text has no colour`).not.toBe("");
    expect(contrast.background, `${pass} theme: body has no background`).not.toBe("rgba(0, 0, 0, 0)");

    if (pass === "first") {
      await page.getByRole("button", { name: /theme/i }).first().click();
      await page.waitForTimeout(600);
      await panel.scrollIntoViewIfNeeded();
    }
  }

  await context.close();
});

test("the section is usable at 390px", async ({ browser }) => {
  const { context, page, panel } = await openAnalytics(browser, { width: 390, height: 780 });

  await expect(panel.getByText("Guest kundali → Google sign-in")).toBeVisible();

  // The whole reason AdminTable exists: at this width the tables become cards,
  // and nothing may be clipped out of reach. Assert the page does not scroll
  // sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "the page scrolls horizontally at 390px").toBeLessThanOrEqual(1);

  await context.close();
});

test("no click inside /admin is recorded as product usage", async ({ browser }) => {
  const { context, page, panel } = await openAnalytics(browser);

  const tracked: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("track-visit")) tracked.push(r.postData() ?? "");
  });

  // Operating the panel is us looking at the data. Counting these clicks would
  // pollute the very numbers being looked at.
  await panel.getByRole("button", { name: "7d" }).click();
  await panel.getByRole("button", { name: "30d" }).click();
  await page.waitForTimeout(2000);

  const clicks = tracked.filter((body) => body.includes('"click"'));
  expect(clicks, `admin clicks were tracked: ${clicks.join(" | ")}`).toEqual([]);

  await context.close();
});

test("teardown leaves no seeded page views behind", async () => {
  // The fixture rows are invented traffic in a production table. If this ever
  // fails, real analytics is carrying rows nobody visited — sweep them with
  // cleanupQaVisits() rather than leaving them to skew the pages table.
  await cleanupQaVisits();
  expect(await countQaVisits()).toBe(0);
});
