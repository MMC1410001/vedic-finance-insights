import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FunnelSteps, type FunnelStep } from "@/components/admin/FunnelSteps";

/**
 * The funnel's arithmetic contract.
 *
 * jsdom lays nothing out, so these read the inline width the component computes
 * rather than a rendered box. That is the right level: the defect this design
 * exists to prevent is a *computed* width above 100%, which would overflow the
 * track and assert a conversion rate that cannot happen.
 */

const step = (over: Partial<FunnelStep> & { key: string; value: number }): FunnelStep => ({
  label: over.key,
  note: "",
  ...over,
});

/** The width each bar's fill was given, in order, as a number of percent. */
function barWidths(steps: FunnelStep[]): number[] {
  const { container } = render(<FunnelSteps steps={steps} />);
  return Array.from(container.querySelectorAll<HTMLElement>("[style*='width']")).map((el) =>
    Number.parseFloat(el.style.width),
  );
}

function textOf(steps: FunnelStep[]): string {
  return render(<FunnelSteps steps={steps} />).container.textContent ?? "";
}

const SITE_FUNNEL: FunnelStep[] = [
  step({ key: "sessions", value: 1000 }),
  step({ key: "kundali", value: 400 }),
  step({ key: "signin", value: 200 }),
  step({ key: "paystart", value: 50 }),
  step({ key: "paid", value: 20 }),
];

describe("a single-group funnel", () => {
  it("measures every bar against the first step", () => {
    expect(barWidths(SITE_FUNNEL)).toEqual([100, 40, 20, 5, 2]);
  });

  it("reports each step's conversion from the one above, not from the top", () => {
    const text = textOf(SITE_FUNNEL);
    // 400 of 1000, then 200 of 400 — the step-to-step figure is the one that
    // says where people are lost, and is why this is not a recharts funnel.
    expect(text).toContain("40% of previous");
    expect(text).toContain("50% of previous");
    expect(text).toContain("25% of previous");
  });

  it("gives the first step no conversion figure — nothing precedes it", () => {
    const first = render(<FunnelSteps steps={[step({ key: "only", value: 10 })]} />);
    expect(first.container.textContent).not.toContain("of previous");
  });
});

describe("a group break", () => {
  // The campaign funnel's shape: four session-level stages, then two user-level
  // ones that are NOT a subset of them.
  const grouped: FunnelStep[] = [
    step({ key: "sessions", value: 100 }),
    step({ key: "kundali", value: 50 }),
    step({ key: "accounts", value: 40, groupStart: true, groupNote: "counted per user" }),
    step({ key: "paid", value: 10 }),
  ];

  it("restarts the baseline, so later bars are measured against the new group", () => {
    // 40 is 100% of its own group, not 40% of sessions; 10 is 25% of 40.
    expect(barWidths(grouped)).toEqual([100, 50, 100, 25]);
  });

  it("shows no conversion figure on the step that starts a group", () => {
    const text = textOf(grouped);
    // 50 of 100 and 10 of 40 are real; 40 of 50 would compare two different
    // bases and is deliberately absent.
    expect(text).toContain("50% of previous");
    expect(text).toContain("25% of previous");
    expect(text).not.toContain("80% of previous");
  });

  it("renders the divider caption explaining why the baseline changed", () => {
    expect(textOf(grouped)).toContain("counted per user");
  });
});

describe("the conversion that crosses a group break", () => {
  /**
   * A group of one — the site funnel's shape. Its share is 100% of itself and it
   * has no in-group predecessor, so regrouping silently deleted "payment started
   * → completed" from the funnel: the single most-read conversion on the panel,
   * gone from the place a reader looks for it. crossGroupNoun puts it back and
   * names the other side, which "of previous" would not have.
   */
  const withCross: FunnelStep[] = [
    step({ key: "sessions", value: 1000 }),
    step({ key: "paystart", label: "Payment started", value: 50 }),
    step({
      key: "paid",
      label: "Payment completed",
      value: 20,
      groupStart: true,
      baselineNoun: "payments",
      crossGroupNoun: "pay clicks",
    }),
  ];

  it("reports the group head against the last step above it", () => {
    expect(textOf(withCross)).toContain("40% of pay clicks");
  });

  it("names the other side rather than calling it 'previous'", () => {
    // The two are counted differently; that is what the break is for. A bare
    // "of previous" would read as the same measurement continuing.
    const text = textOf(withCross);
    expect(text).toContain("40% of pay clicks");
    expect(text).not.toContain("40% of previous");
  });

  it("still measures the band against its own baseline, not the step above", () => {
    // The band stays honest: 100% of payments. Drawing it at 40% of the pay
    // clicks is what produced bars wider than their track when the value
    // legitimately exceeded the stage above.
    expect(barWidths(withCross)).toEqual([100, 5, 100]);
  });

  it("says nothing across the break unless the funnel opts in", () => {
    const withoutCross = withCross.map((s) =>
      s.key === "paid" ? { ...s, crossGroupNoun: undefined } : s,
    );
    expect(textOf(withoutCross)).not.toContain("of pay clicks");
  });

  it("reports no figure when the stage above it is zero", () => {
    const emptyAbove = withCross.map((s) => (s.key === "paystart" ? { ...s, value: 0 } : s));
    // A share of nothing is not a share — same rule as every other ratio here.
    expect(textOf(emptyAbove)).not.toMatch(/of pay clicks/);
  });
});

describe("naming the baseline each share is measured against", () => {
  // Regression: the share was labelled "% of top" for every step, including the
  // ones measured against a group's own baseline. On the campaign funnel that
  // printed "Accounts created — 100% of top" on a funnel whose top was 1,885
  // sessions, which reads as "every session made an account".
  const grouped: FunnelStep[] = [
    step({ key: "sessions", label: "Sessions", value: 100 }),
    step({ key: "kundali", label: "Kundali", value: 50 }),
    step({
      key: "accounts",
      label: "Accounts created",
      value: 40,
      groupStart: true,
      baselineNoun: "accounts",
    }),
    step({ key: "paid", label: "Paid", value: 10 }),
  ];

  it("names each group's own baseline, never a single fixed word", () => {
    const text = textOf(grouped);
    expect(text).toContain("50% of sessions");
    expect(text).toContain("25% of accounts");
    expect(text).not.toContain("of top");
  });

  it("falls back to the group-start step's own label", () => {
    const text = textOf([
      step({ key: "a", label: "Visits", value: 10 }),
      step({ key: "b", label: "B", value: 5 }),
    ]);
    expect(text).toContain("50% of visits");
  });
});

describe("a group whose baseline is zero", () => {
  // The campaign that shows revenue with no in-window sessions — the row the
  // `full outer join` in admin_campaigns() exists to surface.
  const zeroBaseline: FunnelStep[] = [
    step({ key: "sessions", label: "Sessions", value: 0 }),
    step({ key: "kundali", label: "Kundali", value: 0 }),
    step({ key: "accounts", label: "Accounts", value: 0, groupStart: true }),
    step({ key: "paid", label: "Paid", value: 4 }),
  ];

  it("reports no share rather than dividing by an invented denominator", () => {
    // Regression: the baseline was floored at 1, so four paying users rendered
    // as "400% of top" — the exact impossible figure the group design exists to
    // prevent, printed instead of drawn.
    const text = textOf(zeroBaseline);
    expect(text).not.toContain("400%");
    expect(text).toContain("—");
  });

  it("still draws every band inside its track", () => {
    for (const width of barWidths(zeroBaseline)) {
      expect(width).toBeLessThanOrEqual(100);
      expect(width).toBeGreaterThan(0);
    }
  });

  it("keeps the step-to-step figure, which is still well defined", () => {
    // 4 of 0 is not, and must not appear; 0 of 0 likewise.
    expect(textOf(zeroBaseline)).not.toContain("Infinity");
    expect(textOf(zeroBaseline)).not.toContain("NaN");
  });
});

describe("the case the two-group design exists for", () => {
  // A September click that pays in November: the payment lands in this window
  // and the session does not, so paid legitimately exceeds sessions.
  const lateConversion: FunnelStep[] = [
    step({ key: "sessions", value: 2 }),
    step({ key: "accounts", value: 30, groupStart: true }),
    step({ key: "paid", value: 12 }),
  ];

  it("never computes a bar wider than its own track", () => {
    for (const width of barWidths(lateConversion)) {
      expect(width).toBeLessThanOrEqual(100);
    }
  });

  it("clamps the bar without hiding the real number", () => {
    // ratio() is deliberately unclamped, and the text must keep telling the
    // truth even where the bar cannot.
    const flat: FunnelStep[] = [step({ key: "a", value: 10 }), step({ key: "b", value: 25 })];
    expect(barWidths(flat)).toEqual([100, 100]);
    expect(textOf(flat)).toContain("250%");
  });
});

describe("empty and degenerate input", () => {
  it("renders a zero funnel without NaN or Infinity", () => {
    const zeros = [step({ key: "a", value: 0 }), step({ key: "b", value: 0 })];
    const text = textOf(zeros);
    expect(text).not.toMatch(/NaN|Infinity/);
    expect(barWidths(zeros)).toEqual([2, 2]);
  });

  it("floors a real but tiny share at a visible sliver", () => {
    const tiny = [step({ key: "a", value: 100_000 }), step({ key: "b", value: 1 })];
    expect(barWidths(tiny)).toEqual([100, 2]);
  });

  it("renders nothing rather than throwing on an empty list", () => {
    expect(() => render(<FunnelSteps steps={[]} />)).not.toThrow();
  });
});

describe("the drop-off warning", () => {
  const rateClass = (from: number, to: number) => {
    const { container } = render(
      <FunnelSteps steps={[step({ key: "a", value: from }), step({ key: "b", value: to })]} />,
    );
    // The innermost span: the count's wrapper contains this one, so its
    // textContent matches too and a plain find() would return the parent.
    return Array.from(container.querySelectorAll("span")).find(
      (el) => el.children.length === 0 && el.textContent?.includes("of previous"),
    )?.className;
  };

  it("warns below 25% and not at or above it", () => {
    expect(rateClass(100, 24)).toContain("text-admin-warn");
    expect(rateClass(100, 25)).not.toContain("text-admin-warn");
    expect(rateClass(100, 60)).not.toContain("text-admin-warn");
  });
});
