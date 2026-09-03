import { beforeEach, describe, expect, it } from "vitest";
import {
  mockAnalytics,
  mockCampaigns,
  mockClickMap,
  mockPointCount,
  mockVisitorSessions,
  mockVisitorsEnabled,
} from "@/lib/dev-visitor-mock";
import { TRACKED_PAGES } from "@/lib/tracked-pages";

// import.meta.env.DEV is true under vitest, so the enabled-path is exercised here.
// The production behaviour is guaranteed structurally instead: both call sites
// wrap the import in `if (import.meta.env.DEV)`, and the build output is checked
// to contain none of this module's strings.

describe("mockVisitorsEnabled", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/admin");
  });

  it("is on by default in dev, with no flag needed", () => {
    expect(mockVisitorsEnabled()).toBe(true);
  });

  it("?mockVisitors=0 turns it off and the choice sticks", () => {
    window.history.replaceState({}, "", "/admin?mockVisitors=0");
    expect(mockVisitorsEnabled()).toBe(false);
    window.history.replaceState({}, "", "/admin");
    expect(mockVisitorsEnabled()).toBe(false);
  });

  it("?mockVisitors=1 turns it back on", () => {
    localStorage.setItem("vedicfinance:mockVisitors", "0");
    window.history.replaceState({}, "", "/admin?mockVisitors=1");
    expect(mockVisitorsEnabled()).toBe(true);
  });
});

describe("mockVisitorSessions", () => {
  const ids = Array.from({ length: 15 }, (_, i) => `session-${i}`);

  it("puts this machine's address on the first row", () => {
    const { sessions } = mockVisitorSessions(ids);
    expect(sessions[0].last_ip).toBe("192.168.0.63");
  });

  it("is deterministic: the same session id always gets the same IP", () => {
    const a = mockVisitorSessions(ids).sessions.map((s) => s.last_ip);
    const b = mockVisitorSessions(ids).sessions.map((s) => s.last_ip);
    expect(a).toEqual(b);
  });

  it("keys every row to the session id it was given, so the kundali list can join", () => {
    const { sessions } = mockVisitorSessions(ids);
    expect(sessions.map((s) => s.session_id)).toEqual(ids);
  });

  // Every address must be non-routable or reserved for documentation, so a
  // sample row can never be mistaken for a real visitor and acted on.
  it("only ever emits LAN or RFC 5737 documentation addresses", () => {
    const { sessions } = mockVisitorSessions(ids);
    for (const s of sessions) {
      expect(s.last_ip).toMatch(/^(192\.168\.|198\.51\.100\.|203\.0\.113\.)/);
    }
  });

  // Same guard as the IP-range test: a sample identity must be impossible to
  // mistake for a real user, so every address is on the RFC 2606 reserved domain.
  it("only ever emits @example.com addresses", () => {
    const { sessions } = mockVisitorSessions(ids);
    const emails = sessions.map((s) => s.email).filter(Boolean) as string[];
    expect(emails.length).toBeGreaterThan(0);
    for (const e of emails) expect(e).toMatch(/@example\.com$/);
  });

  it("gives signed-in rows an email and guests a name instead", () => {
    const { sessions } = mockVisitorSessions(ids);
    const signedIn = sessions.filter((s) => s.user_id);
    const guests = sessions.filter((s) => !s.user_id);
    expect(signedIn.length).toBeGreaterThan(0);
    expect(guests.length).toBeGreaterThan(0);
    for (const s of signedIn) expect(s.email).toBeTruthy();
    // A guest has no account, so it must never carry one.
    for (const s of guests) expect(s.email).toBeNull();
  });

  it("covers the multi-name guest case so the +N marker is previewable", () => {
    const { sessions } = mockVisitorSessions(ids);
    expect(sessions.some((s) => s.name_count > 1)).toBe(true);
  });

  it("covers the no-identity case so the em-dash state is previewable", () => {
    const { sessions } = mockVisitorSessions(ids);
    expect(sessions.some((s) => !s.email && !s.full_name)).toBe(true);
  });

  it("labels where each name came from", () => {
    const { sessions } = mockVisitorSessions(ids);
    for (const s of sessions) {
      if (s.full_name) expect(["account", "kundali"]).toContain(s.name_source);
      else expect(s.name_source).toBeNull();
    }
  });

  it("names the accounts behind a shared IP", () => {
    const { summary } = mockVisitorSessions(Array.from({ length: 40 }, (_, i) => `s${i}`));
    expect(summary.shared_ips[0].emails.length).toBeGreaterThan(1);
  });

  // The chip renders "×N" next to a tooltip listing the accounts. If those two
  // numbers disagree the preview looks buggy, so keep identities 1:1 with ids —
  // real accounts cannot share an email either.
  it("reports the same account count as the number of emails it can name", () => {
    for (const n of [24, 40]) {
      const { summary } = mockVisitorSessions(Array.from({ length: n }, (_, i) => `s${i}`));
      for (const row of summary.shared_ips) {
        expect(row.user_count).toBe(row.emails.length);
      }
    }
  });

  it("maps one email to exactly one user_id", () => {
    const { sessions } = mockVisitorSessions(Array.from({ length: 60 }, (_, i) => `s${i}`));
    const idsByEmail = new Map<string, Set<string>>();
    for (const s of sessions) {
      if (!s.email || !s.user_id) continue;
      const set = idsByEmail.get(s.email) ?? new Set<string>();
      set.add(s.user_id);
      idsByEmail.set(s.email, set);
    }
    expect(idsByEmail.size).toBeGreaterThan(0);
    for (const [, ids] of idsByEmail) expect(ids.size).toBe(1);
  });

  it("produces a shared IP so the 2+ accounts panel has something to show", () => {
    const { summary } = mockVisitorSessions(Array.from({ length: 40 }, (_, i) => `s${i}`));
    expect(summary.shared_ips.length).toBeGreaterThan(0);
    expect(summary.shared_ips[0].user_count).toBeGreaterThan(1);
  });

  it("counts distinct IPs for the headline tile", () => {
    const { sessions, summary } = mockVisitorSessions(ids);
    expect(summary.distinct_ips_24h).toBe(new Set(sessions.map((s) => s.last_ip)).size);
  });

  it("returns an empty result for no input rather than throwing", () => {
    expect(mockVisitorSessions([]).sessions).toEqual([]);
  });
});

// ── The reported defect ──────────────────────────────────────────────────────
// The picker read "(no samples)" for /disclaimer while the badge beside it read
// "2,087 clicks" and the canvas drew a dense overlay, because mockClickMap
// fabricated a grid for any path handed to it and never consulted the list the
// picker was reading. These tests exist to keep the two in agreement.

const DEVICES = ["mobile", "desktop", "tablet"] as const;

describe("mockClickMap agrees with click_map_paths", () => {
  const countsFrom = (rows: { path: string; device: string | null; points: number }[]) => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(`${row.path}\u0000${row.device}`, row.points);
    return map;
  };

  it("draws nothing for a path+device the picker reports as empty", () => {
    const counts = countsFrom(mockAnalytics().click_map_paths);
    const empty: string[] = [];

    for (const page of TRACKED_PAGES) {
      for (const device of DEVICES) {
        if (counts.has(`${page.path}\u0000${device}`)) continue;
        empty.push(`${page.path}/${device}`);
        const map = mockClickMap(page.path, device);
        expect(map.cells).toEqual([]);
        expect(map.total).toBe(0);
        expect(map.max_n).toBe(0);
      }
    }

    // If nothing were empty the assertions above would vacuously pass, and the
    // empty-state overlay would still be unexercised.
    expect(empty.length).toBeGreaterThan(0);
  });

  it("draws exactly as many clicks as the picker promises", () => {
    for (const row of mockAnalytics().click_map_paths) {
      // row.kind matters: click_map_paths groups by kind, so the picker's count for
      // Dead clicks must be the one the dead-click canvas draws. Dropping it here
      // compared a dead-click row against the full click grid.
      const map = mockClickMap(row.path, row.device, row.kind);
      // The badge above the canvas reads map.total and the picker reads
      // row.points. Off by even one and the panel looks broken.
      expect(map.total).toBe(row.points);
      expect(map.cells.reduce((sum, c) => sum + c.n, 0)).toBe(row.points);
      expect(map.cells.length).toBeGreaterThan(0);
      expect(map.max_n).toBe(Math.max(...map.cells.map((c) => c.n)));
    }
  });

  it("omits zero rows, exactly as the SQL does", () => {
    // click_map_paths groups over click_points, so a path with no rows cannot
    // produce one. The picker must read "absent" as zero in dev too.
    for (const row of mockAnalytics().click_map_paths) {
      expect(row.points).toBeGreaterThan(0);
    }
  });

  it("is deterministic: the same page draws the same grid twice", () => {
    expect(mockClickMap("/home", "mobile")).toEqual(mockClickMap("/home", "mobile"));
  });

  it("keeps every cell inside the unit square", () => {
    for (const cell of mockClickMap("/home", "mobile").cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.x).toBeLessThanOrEqual(1);
      expect(cell.y).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeLessThanOrEqual(1);
      expect(cell.n).toBeGreaterThan(0);
    }
  });
});

describe("mockPointCount", () => {
  it("varies by device, so switching device changes the count", () => {
    const counts = DEVICES.map((d) => mockPointCount("/home", d));
    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it("treats a null device as the sum of the buckets, not a fourth value", () => {
    const summed = DEVICES.reduce((sum, d) => sum + mockPointCount("/home", d), 0);
    expect(mockPointCount("/home", null)).toBe(summed);
  });

  it("reports nothing for a path the catalogue does not have", () => {
    expect(mockPointCount("/not-a-page", "mobile")).toBe(0);
  });

  it("reports nothing for a device class that does not exist", () => {
    expect(mockPointCount("/home", "watch")).toBe(0);
  });
});

describe("mockAnalytics pages table", () => {
  const pages = mockAnalytics().pages;

  // The request that prompted this: the footer's legal pages were missing from
  // the pages table because the mock hardcoded six paths.
  it("lists the footer pages", () => {
    const paths = pages.map((p) => p.path);
    for (const path of ["/terms", "/privacy", "/disclaimer", "/refund-policy", "/services"]) {
      expect(paths).toContain(path);
    }
  });

  it("covers the whole catalogue, so it cannot drift from it again", () => {
    expect(pages.map((p) => p.path).sort()).toEqual(TRACKED_PAGES.map((p) => p.path).sort());
  });

  // The old linear decay went negative from the eighth page on, which would have
  // printed negative views the moment the list grew past six.
  it("never reports a negative or zero figure", () => {
    for (const page of pages) {
      expect(page.views).toBeGreaterThan(0);
      expect(page.sessions).toBeGreaterThan(0);
      expect(page.exits).toBeGreaterThanOrEqual(0);
      expect(page.exit_pct).toBeGreaterThanOrEqual(0);
      expect(page.exit_pct).toBeLessThanOrEqual(100);
    }
  });

  it("never reports more exits than views", () => {
    for (const page of pages) expect(page.exits).toBeLessThanOrEqual(page.views);
  });
});

/**
 * The campaign rows exist to make each branch of the funnel reachable without
 * running a real campaign. These assert that they still do — deleting or
 * "tidying" a row would otherwise silently remove the only way to look at that
 * branch, and nothing on screen would say so.
 */
describe("mockCampaigns", () => {
  const data = mockCampaigns();

  it("carries a campaign with revenue but no sessions in the window", () => {
    // The full-outer-join row in admin_campaigns. Without it the empty-top-half
    // note and the second funnel group standing alone are unreachable in dev.
    const late = data.campaigns.find((c) => c.campaign === "2026-07-launch");
    expect(late).toBeDefined();
    expect(late!.sessions).toBe(0);
    expect(late!.paid_users).toBeGreaterThan(0);
  });

  it("carries one campaign as several creatives, with different outcomes", () => {
    // The case the utm_content grouping exists for. If these ever collapse to
    // one row, the preview stops demonstrating the panel's main claim.
    const diwali = data.campaigns.filter((c) => c.campaign === "2026-09-diwali-kundali");
    expect(diwali.length).toBeGreaterThan(2);
    expect(new Set(diwali.map((c) => c.content)).size).toBe(diwali.length);

    const story1 = diwali.find((c) => c.content === "story-1")!;
    const story2 = diwali.find((c) => c.content === "story-2")!;
    // Comparable reach, materially different outcome — that is the comparison.
    expect(Math.abs(story1.sessions - story2.sessions)).toBeLessThan(50);
    expect(story1.revenue).toBeGreaterThan(story2.revenue * 2);
  });

  it("carries a row with no creative, so the (none) path is exercised", () => {
    expect(data.campaigns.some((c) => c.content === "(none)" && c.source !== "direct")).toBe(true);
  });

  it("carries a step that drops below the 25% warning threshold", () => {
    const steep = data.campaigns.find((c) => c.source === "google");
    expect(steep).toBeDefined();
    expect((steep!.kundali_generated / steep!.sessions) * 100).toBeLessThan(25);
  });

  it("carries the two rows the funnel must exclude", () => {
    const sources = data.campaigns.map((c) => c.source);
    expect(sources).toContain("direct");
    expect(sources).toContain("(pre-attribution)");
  });

  it("keeps tagged_sessions clear of direct and pre-attribution", () => {
    const tagged = data.campaigns
      .filter((c) => c.source !== "direct" && c.source !== "(pre-attribution)")
      .reduce((sum, c) => sum + c.sessions, 0);
    expect(data.totals.tagged_sessions).toBe(tagged);
    // Counting direct in would roughly double it, which is the mistake this
    // number is most likely to be read through.
    expect(data.totals.untagged_sessions).toBeGreaterThan(0);
  });

  it("moves when the internal filter is turned off", () => {
    // A toggle that changes nothing in dev looks broken exactly when someone is
    // checking whether it works.
    const included = mockCampaigns(undefined, false);
    expect(included.totals.tagged_sessions).toBeGreaterThan(data.totals.tagged_sessions);
  });

  it("derives the source breakdown from the rows rather than repeating them", () => {
    const whatsapp = data.sources.find((s) => s.source === "whatsapp");
    const fromRows = data.campaigns
      .filter((c) => c.source === "whatsapp")
      .reduce((sum, c) => sum + c.sessions, 0);
    expect(whatsapp?.sessions).toBe(fromRows);
  });
});
