import { describe, expect, it, beforeEach, vi } from "vitest";
// fireEvent rather than user-event: that package is not a dependency here, and
// a plain click is all these assertions need.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: { ok: true }, error: null })),
    },
  },
}));

import { RouteTracker } from "@/components/RouteTracker";
import { __peekQueue, __resetQueue } from "@/lib/event-queue";
import { __resetClickTracking } from "@/lib/click-tracking";

function Jump({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>{label}</button>;
}

function Harness({ start = "/home" }: { start?: string }) {
  return (
    <MemoryRouter initialEntries={[start]}>
      <RouteTracker />
      <Routes>
        <Route path="/home" element={<Jump to="/auth" label="to auth" />} />
        <Route path="/auth" element={<Jump to="/payment" label="to payment" />} />
        <Route path="/payment" element={<span>payment</span>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  sessionStorage.clear();
  __resetQueue();
  __resetClickTracking();
});

describe("RouteTracker", () => {
  // App.tsx already sends trackVisit("visit") immediately for the first load,
  // because that is the request that records the session's IP. A page_view here
  // too would double-count the landing page in every table.
  it("does not emit a page_view for the route it mounts on", () => {
    render(<Harness />);
    expect(__peekQueue().filter((e) => e.event === "page_view")).toHaveLength(0);
  });

  it("emits one page_view per navigation, naming the path it came from", async () => {
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "to auth" }));
    });

    const views = __peekQueue().filter((e) => e.event === "page_view");
    expect(views).toHaveLength(1);
    // The event names the path arrived at...
    expect(views[0].path).toBe("/auth");
    // ...and carries where it came from, which is what makes a path sequence
    // reconstructable.
    expect(views[0].props).toMatchObject({ from: "/home" });
  });

  // The convention the SQL depends on: duration_ms on a page_view is the dwell
  // on the PREVIOUS path, which admin_analytics() pulls forward with lead().
  it("carries the dwell on the previous path, not the new one", async () => {
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "to auth" }));
    });
    const [view] = __peekQueue().filter((e) => e.event === "page_view");

    expect(typeof view.duration_ms).toBe("number");
    expect(view.duration_ms!).toBeGreaterThanOrEqual(0);
  });

  it("tracks a chain of navigations in order", async () => {
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "to auth" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "to payment" }));
    });

    const views = __peekQueue().filter((e) => e.event === "page_view");
    expect(views.map((v) => v.path)).toEqual(["/auth", "/payment"]);
    expect(views.map((v) => v.props?.from)).toEqual(["/home", "/auth"]);
  });

  it("renders nothing", () => {
    const { container } = render(
      <MemoryRouter>
        <RouteTracker />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
