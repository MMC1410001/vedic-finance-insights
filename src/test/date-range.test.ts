import { describe, expect, it } from "vitest";
import {
  describeRange,
  istDateString,
  istEndOfDay,
  istStartOfDay,
  resolveRange,
} from "@/components/admin/analytics-format";

/** 20 Aug 2026, 02:00 IST — which is 19 Aug 20:30 UTC. */
const LATE_NIGHT_IST = new Date("2026-08-20T02:00:00+05:30");

describe("istDateString", () => {
  // The whole point: this instant is the 19th in UTC and the 20th in IST, and
  // the panel must call it the 20th. Bucketing it as the 19th is the bug being
  // fixed on the server side too.
  it("reports the IST calendar day, not the UTC one", () => {
    expect(LATE_NIGHT_IST.toISOString().slice(0, 10)).toBe("2026-08-19");
    expect(istDateString(LATE_NIGHT_IST)).toBe("2026-08-20");
  });

  it("handles the last moment before IST midnight", () => {
    expect(istDateString(new Date("2026-08-20T23:59:59+05:30"))).toBe("2026-08-20");
    expect(istDateString(new Date("2026-08-21T00:00:00+05:30"))).toBe("2026-08-21");
  });

  it("crosses a month and a year boundary correctly", () => {
    expect(istDateString(new Date("2026-09-01T00:30:00+05:30"))).toBe("2026-09-01");
    expect(istDateString(new Date("2027-01-01T01:00:00+05:30"))).toBe("2027-01-01");
    // 31 Dec 23:00 IST is 1 Jan in UTC terms only after 05:30, so this stays 2026.
    expect(istDateString(new Date("2026-12-31T23:00:00+05:30"))).toBe("2026-12-31");
  });
});

describe("istStartOfDay / istEndOfDay", () => {
  it("anchors to IST midnight, not the host's", () => {
    expect(istStartOfDay("2026-08-20").toISOString()).toBe("2026-08-19T18:30:00.000Z");
  });

  // Inclusive to the last millisecond: the server compares with <=, so an
  // exclusive next-midnight bound would pull in an event landing exactly on the
  // boundary and count it against both days.
  it("ends the day just before the next one begins", () => {
    expect(istEndOfDay("2026-08-20").toISOString()).toBe("2026-08-20T18:29:59.999Z");
    expect(istEndOfDay("2026-08-20").getTime()).toBeLessThan(istStartOfDay("2026-08-21").getTime());
  });
});

describe("resolveRange", () => {
  const now = new Date("2026-08-20T15:00:00+05:30");

  it("Today runs from IST midnight to now, not a full 24 hours", () => {
    const range = resolveRange("today", now);
    expect(range.from.toISOString()).toBe("2026-08-19T18:30:00.000Z");
    expect(range.to).toBe(now);
  });

  it("Yesterday is a whole calendar day in IST", () => {
    const range = resolveRange("yesterday", now);
    expect(istDateString(range.from)).toBe("2026-08-19");
    expect(istDateString(range.to)).toBe("2026-08-19");
    expect(range.to.getTime() - range.from.getTime()).toBe(86_400_000 - 1);
  });

  // Left rolling on purpose. Making them calendar windows would silently move
  // every number an operator has already looked at.
  it("keeps 7/30/90 rolling from now, unchanged", () => {
    for (const [id, days] of [["7d", 7], ["30d", 30], ["90d", 90]] as const) {
      const range = resolveRange(id, now);
      expect(range.to).toBe(now);
      expect(range.from.getTime()).toBe(now.getTime() - days * 86_400_000);
    }
  });

  it("Custom spans whole IST days, inclusive at both ends", () => {
    const range = resolveRange("custom", now, { from: "2026-08-01", to: "2026-08-14" });
    expect(range.from.toISOString()).toBe("2026-07-31T18:30:00.000Z");
    expect(range.to.toISOString()).toBe("2026-08-14T18:29:59.999Z");
  });

  it("a single-day custom range is a whole day, not an instant", () => {
    const range = resolveRange("custom", now, { from: "2026-08-05", to: "2026-08-05" });
    expect(range.to.getTime() - range.from.getTime()).toBe(86_400_000 - 1);
  });

  // A picker is easily left inverted mid-edit, and an empty panel reads as
  // "no traffic" rather than as a half-finished date range.
  it("orders an inverted custom range instead of returning nothing", () => {
    const inverted = resolveRange("custom", now, { from: "2026-08-14", to: "2026-08-01" });
    const correct = resolveRange("custom", now, { from: "2026-08-01", to: "2026-08-14" });
    expect(inverted).toEqual(correct);
  });

  it("falls back to 30d when custom has no dates yet", () => {
    expect(resolveRange("custom", now)).toEqual(resolveRange("30d", now));
    expect(resolveRange("custom", now, { from: "", to: "" })).toEqual(resolveRange("30d", now));
  });
});

describe("describeRange", () => {
  const now = new Date("2026-08-20T15:00:00+05:30");

  it("names the timezone, because the reader cannot otherwise know", () => {
    expect(describeRange("today", resolveRange("today", now))).toMatch(/IST/);
    expect(describeRange("yesterday", resolveRange("yesterday", now))).toContain("2026-08-19");
  });

  it("collapses a single-day custom range to one date", () => {
    const range = resolveRange("custom", now, { from: "2026-08-05", to: "2026-08-05" });
    expect(describeRange("custom", range)).toBe("2026-08-05, IST");
  });

  it("shows both ends of a multi-day custom range", () => {
    const range = resolveRange("custom", now, { from: "2026-08-01", to: "2026-08-14" });
    expect(describeRange("custom", range)).toBe("2026-08-01 to 2026-08-14, IST");
  });
});
