import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";

/**
 * Mounts the real /admin page.
 *
 * Worth doing at this level rather than against extracted pieces, because the
 * two things most likely to break are wiring, not logic: the Users table is
 * hand-rolled (AdminTable cannot host its expandable rows) so its sort headers
 * are wired separately and can drift from the shared ones, and the funnel counts
 * are now rendered twice from one provider — the whole point being that the two
 * copies cannot disagree.
 */

const USERS = [
  { id: "u1", email: "zoe@example.com", full_name: "Zoe", has_paid: true, onboarding_done: true, is_admin: false, created_at: "2026-01-01T00:00:00Z", share_slug: "zoe" },
  { id: "u2", email: "adam@example.com", full_name: "Adam", has_paid: false, onboarding_done: true, is_admin: false, created_at: "2026-03-01T00:00:00Z", share_slug: null },
  { id: "u3", email: null, full_name: "Nobody", has_paid: false, onboarding_done: false, is_admin: true, created_at: "2026-02-01T00:00:00Z", share_slug: null },
];

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn((_name: string, opts: { body: { action: string } }) => {
        if (opts?.body?.action === "list-users") return Promise.resolve({ data: { users: USERS }, error: null });
        // Everything else is out of scope here; an error is also the state the
        // undeployed functions are actually in.
        return Promise.resolve({ data: null, error: { message: "not deployed" } });
      }),
    },
  },
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1", email: "zoe@example.com" }, signOut: vi.fn() }),
}));

import Admin from "@/pages/Admin";
import { ADMIN_SECTIONS } from "@/components/admin/admin-sections";

const renderAdmin = async () => {
  // The sidebar logo is a <Link>, so the tree needs a router.
  render(<MemoryRouter><Admin /></MemoryRouter>);
  // getAllByText, not getByText: "Total Users" now appears twice by design —
  // once in Analytics and once above the table — and getByText throws on more
  // than one match.
  await waitFor(() => expect(screen.getAllByText("zoe@example.com").length).toBeGreaterThan(0), {
    timeout: 5000,
  });
};

/*
 * Both helpers scope to the Users section on purpose. The page holds four
 * tables, several share column names ("Email", "Created"), and under vitest
 * `import.meta.env.DEV` is true so the Visitors panel fills itself with sample
 * rows — an unscoped query silently reads the wrong table, which is how the
 * first version of this test "passed".
 */
const usersSection = () => document.getElementById("admin-users")!;

/** Emails down the Users table, in visible order. */
const emailColumn = () =>
  [...usersSection().querySelectorAll("table tbody > tr")]
    // The expanded-kundali row has a single colspan cell; skip it.
    .filter((tr) => tr.children.length > 2)
    .map((tr) => tr.children[1]?.textContent?.trim())
    .filter(Boolean);

const clickUserHeader = (label: string) => {
  const btn = [...usersSection().querySelectorAll("thead button")].find((b) =>
    b.textContent?.trim().startsWith(label),
  );
  expect(btn, `no sortable "${label}" header in the Users table`).toBeTruthy();
  act(() => (btn as HTMLElement).click());
};

describe("Admin panel", () => {
  it("renders every section as a scroll anchor, in the declared order", async () => {
    await renderAdmin();

    const ids = ADMIN_SECTIONS.map((section) => section.id);
    for (const id of ids) {
      expect(document.getElementById(id), id).toBeTruthy();
    }

    // Driven off ADMIN_SECTIONS rather than a hardcoded list, so adding a
    // section cannot leave this test passing while the anchor is missing.
    const rendered = [...document.querySelectorAll("section[id^='admin-']")].map((el) => el.id);
    expect(rendered).toEqual(ids);
  });

  it("shows the same funnel numbers in Analytics and in Users", async () => {
    await renderAdmin();
    // 3 users: 1 paid, 1 awaiting, 1 onboarding. Both copies read one provider,
    // so each label appears twice with the same value beside it.
    expect(screen.getAllByText("Total Users")).toHaveLength(2);
    expect(screen.getAllByText("Active (Paid)")).toHaveLength(2);
    const totals = screen.getAllByText("3");
    expect(totals.length).toBeGreaterThanOrEqual(2);
  });

  it("sorts the hand-rolled Users table by email", async () => {
    await renderAdmin();
    expect(emailColumn()).toEqual(["zoe@example.com", "adam@example.com", "—"]);

    clickUserHeader("Email");
    // Ascending, with the account that has no email last rather than first.
    expect(emailColumn()).toEqual(["adam@example.com", "zoe@example.com", "—"]);

    clickUserHeader("Email");
    expect(emailColumn()).toEqual(["zoe@example.com", "adam@example.com", "—"]);
  });

  it("sorts Stage by funnel position, not alphabetically", async () => {
    await renderAdmin();
    // descFirst, so one click puts the furthest-along user on top. Alphabetical
    // would give Active, Awaiting Payment, Onboarding — progress backwards.
    clickUserHeader("Stage");
    expect(emailColumn()[0]).toBe("zoe@example.com"); // paid
    clickUserHeader("Stage");
    expect(emailColumn()[0]).toBe("—"); // u3, still onboarding
  });

  it("leaves the # and Action columns unsortable", async () => {
    await renderAdmin();
    const ths = [...usersSection().querySelectorAll("table th")];
    const num = ths.find((th) => th.textContent?.trim() === "#");
    const action = ths.find((th) => th.textContent?.trim() === "Action");
    expect(num?.querySelector("button")).toBeNull();
    expect(action?.querySelector("button")).toBeNull();
  });
});
