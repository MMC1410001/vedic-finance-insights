/**
 * The /admin section navigation: sidebar, scroll-spy, hash, KPI mirror.
 *
 * None of this had browser coverage. The jsdom test (src/test/AdminPanel.test.tsx)
 * can assert the anchors exist but not that a jump lands somewhere readable —
 * jsdom has no layout, so scroll position, sticky offsets and the observer are
 * all unobservable there. Those are exactly the parts that broke during
 * development, so they belong in a real browser.
 *
 * Everything here writes to the PRODUCTION project — there is only one. The
 * admin flag is granted to a user this file creates and to nobody else, and
 * afterAll removes it along with the account.
 */

import { test, expect, type Page } from "@playwright/test";
import { createTestUser, setAdmin, cleanup, type TestUser } from "./helpers/supabase-admin";
import { signInHeadless, applySession } from "./helpers/session";

const SECTIONS = [
  { id: "admin-overview", label: "Overview" },
  { id: "admin-analytics", label: "Analytics" },
  { id: "admin-ips", label: "IP Addresses" },
  { id: "admin-kundalis", label: "Admin Kundalis" },
  { id: "admin-user-kundalis", label: "Kundalis Generated" },
  { id: "admin-users", label: "Users" },
] as const;

let adminUser: TestUser;
let plainUser: TestUser;
let adminSession: unknown;
let plainSession: unknown;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  adminUser = await createTestUser("panel-admin");
  plainUser = await createTestUser("panel-plain");
  adminSession = await signInHeadless(adminUser);
  plainSession = await signInHeadless(plainUser);
  // The admin flag goes on this file's own user. Never on a real account.
  await setAdmin(adminUser.id, true);
});

test.afterAll(async () => {
  await cleanup([adminUser?.id, plainUser?.id].filter(Boolean) as string[]);
});

async function openAdmin(browser: import("@playwright/test").Browser, opts?: { width?: number; height?: number }) {
  const context = await browser.newContext(
    opts ? { viewport: { width: opts.width ?? 1440, height: opts.height ?? 900 } } : undefined,
  );
  await applySession(context, adminSession);
  const page = await context.newPage();
  await page.goto("/admin");
  // The panel is only up once the funnel labels render; every section below
  // depends on the page having laid out.
  await expect(page.locator("#admin-overview")).toBeVisible({ timeout: 30_000 });
  await waitForStableHeight(page);
  return { context, page };
}

/**
 * Wait until the document stops growing.
 *
 * Six blocks fetch independently and the page roughly doubles in height as they
 * land. Without this, `scrollTo(scrollHeight)` aims at a bottom that no longer
 * exists a moment later — the viewport ends up mid-page and the bottom-edge
 * highlight guard never fires. That is a racing test, not a product defect: a
 * real operator scrolling by hand is never ahead of the content.
 */
async function waitForStableHeight(page: Page, settleMs = 700) {
  let last = -1;
  for (let i = 0; i < 20; i++) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    if (h === last) return;
    last = h;
    await page.waitForTimeout(settleMs);
  }
}

/**
 * Whichever nav is actually on screen.
 *
 * Both the desktop sidebar and the mobile pill strip are `<nav aria-label="Admin
 * sections">` and both are always in the DOM — one is hidden by `hidden lg:flex`
 * / `lg:hidden`. Without the visibility filter, `.first()` silently returns the
 * *hidden* sidebar at mobile widths, so the mobile assertions were reading an
 * element the user cannot see.
 */
const nav = (page: Page) =>
  page.locator('nav[aria-label="Admin sections"]').filter({ visible: true });
const activeLabel = async (page: Page) =>
  (await nav(page).locator('[aria-current="true"]').first().textContent())?.trim();

test("a signed-in NON-admin is refused the panel", async ({ browser }) => {
  const context = await browser.newContext();
  await applySession(context, plainSession);
  const page = await context.newPage();
  await page.goto("/admin");

  await expect(page.getByText("does not have admin", { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(plainUser.email, { exact: false })).toBeVisible();
  // The real gate is the edge function, but the panel must not paint either.
  await expect(page.locator("#admin-users")).toHaveCount(0);
  await context.close();
});

test("every section renders as an anchor, in order, with matching headings", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);

  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('section[id^="admin-"]')].map((s) => s.id),
  );
  expect(ids).toEqual(SECTIONS.map((s) => s.id));

  // The heading text must equal the sidebar label. ADMIN_SECTIONS exists to stop
  // these drifting apart the way /kundali's did ("Best Financial Timings" in the
  // sidebar vs "Your Best Financial Timings" on the page).
  for (const s of SECTIONS) {
    const heading = page.locator(`#${s.id}-heading`);
    await expect(heading, s.id).toHaveText(s.label);
  }
  await context.close();
});

test("each sidebar row jumps to its section and lands clear of the top", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);

  for (const s of SECTIONS) {
    await nav(page).getByRole("button", { name: s.label, exact: false }).first().click();
    await page.waitForTimeout(800); // smooth scroll

    const top = await page.locator(`#${s.id}-heading`).evaluate((el) => el.getBoundingClientRect().top);
    // Must be on screen and not tucked under the viewport edge. scroll-mt-6 is
    // 24px; allow the last section, which cannot scroll further.
    expect(top, `${s.id} heading top`).toBeGreaterThanOrEqual(0);
    expect(top, `${s.id} heading below the fold`).toBeLessThan(700);
    expect(await activeLabel(page), `${s.id} not highlighted after jump`).toBe(s.label);
  }
  await context.close();
});

test("scroll-spy: first section at the top, LAST section at the bottom", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  expect(await activeLabel(page), "top of page").toBe("Overview");

  // The measured bug this guards: at the document end the remaining headings sit
  // below the observer band, so the last one that passed through it kept the
  // highlight — "Admin Kundalis" stayed lit while you were looking at Users.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(500);
  expect(await activeLabel(page), "bottom of page").toBe("Users");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  expect(await activeLabel(page), "back at the top").toBe("Overview");
  await context.close();
});

test("scroll-spy picks the UPPER section when two are on screen", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);

  // Park the viewport so an earlier heading is just below the top and a later
  // one is further down. The upper one is the one being read.
  const target = await page.locator("#admin-kundalis").evaluate((el) => {
    const y = el.getBoundingClientRect().top + window.scrollY;
    return y - 40;
  });
  await page.evaluate((y) => window.scrollTo(0, y), target);
  await page.waitForTimeout(500);

  const onScreen = await page.evaluate(() =>
    [...document.querySelectorAll('section[id^="admin-"] h2')]
      .filter((h) => { const r = h.getBoundingClientRect(); return r.top > -20 && r.top < window.innerHeight; })
      .map((h) => h.textContent),
  );
  // Only meaningful if more than one heading really is visible.
  test.skip(onScreen.length < 2, "viewport too tall/short to show two headings");
  expect(await activeLabel(page)).toBe(onScreen[0]);
  await context.close();
});

test("a nav click does not add history entries", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);

  await nav(page).getByRole("button", { name: "Users", exact: false }).first().click();
  await page.waitForTimeout(700);
  await nav(page).getByRole("button", { name: "IP Addresses", exact: false }).first().click();
  await page.waitForTimeout(700);
  expect(page.url()).toContain("#admin-ips");

  // replaceState, not a hash assignment: otherwise Back walks the operator
  // through every section they visited instead of leaving the page.
  await page.goBack();
  await page.waitForTimeout(500);
  expect(page.url(), "Back should leave /admin, not step through sections").not.toContain("/admin#");
  await context.close();
});

test("deep link /admin#admin-users scrolls there; a bogus hash is ignored", async ({ browser }) => {
  const context = await browser.newContext();
  await applySession(context, adminSession);
  const page = await context.newPage();

  await page.goto("/admin#admin-users");
  await expect(page.locator("#admin-users")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1200); // the handler defers 300ms, then smooth-scrolls
  expect(await page.evaluate(() => window.scrollY), "did not scroll to #admin-users").toBeGreaterThan(200);

  await context.close();

  // A separate context, not a second goto on the same page: changing only the
  // hash is a same-document navigation, so React never remounts and the page
  // simply keeps the scroll position from the assertion above — which looked
  // like the bogus hash scrolling when nothing had happened at all.
  const ctx2 = await browser.newContext();
  await applySession(ctx2, adminSession);
  const page2 = await ctx2.newPage();
  await page2.goto("/admin#not-a-section");
  await expect(page2.locator("#admin-overview")).toBeVisible({ timeout: 30_000 });
  await page2.waitForTimeout(1200);
  expect(await page2.evaluate(() => window.scrollY), "bogus hash should not scroll").toBeLessThan(100);
  await ctx2.close();
});

test("sidebar collapses to an icon rail and keeps its labels reachable", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const aside = page.locator("aside");

  const wide = (await aside.boundingBox())!.width;
  await page.getByLabel("Collapse section menu").click();
  await page.waitForTimeout(500);
  const narrow = (await aside.boundingBox())!.width;
  expect(narrow, "collapsed rail should be narrower").toBeLessThan(wide);

  await expect(aside.getByText("Kundalis Generated")).toHaveCount(0);
  // The label moves to a tooltip rather than disappearing.
  await expect(aside.locator('[title="Kundalis Generated"]')).toHaveCount(1);

  await page.getByLabel("Expand section menu").click();
  await page.waitForTimeout(500);
  expect((await aside.boundingBox())!.width).toBeCloseTo(wide, 0);
  await context.close();
});

test("the funnel numbers are identical in Overview and in Users", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);

  const LABELS = ["Total Users", "Active (Paid)", "Awaiting Payment", "Onboarding"];

  // Poll until the fetch has landed. Asserting immediately is what surfaced the
  // real defect here: the two copies disagreed *during* load, Analytics showing
  // "—" while the Users copy showed a bare 0. Both are guarded now, so the
  // equality assertion below holds at every instant; the wait is only so the
  // "not a placeholder" assertion has something to check.
  await expect
    .poll(async () => page.locator("#admin-overview").getByText("Total Users").first().isVisible(), { timeout: 30_000 })
    .toBe(true);
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          for (const p of document.querySelectorAll("p")) {
            if (p.textContent?.trim() === "Total Users") {
              return p.parentElement?.querySelector("p")?.textContent?.trim();
            }
          }
          return undefined;
        }),
      { timeout: 30_000, message: "funnel numbers never finished loading" },
    )
    .not.toBe("—");

  for (const label of LABELS) {
    // Each label appears exactly twice — once per copy — and the number beside
    // it must match. Both read one provider, so a mismatch means the single
    // source was broken.
    const values = await page.evaluate((lbl) => {
      const out: string[] = [];
      for (const p of document.querySelectorAll("p")) {
        if (p.textContent?.trim() !== lbl) continue;
        const val = p.parentElement?.querySelector("p");
        if (val) out.push(val.textContent!.trim());
      }
      return out;
    }, label);

    expect(values, `${label}: expected two copies`).toHaveLength(2);
    expect(values[0], `${label} disagrees between Overview and Users`).toBe(values[1]);
    expect(values[0], `${label} still showing a placeholder`).not.toBe("—");
  }
  await context.close();
});

test("an Overview KPI tile filters the Users table and jumps to it", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);

  const overview = page.locator("#admin-overview");
  await overview.getByRole("button", { name: /Awaiting Payment/ }).click();
  await page.waitForTimeout(900);

  // Arrived at Users…
  const top = await page.locator("#admin-users-heading").evaluate((el) => el.getBoundingClientRect().top);
  expect(top, "did not jump to Users").toBeLessThan(700);

  // …with the filter already applied, which is the only thing that justifies a
  // second copy of the numbers.
  const users = page.locator("#admin-users");
  const active = users.locator("button", { hasText: "Awaiting Payment" }).first();
  await expect(active).toHaveClass(/bg-admin-info-strong/);

  // And the rows obey it: every visible Stage badge reads "Awaiting Payment".
  //
  // Polled, not sampled once. waitForStableHeight can settle before list-users
  // resolves — two equal height samples are not proof the table has rows — and a
  // single read then asserts against an empty tbody. This flaked exactly that way.
  const readStages = () =>
    users.evaluate((root) =>
      [...root.querySelectorAll("table tbody > tr")]
        .filter((tr) => tr.children.length > 2)
        .map((tr) => tr.children[3]?.textContent?.trim())
        .slice(0, 15),
    );

  await expect
    .poll(async () => (await readStages()).length, {
      timeout: 45_000,
      message: "the filtered Users table never rendered any rows",
    })
    .toBeGreaterThan(0);

  for (const s of await readStages()) expect(s).toBe("Awaiting Payment");
  await context.close();
});

test("Visitors & IPs is expanded on arrival, not a collapsed shell", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);
  const panel = page.getByTestId("visitor-sessions");
  // Expanded means the collapse control offers "Collapse", not "Expand".
  await expect(panel.getByLabel("Collapse")).toHaveCount(1);
  await context.close();
});

test("the customer chat bubble does not float over the admin console", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);

  // FloatingAstrologerChat is mounted globally in App.tsx and hides itself by
  // pathname. /admin is an operator console, so a "Chat with AI Astrologer"
  // button belongs on it about as much as a pricing banner would.
  await expect(page.getByRole("button", { name: /Open AI Astrologer chat/i })).toHaveCount(0);
  await context.close();
});

test("the chat bubble is still present on a customer page", async ({ browser }) => {
  // The other half of the assertion above: gating it by pathname must not have
  // switched it off everywhere.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/home");
  await expect(page.getByRole("button", { name: /Open AI Astrologer chat/i }).first())
    .toBeVisible({ timeout: 30_000 });
  await context.close();
});

test("both admin themes render every section", async ({ browser }) => {
  const { context, page } = await openAdmin(browser);

  for (const pass of [0, 1]) {
    const theme = await page.locator("div.admin-theme").getAttribute("data-admin-theme");
    for (const s of SECTIONS) {
      await expect(page.locator(`#${s.id}-heading`), `${s.id} in ${theme}`).toBeVisible();
    }
    // The Vedic stylesheet is ~700 lines scoped to `.vedic-theme main …` and
    // would wreck this page; Admin.tsx documents keeping it out. Assert it.
    expect(await page.locator("div.admin-theme.vedic-theme").count(), "vedic-theme leaked onto /admin").toBe(0);
    expect(await page.locator("main").count(), "/admin must not be wrapped in <main>").toBe(0);

    if (pass === 0) {
      await page.getByLabel(/Switch to .* theme/).click();
      await page.waitForTimeout(400);
      expect(await page.locator("div.admin-theme").getAttribute("data-admin-theme")).not.toBe(theme);
    }
  }
  await context.close();
});

test("mobile: the pill strip stays pinned and jumps clear of itself", async ({ browser }) => {
  const { context, page } = await openAdmin(browser, { width: 390, height: 780 });

  // `hidden lg:flex` — the element is in the DOM, just not displayed. Assert on
  // visibility, not presence.
  await expect(page.locator("aside")).toBeHidden();
  const strip = nav(page);
  await expect(strip).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(400);
  const box = (await strip.boundingBox())!;
  expect(box.y, "pill strip unpinned after scrolling").toBeLessThan(10);

  // "Users" is the last pill and needs a horizontal scroll to reach.
  const pill = strip.getByRole("button", { name: "Users", exact: false }).first();
  await pill.scrollIntoViewIfNeeded();
  await pill.click();
  await page.waitForTimeout(900);

  const headingTop = await page.locator("#admin-users-heading").evaluate((el) => el.getBoundingClientRect().top);
  const stripBottom = box.y + box.height;
  expect(headingTop, "heading hidden under the sticky strip").toBeGreaterThanOrEqual(stripBottom - 2);

  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(sideways, "/admin scrolls horizontally at 390px").toBe(false);
  await context.close();
});
