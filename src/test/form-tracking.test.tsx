/**
 * field_focus — the drop the funnel cannot see.
 *
 * A visitor who opens the birth-details form and abandons it is absent from every
 * existing count: the funnel's first step is kundali_generated, so they are
 * indistinguishable from someone who never looked at the form.
 *
 * As with the other three signals, the first property asserted is negative:
 * nothing here may reach window.dataLayer.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: { ok: true }, error: null })),
    },
  },
}));

import { fireEvent, render, screen } from "@testing-library/react";
import { __peekQueue, __resetQueue } from "@/lib/event-queue";
import { useFormFieldTracking } from "@/lib/form-tracking";

function Harness() {
  const tracking = useFormFieldTracking("birth-details");
  return (
    <form {...tracking}>
      <input id="full_name" aria-label="Name" />
      {/* A group of sub-inputs, like the real dd/mm/yyyy trio plus the sr-only
          native picker. All four must report as ONE field. */}
      <div data-af-field="birth_date">
        <input aria-label="Day" />
        <input aria-label="Month" />
        <input aria-label="Year" />
      </div>
      <input name="birth_place" aria-label="Place" />
      {/* Unnamed and ungrouped: nothing to report, and reporting it as
          "(unidentified)" would put a row in the funnel that names no field. */}
      <input aria-label="Anonymous" />
    </form>
  );
}

beforeEach(() => {
  sessionStorage.clear();
  __resetQueue();
  delete (window as { dataLayer?: unknown }).dataLayer;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useFormFieldTracking", () => {
  it("reports each named field once, in the order they were met", () => {
    render(<Harness />);

    fireEvent.focus(screen.getByLabelText("Name"));
    fireEvent.focus(screen.getByLabelText("Day"));
    fireEvent.focus(screen.getByLabelText("Place"));

    const rows = __peekQueue().filter((e) => e.event === "field_focus");
    expect(rows.map((r) => r.props)).toEqual([
      { form: "birth-details", field: "full_name", order: 1 },
      { form: "birth-details", field: "birth_date", order: 2 },
      { form: "birth-details", field: "birth_place", order: 3 },
    ]);
  });

  it("treats a group of sub-inputs as one field", () => {
    // Otherwise dd, mm, yyyy and the sr-only picker are four rows that have to be
    // added back together before they mean anything.
    render(<Harness />);

    fireEvent.focus(screen.getByLabelText("Day"));
    fireEvent.focus(screen.getByLabelText("Month"));
    fireEvent.focus(screen.getByLabelText("Year"));

    const rows = __peekQueue().filter((e) => e.event === "field_focus");
    expect(rows).toHaveLength(1);
    expect(rows[0].props).toMatchObject({ field: "birth_date" });
  });

  it("does not report a field it cannot name", () => {
    render(<Harness />);
    fireEvent.focus(screen.getByLabelText("Anonymous"));
    expect(__peekQueue().filter((e) => e.event === "field_focus")).toHaveLength(0);
  });

  it("reports a refocused field only once", () => {
    // The question is "how many people reached this field", so a visitor who tabs
    // back and forth is still one person who reached it.
    render(<Harness />);

    fireEvent.focus(screen.getByLabelText("Name"));
    fireEvent.focus(screen.getByLabelText("Place"));
    fireEvent.focus(screen.getByLabelText("Name"));

    expect(__peekQueue().filter((e) => e.event === "field_focus")).toHaveLength(2);
  });

  it("never touches dataLayer", () => {
    render(<Harness />);
    fireEvent.focus(screen.getByLabelText("Name"));

    expect(__peekQueue().length).toBeGreaterThan(0);
    expect(window.dataLayer).toBeUndefined();
  });
});
