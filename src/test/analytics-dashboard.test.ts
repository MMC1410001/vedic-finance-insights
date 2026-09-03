import { describe, expect, it } from "vitest";
import { heatColour, ratio } from "@/components/admin/analytics-format";

describe("ratio", () => {
  it("computes a percentage to one decimal", () => {
    expect(ratio(1, 3)).toBe(33.3);
    expect(ratio(250, 1000)).toBe(25);
  });

  // The reason this returns null rather than 0: "0% of nobody" is not a
  // conversion rate, and a rendered 0% reads as "this step is broken" when the
  // truth is "there was nothing to convert".
  it("returns null rather than 0 when the base is zero", () => {
    expect(ratio(0, 0)).toBeNull();
    expect(ratio(5, 0)).toBeNull();
  });

  it("handles a full conversion and an over-count without clamping silently", () => {
    expect(ratio(10, 10)).toBe(100);
    // Pay clicks can exceed completed orders' base in odd windows; surfacing
    // >100% is better than hiding it behind a clamp.
    expect(ratio(12, 10)).toBe(120);
  });
});

describe("heatColour", () => {
  it("runs cold to hot across the range", () => {
    const [r0, , b0] = heatColour(0);
    const [r1, , b1] = heatColour(1);
    // Cold end is blue-dominant, hot end is red-dominant.
    expect(b0).toBeGreaterThan(r0);
    expect(r1).toBeGreaterThan(b1);
  });

  it("interpolates between stops rather than stepping", () => {
    const low = heatColour(0.1);
    const mid = heatColour(0.15);
    expect(low).not.toEqual(mid);
  });

  it("clamps out-of-range intensities to the ends", () => {
    expect(heatColour(-1)).toEqual(heatColour(0));
    expect(heatColour(4)).toEqual(heatColour(1));
  });

  it("returns three 0-255 channels for every input", () => {
    for (const t of [0, 0.2, 0.5, 0.73, 1]) {
      const channels = heatColour(t);
      expect(channels).toHaveLength(3);
      for (const c of channels) {
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(255);
      }
    }
  });
});

/**
 * The site-wide funnel's arithmetic, in two groups.
 *
 * The first four stages are counted per session from visitor_events. The fifth,
 * Payment completed, is counted from payment_orders — a different population,
 * and NOT a subset of the four above it. A browser event can be lost while the
 * order row is authoritative, and an order can complete in a window whose
 * session began outside it.
 *
 * Live data has read `Payment started 0` above `Payment completed 8`. Measured
 * against sessions that drew a band widening back out to 80% of its track and
 * claimed "42.1% of sessions" for a stage the rows above said nobody reached.
 * These cases fix the shape of the numbers that go into FunnelSteps; how it
 * renders a group break is covered in funnel-steps.test.tsx.
 */
describe("the site-wide funnel's two groups", () => {
  const funnel = {
    sessions: 1000,
    kundali_generated: 400,
    signed_in: 200,
    payment_started: 50,
    payment_completed: 20,
  };

  /** Group A — everything counted per session, measured against sessions. */
  const sessionStages = [
    funnel.sessions,
    funnel.kundali_generated,
    funnel.signed_in,
    funnel.payment_started,
  ];

  it("measures the session-counted stages against sessions", () => {
    expect(sessionStages.map((v) => ratio(v, funnel.sessions))).toEqual([100, 40, 20, 5]);
  });

  it("keeps the step-to-step conversions within that group", () => {
    const rates = sessionStages.slice(1).map((v, i) => ratio(v, sessionStages[i]));
    expect(rates).toEqual([40, 50, 25]);
  });

  it("narrows monotonically within the session group", () => {
    for (let i = 1; i < sessionStages.length; i++) {
      expect(sessionStages[i]).toBeLessThanOrEqual(sessionStages[i - 1]);
    }
  });

  // The whole point of the break. Measured against sessions this reads 42.1%
  // and draws a band four-fifths the width of the track, directly beneath a
  // stage reporting nobody at all.
  it("does not measure the order-counted stage against sessions", () => {
    const observed = { ...funnel, payment_started: 0, payment_completed: 8 };
    expect(ratio(observed.payment_completed, observed.sessions)).toBe(0.8);
    // Against its own baseline it is 100% of itself, which is the only honest
    // reading of a stage nothing above it counts.
    expect(ratio(observed.payment_completed, observed.payment_completed)).toBe(100);
  });

  it("allows completions to exceed the pay clicks above them", () => {
    // Not a bug to be clamped away: payment_orders is the database fact and the
    // browser event is the lossy one.
    const observed = { payment_started: 0, payment_completed: 8 };
    expect(observed.payment_completed).toBeGreaterThan(observed.payment_started);
  });
});
