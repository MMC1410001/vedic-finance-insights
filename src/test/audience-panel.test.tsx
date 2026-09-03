import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { topTwoPlusOther } from "@/components/admin/AudiencePanel";

const AUDIENCE = {
  generated_at: "2026-09-01T00:00:00.000Z",
  visitors: { new: 1204, returning: 412, unknown: 269, identified: 1616 },
  engagement: { sessions: 1885, engaged: 822, engagement_rate: 43.6, avg_seconds: 131.4 },
  devices: [
    { label: "mobile", sessions: 1169 },
    { label: "desktop", sessions: 547 },
    { label: "tablet", sessions: 132 },
    { label: "unknown", sessions: 38 },
  ],
  os: [
    { label: "Android", sessions: 905 },
    { label: "Windows", sessions: 509 },
    { label: "iOS", sessions: 264 },
    { label: "Macintosh", sessions: 151 },
    { label: "Linux", sessions: 57 },
  ],
  source_medium: [
    { source: "(direct)", medium: "(none)", tagged: false, sessions: 812 },
    { source: "whatsapp", medium: "message", tagged: true, sessions: 486 },
  ],
  cities: [
    { city: "Mumbai", region: "Maharashtra", country: "IN", sessions: 1182 },
    { city: "Pune", region: "Maharashtra", country: "IN", sessions: 173 },
  ],
  geo_available: true,
  geo_sessions: 1355,
  geo_cached_ips: 214,
  // Two providers, because that is the realistic state once the chain has ever
  // fallen back — and the case the panel has to make legible.
  geo_sources: [
    { source: "ipinfo", addresses: 186 },
    { source: "ipwho", addresses: 28 },
  ],
};

vi.mock("@/lib/admin-api", () => ({
  invokeAdmin: vi.fn(() => Promise.resolve({ audience: AUDIENCE })),
}));
vi.mock("@/lib/admin-theme-context", () => ({
  useAdminTheme: () => ({
    chartColors: { series: ["#3987e5", "#d95926", "#199e70"], seriesOther: "#4b5563" },
  }),
}));

import { AudiencePanel } from "@/components/admin/AudiencePanel";

/**
 * The three-slice cap is a measured limit, not a style choice: a fourth
 * categorical hue fails the palette validator's colour-blind separation on both
 * theme surfaces. If this ever returns four, the pie is showing a colour a
 * reader cannot reliably distinguish.
 */
describe("topTwoPlusOther", () => {
  it("never returns more than three slices", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ label: `x${i}`, sessions: 10 - i }));
    expect(topTwoPlusOther(many)).toHaveLength(3);
  });

  it("folds the tail into Other, losing no sessions", () => {
    const rows = [
      { label: "a", sessions: 10 },
      { label: "b", sessions: 5 },
      { label: "c", sessions: 3 },
      { label: "d", sessions: 2 },
    ];
    const out = topTwoPlusOther(rows);
    expect(out.map((r) => r.label)).toEqual(["a", "b", "Other"]);
    expect(out.reduce((s, r) => s + r.sessions, 0)).toBe(20);
  });

  it("leaves three or fewer untouched, so nothing is needlessly hidden", () => {
    const rows = [{ label: "a", sessions: 2 }, { label: "b", sessions: 1 }];
    expect(topTwoPlusOther(rows)).toEqual(rows);
  });
});

describe("AudiencePanel", () => {
  const renderPanel = async () => {
    const view = render(<AudiencePanel from="2026-08-01" to="2026-09-01" excludeInternal />);
    await waitFor(() => expect(screen.getByText("Audience")).toBeInTheDocument());
    return view;
  };

  it("shows the four headline figures", async () => {
    const { container } = await renderPanel();
    expect(container.textContent).toContain("1,204");
    expect(container.textContent).toContain("412");
    expect(container.textContent).toContain("43.6%");
    expect(container.textContent).toContain("2m 11s");
  });

  // Counting them as new would invent a surge of first-time visitors, so they are
  // reported separately and explained.
  //
  // The explanation itself is asserted because it was wrong: it blamed the gap on
  // sessions predating 019 and promised the split would "become complete", when
  // the id was in fact being withheld from every untagged visit and no amount of
  // waiting would have closed it. A caption that explains a bug away is worse
  // than no caption.
  it("explains sessions with no device id rather than folding them into new", async () => {
    const { container } = await renderPanel();
    expect(container.textContent).toContain("269 sessions carry no device id");
    expect(container.textContent).toContain("blocks local storage");
    expect(container.textContent).toContain("does not reach zero");
    expect(container.textContent).not.toContain("predate migration 019");
  });

  it("names every pie slice, so identity is never colour alone", async () => {
    const { container } = await renderPanel();
    // Top two by name, and the folded remainder.
    expect(container.textContent).toContain("Android");
    expect(container.textContent).toContain("Windows");
    expect(container.textContent).toContain("Other");
    // The tail the pie cannot show still appears in the bar list beneath it.
    expect(container.textContent).toContain("Linux");
  });

  it("marks which sources were tagged and which were inferred", async () => {
    const { container } = await renderPanel();
    expect(container.textContent).toContain("utm");
    expect(container.textContent).toContain("referrer");
  });

  it("ranks cities and shares them against the placed sessions only", async () => {
    const { container } = await renderPanel();
    expect(container.textContent).toContain("Mumbai");
    expect(container.textContent).toContain("Maharashtra");
    // 1182 of the 1,355 PLACED sessions, not of all 1,885 — unplaced sessions
    // are excluded rather than silently counted as somewhere.
    expect(container.textContent).toContain("87.2%");
    expect(container.textContent).toContain("1,355 of 1,885 sessions in this range");
  });

  it("names which provider resolved the cache, because they disagree", async () => {
    // The chain falls back to a keyless provider when the primary fails, so one
    // table can hold two providers' opinions — and the same address resolves to
    // Mumbai on ipinfo and Delhi on ipwho.is. A blended distribution that does
    // not say it is blended cannot be read.
    const { container } = await renderPanel();
    expect(container.textContent).toMatch(/Resolved by/);
    expect(container.textContent).toMatch(/ipinfo\.io\s*186/);
    expect(container.textContent).toMatch(/ipwho\.is\s*28/);
    expect(container.textContent).toMatch(/blend of two opinions/);
  });

  it("omits the provider line entirely when the payload has no source data", async () => {
    // An edge function older than this field sends nothing. Better a missing
    // line than "Resolved by ." with an empty list.
    const api = await import("@/lib/admin-api");
    vi.mocked(api.invokeAdmin).mockResolvedValueOnce({
      audience: { ...AUDIENCE, geo_sources: [] },
    } as never);

    render(<AudiencePanel from="2026-08-01" to="2026-09-01" excludeInternal />);
    await waitFor(() => expect(screen.getByText("Cities")).toBeInTheDocument());
    expect(screen.queryByText(/Resolved by/)).not.toBeInTheDocument();
  });

  it("says plainly that the cached-address count is not scoped to the range", async () => {
    // It is a whole-table figure sitting beside windowed ones. Rendered without
    // that qualifier it reads as "214 addresses seen in this period", which it
    // is not.
    const { container } = await renderPanel();
    expect(container.textContent).toContain("214");
    expect(container.textContent).toContain("not limited to this range");
  });

  // The number most likely to be quoted in a meeting and least likely to be
  // true, so the warning is on screen rather than in a footnote.
  it("warns about carrier NAT skew beside the city table", async () => {
    const { container } = await renderPanel();
    expect(container.textContent).toContain("Approximate, and skewed");
    expect(container.textContent).toContain("regional hint");
  });

  // A blank card would read as a bug, or worse as a real zero.
  // Three states, not two. "Nothing resolved" has two very different causes and
  // the operator has to fix them in different places.
  const noGeo = (over: Record<string, unknown>) => ({
    ...AUDIENCE,
    cities: [],
    geo_available: false,
    geo_sessions: 0,
    geo_cached_ips: 0,
    ...over,
  });

  it("explains an unconfigured provider rather than showing an empty table", async () => {
    const api = await import("@/lib/admin-api");
    vi.mocked(api.invokeAdmin).mockResolvedValueOnce({
      audience: noGeo({ geo_configured: false }),
    } as never);

    render(<AudiencePanel from="2026-08-01" to="2026-09-01" excludeInternal />);
    await waitFor(() => expect(screen.getByText("Cities")).toBeInTheDocument());
    expect(screen.getByText(/No locations resolved yet/)).toBeInTheDocument();
    expect(screen.getByText(/IPINFO_TOKEN/)).toBeInTheDocument();
  });

  it("says the token is SET but failing, rather than telling you to set it again", async () => {
    // Regression: a rejected or out-of-quota token returns 403/429, caches
    // nothing, and leaves every visit without a city. Once the window rolled
    // past the last good lookup the card reverted to "IPINFO_TOKEN is not set"
    // — sending whoever read it to the one place that was already correct.
    const api = await import("@/lib/admin-api");
    vi.mocked(api.invokeAdmin).mockResolvedValueOnce({
      audience: noGeo({ geo_configured: true }),
    } as never);

    render(<AudiencePanel from="2026-08-01" to="2026-09-01" excludeInternal />);
    await waitFor(() => expect(screen.getByText("Cities")).toBeInTheDocument());
    expect(screen.getByText(/is set,\s*but nothing has resolved/)).toBeInTheDocument();
    expect(screen.getByText(/still valid and inside its monthly quota/)).toBeInTheDocument();
    // And it must not also print the "go and set it" message.
    expect(screen.queryByText(/No locations resolved yet/)).not.toBeInTheDocument();
  });

  it("says sessions and the funnel are unaffected, so nobody treats it as an outage", async () => {
    const api = await import("@/lib/admin-api");
    vi.mocked(api.invokeAdmin).mockResolvedValueOnce({
      audience: noGeo({ geo_configured: true }),
    } as never);

    render(<AudiencePanel from="2026-08-01" to="2026-09-01" excludeInternal />);
    await waitFor(() => expect(screen.getByText("Cities")).toBeInTheDocument());
    expect(
      screen.getByText(/Sessions, the funnel and campaigns are unaffected/),
    ).toBeInTheDocument();
  });

  it("falls back to the unconfigured message when the field is absent", async () => {
    // An edge function deployed before this field exists omits it. Undefined must
    // read as "not configured" — the message this card showed before, not the
    // stronger claim that a token is set and broken.
    const api = await import("@/lib/admin-api");
    vi.mocked(api.invokeAdmin).mockResolvedValueOnce({ audience: noGeo({}) } as never);

    render(<AudiencePanel from="2026-08-01" to="2026-09-01" excludeInternal />);
    await waitFor(() => expect(screen.getByText("Cities")).toBeInTheDocument());
    expect(screen.getByText(/No locations resolved yet/)).toBeInTheDocument();
    expect(screen.queryByText(/but nothing has resolved/)).not.toBeInTheDocument();
  });
});
