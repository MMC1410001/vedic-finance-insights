/**
 * The admin panel's shape, at a phone width and at a desktop width.
 *
 * Three defects prompted this file, and each assertion below is the direct check
 * on one of them rather than a proxy:
 *
 *  1. Names arrived clipped ("Mayur C…") from an unconditional `max-w-[120px]`
 *     plus `truncate`. Checked as scrollWidth vs clientWidth — the only way to
 *     see paint-time clipping. A jsdom test cannot: `text-overflow` does not
 *     change textContent.
 *  2. "Awaiting Payment" rendered as two half pills. The badge was a plain
 *     `inline` span, and a non-atomic inline that breaks over two lines has its
 *     border-radius applied at each fragment's own boundaries — hence two
 *     half-pills stacked up. The cure is `inline-flex`, which makes the badge an
 *     atomic inline that line breaking cannot split, and that is asserted on
 *     computed display. The client-rect survey backs it up by catching a bare
 *     rounded-full inline introduced somewhere new.
 *  3. Controls were as small as 27px on a phone, the mobile-only sort select
 *     among them — and that select is the only way to sort anything there, the
 *     column headers being desktop-only.
 *
 * All three run at both widths on purpose. Defect 1 was NOT mobile-specific, and
 * assuming it was is what let it survive so long.
 */

import { test, expect } from "@playwright/test";
import { createTestUser, setAdmin, cleanup, type TestUser } from "./helpers/supabase-admin";
import { signInHeadless, applySession } from "./helpers/session";

let adminUser: TestUser;
let adminSession: unknown;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  adminUser = await createTestUser("responsive-admin");
  adminSession = await signInHeadless(adminUser);
  // This file's own fixture. Never a real account.
  await setAdmin(adminUser.id, true);
});

test.afterAll(async () => {
  await cleanup([adminUser?.id].filter(Boolean) as string[]);
});

const MOBILE = { width: 390, height: 780 };
const DESKTOP = { width: 1440, height: 900 };

async function openAdmin(
  browser: import("@playwright/test").Browser,
  viewport: { width: number; height: number },
) {
  const context = await browser.newContext({ viewport });
  await applySession(context, adminSession);
  const page = await context.newPage();
  await page.goto("/admin");
  await expect(page.locator("#admin-overview")).toBeVisible({ timeout: 30_000 });

  // Six blocks fetch independently and several mount lazily on scroll, so walk
  // the page before measuring anything — an unmounted section cannot be wrong.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(2500);

  // Wait for the Users table to actually hold rows. Without this the surveys
  // below can pass vacuously: the table sometimes has not landed yet, and
  // "no clipped text" is trivially true of a page with no data on it. Seen for
  // real while writing this file — one run reported zero tables in the section.
  await expect
    .poll(
      () => page.locator("#admin-users table tbody tr").count(),
      { timeout: 30_000, message: "the Users table never rendered any rows" },
    )
    .toBeGreaterThan(1);

  return { context, page };
}

for (const viewport of [MOBILE, DESKTOP]) {
  const label = `${viewport.width}px`;

  test(`no pill is sliced across two lines at ${label}`, async ({ browser }) => {
    const { context, page } = await openAdmin(browser, viewport);

    const sliced = await page.evaluate(() =>
      [...document.querySelectorAll("span, button")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          // Only fully-rounded boxes are at risk; a rounded-lg badge wraps fine.
          return getComputedStyle(el).borderRadius.includes("9999");
        })
        // More than one client rect means the inline box was broken over lines,
        // which is exactly what draws the half pills.
        .filter((el) => el.getClientRects().length > 1)
        .map((el) => {
          const section = el.closest("section[id]")?.id ?? "(header)";
          return `${section}: "${(el.textContent ?? "").trim().slice(0, 40)}"`;
        }),
    );

    expect(sliced, `pills broken across lines at ${label}`).toEqual([]);
    await context.close();
  });

  test(`no identity is clipped at ${label}`, async ({ browser }) => {
    const { context, page } = await openAdmin(browser, viewport);

    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll("span, td, p, a")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          const cs = getComputedStyle(el);
          if (cs.textOverflow !== "ellipsis") return false;
          return el.scrollWidth > el.clientWidth + 1;
        })
        .map((el) => {
          const section = el.closest("section[id]")?.id ?? "(header)";
          const text = (el.textContent ?? "").trim().slice(0, 40);
          // The raw user-agent column is the one deliberate exception: ~150
          // characters of machine string, kept clipped with a title attribute.
          return `${section}: "${text}"`;
        })
        .filter((d) => !/Mozilla|AppleWebKit/.test(d)),
    );

    expect(clipped, `text clipped with an ellipsis at ${label}`).toEqual([]);
    await context.close();
  });

  test(`the page never scrolls sideways at ${label}`, async ({ browser }) => {
    const { context, page } = await openAdmin(browser, viewport);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `the page scrolls horizontally at ${label}`).toBeLessThanOrEqual(1);

    // A table may scroll inside its own wrapper — that is the design — but
    // nothing else may push past the viewport.
    const escaping = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return [...document.querySelectorAll("*")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > vw + 1 && !el.closest(".overflow-x-auto");
        })
        .map((el) => `${el.closest("section[id]")?.id ?? "(header)"}: ${el.tagName.toLowerCase()}`)
        .slice(0, 10);
    });
    expect([...new Set(escaping)], `elements past the viewport at ${label}`).toEqual([]);
    await context.close();
  });
}

/**
 * The actual cure, asserted directly: a badge must not be a plain inline box.
 *
 * The defect was a `<span>` with default `display: inline`. A non-atomic inline
 * that breaks over two lines has its border-radius applied at each fragment's
 * boundaries, which is what drew two half-pills. `inline-flex` makes the badge
 * an ATOMIC inline — it cannot be split by line breaking at all, so the defect
 * becomes unreachable.
 *
 * Worth recording why this replaced two earlier attempts, both of which passed
 * with the fix removed and therefore proved nothing:
 *
 *   - Counting client rects cannot fail for an atomic box; it reports 1 by
 *     construction. It is still useful in the survey above, where it catches a
 *     bare rounded-full inline being introduced somewhere new.
 *   - Squeezing a pill's max-width does not wrap its label either. A flex item's
 *     `min-width: auto` floors at min-content, so the text overflows instead of
 *     breaking — meaning `whitespace-nowrap` is belt-and-braces here rather than
 *     the load-bearing part, and no width can prove it.
 *
 * Computed display is what remains, and it is exactly the property that fixes
 * the bug. Revert any Pill call site to a plain span and this fails.
 */
test("no rounded badge is a plain inline box", async ({ browser }) => {
  const { context, page } = await openAdmin(browser, DESKTOP);

  const offenders = await page.evaluate(() => {
    const bad: string[] = [];
    for (const el of [...document.querySelectorAll("span, a")]) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (!cs.borderRadius.includes("9999")) continue;
      // Only `inline` is dangerous; inline-flex / inline-block / block are all
      // atomic or block-level and cannot be split across lines.
      if (cs.display !== "inline") continue;
      const section = el.closest("section[id]")?.id ?? "(header)";
      bad.push(`${section}: "${(el.textContent ?? "").trim().slice(0, 40)}"`);
    }
    return [...new Set(bad)];
  });

  expect(
    offenders,
    "fully-rounded badges rendering as plain inline boxes — these slice in half when they wrap",
  ).toEqual([]);

  await context.close();
});

test("every control is tappable at 390px", async ({ browser }) => {
  const { context, page } = await openAdmin(browser, MOBILE);

  const small = await page.evaluate(() =>
    [...document.querySelectorAll("button, select, input, a, [role=button]")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        // Zero-sized means display:none — the desktop tables are hidden here, so
        // their controls are correctly out of scope.
        return r.width > 0 && r.height > 0 && r.height < 44;
      })
      .map((el) => {
        const section = el.closest("section[id]")?.id ?? "(header)";
        const h = Math.round(el.getBoundingClientRect().height);
        return `${h}px ${section}: ${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}"`;
      }),
  );

  expect([...new Set(small)], "controls under 44px at 390px").toEqual([]);
  await context.close();
});

/**
 * The mobile sort control is the only way to sort on a phone — the column
 * headers live in the `hidden sm:block` table — so a regression here is silent
 * rather than visible, which is why it gets its own test.
 */
test("the mobile sort control still sorts, at 44px", async ({ browser }) => {
  const { context, page } = await openAdmin(browser, MOBILE);

  const users = page.locator("#admin-users");
  const sort = users.getByLabel("Sort column").first();
  await sort.scrollIntoViewIfNeeded();
  await expect(sort).toBeVisible();

  const box = (await sort.boundingBox())!;
  expect(box.height, "the only mobile sort control is under 44px").toBeGreaterThanOrEqual(44);

  // Card order before and after, read off the cards rather than the table.
  const order = () =>
    users.locator("div.sm\\:hidden > div").evaluateAll((els) =>
      els.map((el) => el.querySelector("p")?.textContent?.trim() ?? ""),
    );

  const before = await order();
  await sort.selectOption({ label: "Username" });
  await page.waitForTimeout(400);
  const after = await order();

  expect(before.length, "no user cards rendered").toBeGreaterThan(1);
  expect(after, "selecting a sort column changed nothing").not.toEqual(before);

  await context.close();
});
