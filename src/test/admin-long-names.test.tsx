import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Identity cells must not be set up to clip.
 *
 * The Users table capped its Username cell at `max-w-[120px]` with `truncate`,
 * so a real name arrived as "Mayur C…" — and because the cap was unconditional
 * it did that at every viewport, not just on a phone. Three more tables did the
 * same to names, places and IPs.
 *
 * ── Why this asserts on classes, which is usually the wrong instinct ─────────
 * `truncate` is `text-overflow: ellipsis`, a paint-time effect. It does not
 * change `textContent`, and jsdom applies no Tailwind and lays nothing out — so
 * a test that reads the rendered text passes just as happily with the bug
 * present. The first version of this file did exactly that and proved nothing.
 *
 * What jsdom *can* see is the markup, so that is what is pinned here: a guard
 * against someone reintroducing a clipping class on an identity cell. The real
 * assertion — the cell's scrollWidth does not exceed its clientWidth in a
 * browser, at 390px and at 1440px — is in e2e/admin-responsive.spec.ts.
 *
 * Its own mock rather than an extra row in AdminPanel.test.tsx: that file makes
 * exact-equality assertions about sort order, and a fourth user would have to be
 * threaded through every one of them.
 */

const LONG_NAME = "Rajanikanth Venkataraghavan Subramanian";
const LONG_EMAIL = "rajanikanth.venkataraghavan.subramanian@a-very-long-domain.example.com";

const USERS = [
  {
    id: "u1",
    email: LONG_EMAIL,
    full_name: LONG_NAME,
    has_paid: false,
    onboarding_done: true,
    is_admin: false,
    created_at: "2026-01-01T00:00:00Z",
    share_slug: "s1",
  },
];

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn((_name: string, opts: { body: { action: string } }) => {
        if (opts?.body?.action === "list-users") {
          return Promise.resolve({ data: { users: USERS }, error: null });
        }
        return Promise.resolve({ data: null, error: { message: "not deployed" } });
      }),
    },
  },
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "other", email: "someone@example.com" }, signOut: vi.fn() }),
}));

import Admin from "@/pages/Admin";

const renderAdmin = async () => {
  render(<MemoryRouter><Admin /></MemoryRouter>);
  await waitFor(() => expect(screen.getAllByText(LONG_NAME).length).toBeGreaterThan(0), {
    timeout: 5000,
  });
};

const usersSection = () => document.getElementById("admin-users")!;

/** Every element carrying the value, plus each one's enclosing cell. */
const holdersOf = (value: string) =>
  [...usersSection().querySelectorAll("*")].filter(
    (el) => el.textContent?.trim() === value && el.children.length === 0,
  );

describe("long identities in the Users table", () => {
  it("puts no clipping class on the name, in either layout", async () => {
    await renderAdmin();

    // Both layouts are in the DOM at once — only CSS decides which shows — so
    // the table cell and the mobile card are both covered by this.
    const holders = holdersOf(LONG_NAME);
    expect(holders.length).toBeGreaterThanOrEqual(2);

    for (const el of holders) {
      expect(el.className, `truncate on a name: ${el.className}`).not.toMatch(/\btruncate\b/);
      // The cap is half the defect: `truncate` needs a bounded width to bite,
      // and a bare max-w would clip via overflow even without it.
      const cell = el.closest("td, div");
      expect(cell?.className ?? "", `max-w cap on a name cell`).not.toMatch(/\bmax-w-\[/);
    }
  });

  it("puts no clipping class on the email", async () => {
    await renderAdmin();
    const holders = holdersOf(LONG_EMAIL);
    expect(holders.length).toBeGreaterThanOrEqual(1);
    for (const el of holders) {
      expect(el.className).not.toMatch(/\btruncate\b/);
    }
  });

  it("lets a long name break, so it wraps instead of overflowing its cell", async () => {
    await renderAdmin();
    // Removing `truncate` alone is not enough: without a break rule a long
    // unbroken value pushes the column instead of wrapping inside it.
    const holders = holdersOf(LONG_NAME);
    for (const el of holders) {
      expect(el.className, `no break rule: ${el.className}`).toMatch(/break-(words|all)/);
    }
  });

  it("keeps the name reachable as a title, for a quick read on hover", async () => {
    await renderAdmin();
    expect(usersSection().querySelectorAll(`[title="${LONG_NAME}"]`).length).toBeGreaterThan(0);
  });

  it("still labels the stage", async () => {
    await renderAdmin();
    expect(screen.getAllByText("Awaiting Payment").length).toBeGreaterThan(0);
  });
});
