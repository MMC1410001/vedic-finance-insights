import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * Drives the real Visitors & IPs panel down its dev-mock path.
 *
 * The mock only engages when the live query returns nothing, so this mocks
 * `invoke` to fail exactly the way the undeployed edge function does. That makes
 * this the one test covering the state an operator actually sees today, and it
 * guards the two things most likely to silently regress: the mock drifting out
 * of shape with VisitorSession, and the identity column losing its data.
 */
vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() =>
        Promise.resolve({
          data: null,
          error: { message: "Edge Function returned a non-2xx status code" },
        }),
      ),
    },
  },
}));

import { VisitorSessions } from "@/components/admin/VisitorSessions";

async function renderExpanded() {
  render(<VisitorSessions />);
  await waitFor(() => expect(screen.getByText("SAMPLE DATA")).toBeTruthy(), { timeout: 5000 });
  // The panel is expanded by default — the section nav jumps straight to it, and
  // landing on a collapsed header reads as a broken link. Asserting the control
  // says "Collapse" pins that default: if it flips back the click below returns.
  expect(await screen.findByLabelText("Collapse")).toBeTruthy();
  await waitFor(() => expect(screen.getAllByText("User").length).toBeGreaterThan(0), {
    timeout: 5000,
  });
  return document.body.textContent ?? "";
}

describe("VisitorSessions, identity column", () => {
  it("falls back to sample data instead of showing the error box", async () => {
    await renderExpanded();
    expect(screen.queryByText(/Could not load visitor sessions/)).toBeNull();
  });

  it("shows an email for signed-in sessions", async () => {
    const body = await renderExpanded();
    expect(body).toMatch(/@example\.com/);
  });

  it("shows a name for guest sessions", async () => {
    const body = await renderExpanded();
    // Any of the sample names is fine; the point is that guests are not blank.
    expect(body).toMatch(/Aarti Deshpande|Kabir Malhotra|Vikram Rao|Sneha Iyer/);
  });

  it("labels the preview so it cannot be mistaken for real traffic", async () => {
    await renderExpanded();
    expect(screen.getByText("SAMPLE DATA")).toBeTruthy();
  });
});
