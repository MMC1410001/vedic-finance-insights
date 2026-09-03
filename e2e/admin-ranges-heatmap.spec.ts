/**
 * Date ranges, the heatmap preview, and admin access.
 *
 * The heatmap tests here are the direct check on a reported defect: the preview
 * showed a blank grey panel. The cause was `sandbox="allow-scripts"` without
 * `allow-same-origin`, which gives the frame an opaque origin — the SPA's first
 * sessionStorage access then throws and nothing renders. So these assert that a
 * real document is present with real height, not merely that an iframe exists.
 *
 * ── Safety, because this writes to the live project ────────────────────────
 * The admin tests grant and remove admin ONLY on a qa-e2e-*@vedicfinance-qa.invalid
 * account this file created. Never a real account, and never the last admin.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  cleanup,
  cleanupQaClickPoints,
  countQaClickPoints,
  createTestUser,
  seedClickPoints,
  setAdmin,
  type TestUser,
} from "./helpers/supabase-admin";
import { signInHeadless, applySession } from "./helpers/session";

let adminUser: TestUser;
let victimUser: TestUser;
let adminSession: unknown;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  adminUser = await createTestUser("range-admin");
  // A second fixture account, so the grant/revoke tests never touch a real one.
  victimUser = await createTestUser("range-target");
  adminSession = await signInHeadless(adminUser);
  await setAdmin(adminUser.id, true);
});

test.afterAll(async () => {
  await cleanup([adminUser?.id, victimUser?.id].filter(Boolean) as string[]);
  // Belt and braces for the fixture below, which also sweeps in its own finally.
  // These are invented coordinates in a production table; a run that dies must
  // not leave them skewing a real heatmap.
  await cleanupQaClickPoints();
});

async function openPanel(browser: import("@playwright/test").Browser, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await applySession(context, adminSession);
  const page = await context.newPage();
  await page.goto("/admin#admin-analytics");
  await expect(page.getByTestId("analytics-dashboard")).toBeVisible({ timeout: 30_000 });
  return { context, page };
}

// ─── Date ranges ────────────────────────────────────────────────────────────

test("every preset is offered, including Today, Yesterday and Custom", async ({ browser }) => {
  const { context, page } = await openPanel(browser);
  const panel = page.getByTestId("analytics-dashboard");

  for (const label of ["Today", "Yesterday", "7d", "30d", "90d", "Custom"]) {
    await expect(panel.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await expect(panel.getByRole("button", { name: "30d", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await context.close();
});

test("the header names the window, and says which timezone it means", async ({ browser }) => {
  const { context, page } = await openPanel(browser);
  const panel = page.getByTestId("analytics-dashboard");
  const label = panel.getByTestId("range-label");

  await expect(label).toHaveText("Last 30 days");

  // IST is not the reader's assumption, and "Today" is meaningless without it.
  await panel.getByRole("button", { name: "Today", exact: true }).click();
  await expect(label).toContainText("IST");

  await panel.getByRole("button", { name: "Yesterday", exact: true }).click();
  await expect(label).toContainText("IST");

  await context.close();
});

test("a preset refetches with resolved bounds, not a day count", async ({ browser }) => {
  const { context, page } = await openPanel(browser);
  const panel = page.getByTestId("analytics-dashboard");

  const bodies: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("admin-user-management")) bodies.push(r.postData() ?? "");
  });

  await panel.getByRole("button", { name: "Today", exact: true }).click();

  await expect
    .poll(() => bodies.filter((b) => b.includes("analytics-overview") && b.includes('"from"')).length, {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);

  const call = JSON.parse(
    bodies.filter((b) => b.includes("analytics-overview")).pop()!,
  ) as { from: string; to: string; days?: number };

  expect(call.days, "a day count would not express a custom range").toBeUndefined();

  // "Today" must start at IST midnight — 18:30Z the previous day — not at the
  // server's midnight and not 24 hours ago.
  const from = new Date(call.from);
  expect(from.getUTCHours()).toBe(18);
  expect(from.getUTCMinutes()).toBe(30);
  expect(new Date(call.to).getTime()).toBeGreaterThan(from.getTime());

  await context.close();
});

test("Custom reveals two date inputs and queries exactly that span", async ({ browser }) => {
  const { context, page } = await openPanel(browser);
  const panel = page.getByTestId("analytics-dashboard");

  await expect(panel.getByLabel("From date")).toHaveCount(0);
  await panel.getByRole("button", { name: "Custom", exact: true }).click();

  const fromInput = panel.getByLabel("From date");
  const toInput = panel.getByLabel("To date");
  await expect(fromInput).toBeVisible();
  await expect(toInput).toBeVisible();

  const bodies: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("admin-user-management")) bodies.push(r.postData() ?? "");
  });

  await fromInput.fill("2026-08-01");
  await toInput.fill("2026-08-14");

  await expect
    .poll(
      () => bodies.filter((b) => b.includes("analytics-overview") && b.includes("2026-07-31")).length,
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);

  const call = JSON.parse(bodies.filter((b) => b.includes("analytics-overview")).pop()!);
  // 1 Aug IST midnight is 31 Jul 18:30Z; 14 Aug ends at 14 Aug 18:29:59.999Z.
  expect(call.from).toBe("2026-07-31T18:30:00.000Z");
  expect(call.to).toBe("2026-08-14T18:29:59.999Z");
  await expect(panel.getByTestId("range-label")).toContainText("2026-08-01 to 2026-08-14");

  await context.close();
});

// ─── Heatmap ────────────────────────────────────────────────────────────────

test("the heatmap renders the real page behind the canvas", async ({ browser }) => {
  const { context, page } = await openPanel(browser);

  const heatmap = page.getByTestId("click-heatmap");
  await heatmap.scrollIntoViewIfNeeded();
  await expect(heatmap).toBeVisible({ timeout: 30_000 });

  const frame = heatmap.locator("iframe");
  await expect(frame).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(4000);

  // The reported bug in one assertion: with an opaque origin the SPA throws on
  // its first storage access and the body stays empty. A visible iframe element
  // is not evidence that anything rendered inside it.
  const inside = await frame.evaluate((el) => {
    const doc = (el as HTMLIFrameElement).contentDocument;
    if (!doc) return { reachable: false, text: 0, height: 0, nodes: 0 };
    return {
      reachable: true,
      text: (doc.body?.innerText ?? "").trim().length,
      height: doc.documentElement.scrollHeight,
      nodes: doc.querySelectorAll("*").length,
    };
  });

  expect(inside.reachable, "contentDocument unreachable — the frame has an opaque origin").toBe(true);
  expect(inside.nodes, "the previewed page rendered no elements").toBeGreaterThan(50);
  expect(inside.text, "the previewed page rendered no text").toBeGreaterThan(20);
  expect(inside.height, "the previewed page has no height").toBeGreaterThan(400);

  await context.close();
});

/**
 * The reported defect, directly.
 *
 * /home was right; /auth showed the kundali page and /payment showed the AI chat,
 * because both pages redirect a signed-in session on mount and nothing checked
 * where the frame landed. So this asserts the framed document's OWN pathname,
 * not merely that an iframe rendered something.
 */
test("the frame shows the page the heatmap claims, not a redirect target", async ({ browser }) => {
  const { context, page } = await openPanel(browser);

  const heatmap = page.getByTestId("click-heatmap");
  await heatmap.scrollIntoViewIfNeeded();
  const frame = heatmap.locator("iframe");
  await expect(frame).toBeVisible({ timeout: 25_000 });

  const picker = heatmap.getByLabel("Heatmap page");

  // The last seven are behind ProtectedRoute / PaidRoute. getRedirectForRoute()
  // answers "/home" for anyone unauthenticated, so before the guards honoured
  // isHeatmapPreview() every one of them showed the LANDING page under its own
  // label — the reported "home page is shown on other pages".
  for (const target of [
    "/home",
    "/auth",
    "/payment",
    "/dashboard",
    "/profile",
    "/chat",
    "/business-timing",
    "/vedic-trading",
    "/upcoming-features",
    "/ai-chat",
  ]) {
    await picker.selectOption(target);

    // Wait for the frame to finish painting rather than sleeping a fixed 4s.
    // Every route here is a lazy chunk, and a cold one served by the dev server
    // can still be showing its spinner — about 45 nodes — when the clock runs
    // out, which read as "/profile rendered nothing". Ten fixed waits also spent
    // 40s of this test's 120s budget doing nothing, which is what tipped it into
    // a timeout whenever the suite was under load.
    //
    // Node count is the wait, not the assertion of intent: a frame that wrongly
    // redirected paints a full page too, so this settles quickly and the
    // pathname check below is what catches it.
    await expect
      .poll(
        async () => {
          try {
            return await frame.evaluate(
              (el) => (el as HTMLIFrameElement).contentDocument?.querySelectorAll("*").length ?? 0,
            );
          } catch {
            // Mid-navigation the document is swapped out; try again.
            return 0;
          }
        },
        { timeout: 20_000, message: `${target} never painted` },
      )
      .toBeGreaterThan(50);

    const landed = await frame.evaluate(
      (el) => (el as HTMLIFrameElement).contentWindow?.location?.pathname ?? null,
    );
    expect(landed, `${target} preview redirected to ${landed}`).toBe(target);

    // No mismatch banner, because there was no mismatch.
    await expect(heatmap.getByTestId("heatmap-mismatch")).toHaveCount(0);
  }

  await context.close();
});

test("the picker offers every tracked page, named", async ({ browser }) => {
  const { context, page } = await openPanel(browser);

  const heatmap = page.getByTestId("click-heatmap");
  await heatmap.scrollIntoViewIfNeeded();

  const options = await heatmap
    .getByLabel("Heatmap page")
    .locator("option")
    .evaluateAll((els) => els.map((el) => ({ value: el.getAttribute("value"), text: el.textContent ?? "" })));

  // The pages from the reported list, which could not appear before because
  // coordinates were only sampled on five hand-picked paths.
  for (const path of ["/home", "/auth", "/payment", "/kundali", "/profile", "/ai-chat", "/"]) {
    expect(options.map((o) => o.value), `${path} missing from the picker`).toContain(path);
  }

  // Each carries a human name, not just its path — /auth and /kundali-auth are
  // otherwise indistinguishable in a dropdown.
  const auth = options.find((o) => o.value === "/auth")!;
  expect(auth.text).toMatch(/sign in/i);
  expect(auth.text).toContain("/auth");

  // A page with no coordinates says so rather than being absent, which used to be
  // indistinguishable from "not a page".
  expect(options.some((o) => /no clicks yet/i.test(o.text))).toBe(true);

  // The footer's legal pages, which the earlier fix put in the catalogue.
  for (const path of ["/terms", "/privacy", "/disclaimer", "/refund-policy"]) {
    expect(options.map((o) => o.value), `${path} missing from the picker`).toContain(path);
  }
  const disclaimer = options.find((o) => o.value === "/disclaimer")!;
  expect(disclaimer.text).toMatch(/disclaimer/i);

  await context.close();
});

/**
 * The reported contradiction, directly.
 *
 * The picker said "(no samples)" for /disclaimer while the badge beside it read
 * "2,087 clicks" and the canvas drew a dense overlay — mockClickMap fabricated a
 * grid for any path it was handed and never consulted the list the picker read.
 * All three now come from one figure, so all three must agree.
 */
test("an empty page reports zero in the picker, the badge and the canvas alike", async ({
  browser,
}) => {
  const { context, page } = await openPanel(browser);

  const heatmap = page.getByTestId("click-heatmap");
  await heatmap.scrollIntoViewIfNeeded();
  await expect(heatmap).toBeVisible({ timeout: 30_000 });

  const picker = heatmap.getByLabel("Heatmap page");

  // Find a page the picker itself says has nothing, rather than hardcoding one —
  // which device classes are empty depends on the data.
  const empty = await picker
    .locator("option")
    .evaluateAll((els) =>
      els
        .filter((el) => /no clicks yet/i.test(el.textContent ?? ""))
        .map((el) => el.getAttribute("value")),
    );
  expect(empty.length, "no page reports zero, so this test proves nothing").toBeGreaterThan(0);

  await picker.selectOption(empty[0]!);

  // The badge must agree with the label.
  await expect(heatmap.getByText(/^0 clicks$/)).toBeVisible({ timeout: 20_000 });

  // And the canvas must be blank rather than showing invented points. Reading
  // the pixels is the only assertion that cannot be satisfied by a fabricated
  // grid — a present-but-empty canvas element would pass a count check.
  const blank = await heatmap.locator("canvas").evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx || canvas.width === 0 || canvas.height === 0) return true;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
    return true;
  });
  expect(blank, "the canvas drew points for a page reporting none").toBe(true);

  // And the empty state says so in words.
  await expect(heatmap.getByTestId("heatmap-empty")).toBeVisible();

  await context.close();
});

/**
 * The count is per device now, matching admin_click_map's own device filter. A
 * path-only count sat next to a per-device canvas, so a page could read "1,840"
 * and then draw an empty Mobile grid with nothing explaining the gap.
 */
test("switching device changes the counts the picker reports", async ({ browser }) => {
  // Seeded, for the same reason the pages table's footer test is: without it
  // this asserts a fact about whatever traffic production happened to have, and
  // /home having no sampled clicks in a 30-day window is an ordinary state at a
  // 25% sample rate, not a defect. Three mobile points and one tablet point, so
  // the two bands cannot agree by accident. Removed in the finally below and
  // swept again in afterAll.
  await seedClickPoints("/home");

  const { context, page } = await openPanel(browser);

  try {
    const heatmap = page.getByTestId("click-heatmap");
    await heatmap.scrollIntoViewIfNeeded();
    await expect(heatmap).toBeVisible({ timeout: 30_000 });

    const textFor = async (path: string) =>
      await heatmap
        .getByLabel("Heatmap page")
        .locator(`option[value="${path}"]`)
        .evaluate((el) => el.textContent ?? "");

    await heatmap.getByRole("button", { name: "Mobile", exact: true }).click();
    const onMobile = await textFor("/home");

    await heatmap.getByRole("button", { name: "Tablet", exact: true }).click();
    const onTablet = await textFor("/home");

    // "has a real count", not merely "says the word clicks" — the old assertion
    // was `toMatch(/clicks/i)`, which the empty state "no clicks yet" satisfies.
    // That is why an empty picker surfaced as a baffling equality failure on the
    // next line instead of saying there was no data.
    expect(onMobile, `mobile picker read "${onMobile}"`).toMatch(/\d+\s+clicks?/i);
    expect(onTablet, `tablet picker read "${onTablet}"`).toMatch(/\d+\s+clicks?/i);

    // Same page, different device, different figure — which is the whole point.
    // Before this the count came from a path-only grouping, so it did not move.
    expect(onTablet).not.toBe(onMobile);

    // And the panel says the counts are per width band, so the difference is
    // explained rather than looking like a glitch.
    await expect(heatmap.getByText(/counted\s+per width band/i)).toBeVisible();
  } finally {
    await context.close();
    await cleanupQaClickPoints();
  }
});

test("teardown leaves no seeded click points behind", async () => {
  // Invented coordinates in a production table. A failure here means a real
  // heatmap is carrying blobs nobody clicked.
  await cleanupQaClickPoints();
  expect(await countQaClickPoints()).toBe(0);
});

/**
 * The one page with no previewable URL.
 *
 * /shared/:slug is the normalised bucket every shared kundali is recorded under.
 * Framed literally it renders SharedKundali looking up a kundali whose slug is the
 * string ":slug", so the backdrop was an error state dressed as the shared page.
 * Deterministic, unlike the guard case below, which is why the withheld-backdrop
 * behaviour is asserted here.
 */
test("a dynamic route says it has no preview, and frames nothing", async ({ browser }) => {
  const { context, page } = await openPanel(browser);

  const heatmap = page.getByTestId("click-heatmap");
  await heatmap.scrollIntoViewIfNeeded();
  await expect(heatmap.locator("iframe")).toBeVisible({ timeout: 25_000 });

  await heatmap.getByLabel("Heatmap page").selectOption("/shared/:slug");

  await expect(heatmap.getByTestId("heatmap-no-preview")).toBeVisible({ timeout: 15_000 });
  await expect(heatmap.locator("iframe")).toHaveCount(0);
  // The coordinates are real, so the canvas stays — only the backdrop is absent.
  await expect(heatmap.locator("canvas")).toHaveCount(1);

  await context.close();
});

/**
 * The detector, and what it withholds.
 *
 * Guards now honour isHeatmapPreview(), so the ordinary cases no longer redirect
 * at all — that is the fix, and the test above walks all ten of them. This one is
 * defensive: whatever page still manages to redirect, BOTH the frame and the
 * canvas must be withheld. Hiding the canvas alone was the earlier half-fix, and
 * it left the wrong page on screen under the right label.
 */
test("if any page still redirects, both the frame and the overlay are withheld", async ({
  browser,
}) => {
  const { context, page } = await openPanel(browser);

  const heatmap = page.getByTestId("click-heatmap");
  await heatmap.scrollIntoViewIfNeeded();
  await expect(heatmap.locator("iframe")).toBeVisible({ timeout: 25_000 });

  const picker = heatmap.getByLabel("Heatmap page");
  const paths = await picker
    .locator("option")
    .evaluateAll((els) => els.map((el) => el.getAttribute("value")!).filter((v) => !v.includes(":")));

  for (const target of paths) {
    await picker.selectOption(target);
    await page.waitForTimeout(4500);

    if ((await heatmap.getByTestId("heatmap-mismatch").count()) === 0) continue;

    // The page is not shown at all, and neither is the heatmap.
    await expect(heatmap.locator("iframe")).toHaveCount(0);
    await expect(heatmap.locator("canvas")).toHaveCount(0);

    // The honest fallback keeps the coordinates while leaving the backdrop out.
    await heatmap.getByRole("button", { name: /without the page/i }).click();
    await expect(heatmap.locator("canvas")).toHaveCount(1, { timeout: 15_000 });
    await expect(heatmap.locator("iframe")).toHaveCount(0);

    await context.close();
    return;
  }

  // Nothing redirected, which is the intended state now that the guards honour the
  // preview flag. Not a failure — the assertions above simply had no case to run
  // against, and the ten-page walk earlier is what proves the fix.
  await context.close();
});

/**
 * The suppression must not work outside the panel.
 *
 * /payment skipping its hasPaid redirect puts the ₹99 offer back in front of a
 * paid user, who could start a second order. isHeatmapPreview() therefore also
 * requires a parent frame — so the same URL typed into a normal tab must behave
 * exactly as it always did.
 */
test("the preview flag does nothing in an unframed tab", async ({ browser }) => {
  const context = await browser.newContext();
  await applySession(context, adminSession);
  const page = await context.newPage();

  await page.goto("/payment?embed=true&preview=heatmap");
  await page.waitForTimeout(3000);

  // This fixture account has not paid, so /payment does not redirect for it
  // either way — what is asserted is that the page is NOT treating itself as a
  // preview, which is observable from the flag helper directly.
  const treatedAsPreview = await page.evaluate(() => {
    const params = new URLSearchParams(window.location.search);
    const flagged = params.get("embed") === "true" && params.get("preview") === "heatmap";
    return flagged && window.self !== window.top;
  });
  expect(treatedAsPreview, "an unframed tab must never count as a heatmap preview").toBe(false);

  await context.close();
});

test("the preview lays out at the selected device's width", async ({ browser }) => {
  const { context, page } = await openPanel(browser);

  const heatmap = page.getByTestId("click-heatmap");
  await heatmap.scrollIntoViewIfNeeded();
  const frame = heatmap.locator("iframe");
  await expect(frame).toBeVisible({ timeout: 20_000 });

  // Rendering at the panel's own width would put a desktop layout behind a
  // heatmap of mobile clicks — blobs next to elements that were never there.
  const widthFor = async (label: string) => {
    await heatmap.getByRole("button", { name: label, exact: true }).click();
    await page.waitForTimeout(2500);
    return frame.evaluate((el) => (el as HTMLIFrameElement).contentWindow?.innerWidth ?? 0);
  };

  expect(await widthFor("Mobile"), "mobile preview is not 390px wide").toBe(390);
  expect(await widthFor("Desktop"), "desktop preview is not 1440px wide").toBe(1440);
  expect(await widthFor("Tablet"), "tablet preview is not 834px wide").toBe(834);

  await context.close();
});

test("previewing the heatmap records no analytics of its own", async ({ browser }) => {
  const { context, page } = await openPanel(browser);

  const tracked: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("track-visit")) tracked.push(r.postData() ?? "");
  });

  const heatmap = page.getByTestId("click-heatmap");
  await heatmap.scrollIntoViewIfNeeded();
  await expect(heatmap.locator("iframe")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(5000);

  // Otherwise opening this panel writes rows — from the office IP — into the
  // very table it is displaying, and every number moves by being looked at.
  expect(tracked, `the preview tracked itself: ${tracked.join(" | ")}`).toEqual([]);

  await context.close();
});

// ─── Admin access ───────────────────────────────────────────────────────────

/**
 * Whether the deployed edge function knows the actions this card needs.
 *
 * `list-admins` and `set-admin`-by-email ship in this change; until
 * admin-user-management is redeployed the live one answers "invalid action". The
 * tests below therefore assert the panel's behaviour and skip the parts that
 * genuinely cannot work yet, rather than failing for a reason that has nothing
 * to do with the code under test.
 */
async function adminActionsDeployed(page: Page): Promise<boolean> {
  const card = page.getByTestId("admin-access");
  const error = card.getByTestId("admin-access-error");

  // Polled, not sampled once. `isVisible()` resolves immediately and ignores a
  // timeout option, so checking it the moment the card mounts reports "no error"
  // before the request has even returned — and the skip never fires.
  await expect
    .poll(
      async () =>
        (await error.count()) > 0 || (await card.locator("div[title]").count()) > 0,
      { timeout: 25_000 },
    )
    .toBe(true)
    .catch(() => {
      /* neither appeared; fall through and let the caller's assertions speak */
    });

  if ((await error.count()) === 0) return true;
  return !/invalid action/i.test((await error.textContent()) ?? "");
}

test("the admin list is visible above the user table", async ({ browser }) => {
  const { context, page } = await openPanel(browser);

  const card = page.getByTestId("admin-access");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible({ timeout: 30_000 });

  // Placement is the claim that holds regardless of deployment: the list of who
  // has full access must be readable without scrolling a paged table.
  await expect(page.locator("#admin-users").getByTestId("admin-access")).toHaveCount(1);
  const cardBox = (await card.boundingBox())!;
  const tableBox = (await page.locator("#admin-users table").first().boundingBox())!;
  expect(cardBox.y).toBeLessThan(tableBox.y);

  // The Make admin toggle on the user list stays — this card is an addition.
  await expect(page.locator("#admin-users").getByText("Make admin").first()).toBeVisible();

  if (await adminActionsDeployed(page)) {
    await expect(card.getByText(adminUser.email, { exact: false })).toBeVisible({ timeout: 20_000 });
  } else {
    // And when it cannot ask, it says so rather than showing an empty list —
    // "nobody is an admin" and "we could not check" are very different findings.
    await expect(card.getByTestId("admin-access-error")).toBeVisible();
    await expect(card.getByText("No admins found.")).toHaveCount(0);
  }

  await context.close();
});

test("you cannot remove your own access from the list", async ({ browser }) => {
  const { context, page } = await openPanel(browser);

  const card = page.getByTestId("admin-access");
  await card.scrollIntoViewIfNeeded();
  test.skip(!(await adminActionsDeployed(page)), "list-admins is not deployed yet");
  await expect(card.getByText(adminUser.email, { exact: false })).toBeVisible({ timeout: 30_000 });

  // Disabled with the reason on it, rather than a click that fails afterwards.
  const own = card.getByRole("button", { name: `Remove admin access for ${adminUser.email}` });
  await expect(own).toBeDisabled();
  await expect(own).toHaveAttribute("title", /cannot remove your own/i);

  await context.close();
});

test("granting by email works, and is reversible — on a fixture account only", async ({ browser }) => {
  const { context, page } = await openPanel(browser);

  const card = page.getByTestId("admin-access");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible({ timeout: 30_000 });
  test.skip(!(await adminActionsDeployed(page)), "set-admin by email is not deployed yet");

  // Safety: this address is created by this file's beforeAll and deleted in
  // afterAll. Never a real account.
  expect(victimUser.email).toMatch(/@vedicfinance-qa\.invalid$/);

  await card.getByLabel("New admin email").fill(victimUser.email);
  await card.getByRole("button", { name: "Make admin", exact: true }).click();

  await expect(card.getByTestId("admin-access-result")).toBeVisible({ timeout: 20_000 });

  // The account's own row, identified by its Remove control rather than by a
  // text search for the address. The card also renders a result banner naming
  // the same address, so a substring match cannot tell "is an admin" from "we
  // just said something about them" — and, after the removal below, could never
  // reach zero however correctly the row had gone. The grant worked; the
  // assertion did not.
  const removeControl = card.getByRole("button", {
    name: `Remove admin access for ${victimUser.email}`,
  });
  await expect(removeControl).toBeVisible({ timeout: 20_000 });

  await removeControl.click();
  await expect(removeControl).toHaveCount(0, { timeout: 20_000 });

  await context.close();
});

test("an email with no account is refused with a usable reason", async ({ browser }) => {
  const { context, page } = await openPanel(browser);

  const card = page.getByTestId("admin-access");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible({ timeout: 30_000 });

  await card.getByLabel("New admin email").fill("nobody-at-all@vedicfinance-qa.invalid");
  await card.getByRole("button", { name: "Make admin", exact: true }).click();

  const message = card.getByTestId("admin-access-error");
  await expect(message).toBeVisible({ timeout: 20_000 });

  // The claim that holds either way: a real reason survives to the operator.
  // "Edge Function returned a non-2xx status code" would not, and that is what
  // invokeAdmin exists to prevent.
  const text = (await message.textContent()) ?? "";
  expect(text).not.toMatch(/non-2xx/i);

  // Responses the CURRENTLY DEPLOYED function gives, because it predates
  // set-admin-by-email. Both are true statements about the deployment rather
  // than about the address, so the specific wording is asserted only once the
  // new version is live.
  const preDeploy = /invalid action|missing required field/i.test(text);
  if (!preDeploy) {
    expect(text).toMatch(/sign in|no account/i);
  }

  await context.close();
});
