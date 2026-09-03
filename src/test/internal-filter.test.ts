import { describe, expect, it } from "vitest";
import { describeInternal } from "@/components/admin/analytics-format";

const summary = (over: Partial<Parameters<typeof describeInternal>[0]> = {}) => ({
  excluded: true,
  sessions_matched: 214,
  networks_active: 3,
  accounts_active: 6,
  ...over,
});

describe("describeInternal", () => {
  it("says what is hidden while filtering", () => {
    const notice = describeInternal(summary())!;
    expect(notice.headline).toContain("Showing real users");
    expect(notice.headline).toContain("214");
    expect(notice.headline).toContain("hidden");
    expect(notice.tone).toBe("muted");
  });

  // Stated in BOTH modes on purpose. If the count only appeared while filtering,
  // the two totals would differ between visits with nothing on screen to explain
  // the difference.
  it("says what is included when not filtering, and warns", () => {
    const notice = describeInternal(summary({ excluded: false }))!;
    expect(notice.headline).toContain("all traffic");
    expect(notice.headline).toContain("214");
    expect(notice.headline).toContain("counted");
    // Warn tone only when internal traffic is actually inflating the numbers.
    expect(notice.tone).toBe("warn");
  });

  /**
   * The failure mode this function exists to prevent.
   *
   * Filter-on-nothing-matched and filter-off-nothing-matched produce identical
   * totals. If they also produced identical wording, a reader could not tell
   * whether the filter was working or simply had nothing to do — and that is how
   * a filtered number eventually gets quoted as a real one.
   */
  it("distinguishes 'nothing matched' from 'not filtering'", () => {
    const filtering = describeInternal(summary({ sessions_matched: 0 }))!;
    const notFiltering = describeInternal(summary({ sessions_matched: 0, excluded: false }))!;

    expect(filtering.headline).not.toBe(notFiltering.headline);
    expect(filtering.headline).toContain("real users");
    expect(notFiltering.headline).toContain("all traffic");
  });

  it("does not warn when nothing internal happened, even unfiltered", () => {
    // Nothing is being inflated, so a warning would be noise.
    expect(describeInternal(summary({ sessions_matched: 0, excluded: false }))!.tone).toBe("muted");
  });

  it("prompts for setup when no rules exist at all", () => {
    const notice = describeInternal(
      summary({ networks_active: 0, accounts_active: 0, sessions_matched: 0 }),
    )!;
    expect(notice.detail).toContain("No internal networks or accounts");
  });

  it("counts rules in the singular where there is one", () => {
    const notice = describeInternal(
      summary({ networks_active: 1, accounts_active: 1, sessions_matched: 1 }),
    )!;
    expect(notice.detail).toContain("1 network and 1 account");
    expect(notice.detail).not.toContain("networks");
    expect(notice.headline).toContain("1 internal session hidden");
  });

  it("formats large counts for an Indian reader", () => {
    // en-IN grouping, matching every other number in the panel.
    expect(describeInternal(summary({ sessions_matched: 123456 }))!.headline).toContain("1,23,456");
  });

  it("returns null when the server sent no internal block", () => {
    // An older deployed RPC would omit it; rendering nothing beats rendering
    // "0 hidden", which would be a claim the server never made.
    expect(describeInternal(undefined)).toBeNull();
  });
});
