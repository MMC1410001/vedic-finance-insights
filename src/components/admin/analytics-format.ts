/**
 * Presentation helpers for the Analytics section.
 *
 * Its own module because react-refresh wants a component file to export only
 * components — the same reason table-sort.ts sits apart from TableSortControls.tsx.
 * It also makes these unit-testable without mounting anything, which matters for
 * `ratio` and `heatColour`, both of which are easy to get subtly wrong.
 */

export const num = (n: number) => n.toLocaleString("en-IN");

/**
 * Seconds as "2m 23s". A bare 143.2 reads as a measurement rather than a
 * duration, and every figure here is a duration someone will compare by eye.
 */
export function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * A percentage of a base, or null when the base is zero.
 *
 * Null rather than 0, and this is the whole point: "0% of nobody" is not a
 * conversion rate. Rendered as 0% it invites the reader to conclude the step is
 * broken, when the truth is there was nothing to convert.
 *
 * Deliberately not clamped at 100 either. Pay clicks can exceed their base in an
 * odd window, and showing 120% is more useful than hiding the anomaly.
 */
export function ratio(part: number, whole: number): number | null {
  if (!whole) return null;
  return Number(((part / whole) * 100).toFixed(1));
}

export const pct = (value: number | null) => (value === null ? "—" : `${value}%`);

/**
 * Map a 0-1 intensity to a heatmap colour.
 *
 * Five explicit stops rather than an HSL hue sweep: a plain hue rotation spends
 * most of its range in greens, which makes a moderately-clicked area look as hot
 * as a heavily-clicked one.
 */
export function heatColour(t: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0.0, [30, 64, 175]],
    [0.25, [6, 182, 212]],
    [0.5, [34, 197, 94]],
    [0.75, [250, 204, 21]],
    [1.0, [220, 38, 38]],
  ];

  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    const [hi, hiColour] = stops[i];
    if (clamped > hi) continue;
    const [lo, loColour] = stops[i - 1];
    const f = hi === lo ? 0 : (clamped - lo) / (hi - lo);
    return [
      Math.round(loColour[0] + (hiColour[0] - loColour[0]) * f),
      Math.round(loColour[1] + (hiColour[1] - loColour[1]) * f),
      Math.round(loColour[2] + (hiColour[2] - loColour[2]) * f),
    ];
  }
  return stops[stops.length - 1][1];
}

export interface InternalSummary {
  excluded: boolean;
  sessions_matched: number;
  networks_active: number;
  accounts_active: number;
}

export interface InternalNotice {
  /** What the panel is currently showing, in one sentence. */
  headline: string;
  /** Which rules are live, or a prompt when none are. */
  detail: string;
  /** "warn" when internal traffic is inside the numbers on screen. */
  tone: "muted" | "warn";
}

/**
 * Describe the internal-traffic filter's current state.
 *
 * A pure function because the wording is the whole feature. Four states have to
 * stay distinguishable, and two of them are easy to conflate:
 *
 *   filter ON,  0 matched  — "nothing internal happened this week"
 *   filter OFF, 0 matched  — "not filtering, and nothing internal happened"
 *
 * Both show the same totals, so if they render the same sentence the reader
 * cannot tell whether the filter is working or simply had nothing to do. That
 * ambiguity is how a filtered number eventually gets quoted as a real one.
 *
 * Likewise the count is stated in BOTH modes. Reporting it only while filtering
 * would mean the two totals differ between visits with nothing on screen to
 * explain why.
 */
export function describeInternal(summary: InternalSummary | undefined): InternalNotice | null {
  if (!summary) return null;

  const { excluded, sessions_matched, networks_active, accounts_active } = summary;

  const rules =
    networks_active + accounts_active === 0
      ? "No internal networks or accounts are configured yet."
      : `Matching ${networks_active} network${networks_active === 1 ? "" : "s"} ` +
        `and ${accounts_active} account${accounts_active === 1 ? "" : "s"}.`;

  if (excluded) {
    return {
      headline:
        sessions_matched === 0
          ? "Showing real users. No internal sessions matched in this period."
          : `Showing real users, ${num(sessions_matched)} internal session${
              sessions_matched === 1 ? "" : "s"
            } hidden.`,
      detail: rules,
      tone: "muted",
    };
  }

  return {
    headline:
      sessions_matched === 0
        ? "Showing all traffic, internal included. None matched in this period."
        : `Showing all traffic, ${num(sessions_matched)} internal session${
            sessions_matched === 1 ? "" : "s"
          } counted in these numbers.`,
    // Warn only when internal traffic is actually inflating what is on screen.
    tone: sessions_matched === 0 ? "muted" : "warn",
    detail: rules,
  };
}

// ─── Date ranges ────────────────────────────────────────────────────────────

/**
 * Every window is resolved here, in IST, and sent to the server as explicit
 * bounds. The RPC has no preset vocabulary of its own.
 *
 * **Pinned to Asia/Kolkata, not the viewer's timezone.** Otherwise "Today" means
 * something different for an admin who happens to be travelling, and two people
 * quote different numbers for the same word. The users and the team are both in
 * India, so that is the day boundary that means anything here.
 */
export const IST_OFFSET_MINUTES = 330;

export type RangeId = "today" | "yesterday" | "7d" | "30d" | "90d" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export const RANGE_PRESETS: { id: RangeId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
  { id: "custom", label: "Custom" },
];

/**
 * The IST calendar date of an instant, as YYYY-MM-DD.
 *
 * Computed by shifting the epoch and reading UTC parts, rather than with
 * `toLocaleDateString`, so it cannot pick up the host's locale or calendar.
 */
export function istDateString(at: Date): string {
  const shifted = new Date(at.getTime() + IST_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** The instant at which the given IST calendar date begins. */
export function istStartOfDay(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000+05:30`);
}

/**
 * The instant at which the given IST calendar date ends.
 *
 * Inclusive to the last millisecond rather than the next day's midnight: the
 * server compares with `<=`, so an exclusive bound would pull in anything landing
 * exactly on the boundary and double-count it against the following day.
 */
export function istEndOfDay(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999+05:30`);
}

/**
 * Resolve a preset to a concrete window.
 *
 * `now` is a parameter so this is testable without touching the clock.
 *
 * Today and Yesterday are calendar days in IST. 7/30/90 stay **rolling** —
 * `now − N days` — because that is what they already meant, and changing them to
 * calendar windows would silently move every number an operator has seen before.
 */
export function resolveRange(id: RangeId, now: Date, custom?: { from: string; to: string }): DateRange {
  switch (id) {
    case "today": {
      const day = istDateString(now);
      return { from: istStartOfDay(day), to: now };
    }
    case "yesterday": {
      const day = istDateString(new Date(now.getTime() - 86_400_000));
      return { from: istStartOfDay(day), to: istEndOfDay(day) };
    }
    case "custom": {
      if (!custom?.from || !custom?.to) return resolveRange("30d", now);
      // Ordered here as well as server-side: a picker can easily be left with
      // `to` earlier than `from` mid-edit, and an empty panel reads as "no
      // traffic" rather than as a half-finished date range.
      const [first, second] = [custom.from, custom.to].sort();
      return { from: istStartOfDay(first), to: istEndOfDay(second) };
    }
    default: {
      const days = id === "7d" ? 7 : id === "90d" ? 90 : 30;
      return { from: new Date(now.getTime() - days * 86_400_000), to: now };
    }
  }
}

/** One-line description of the window, for the panel header. */
export function describeRange(id: RangeId, range: DateRange): string {
  if (id === "today") return "Today so far, IST";
  if (id === "yesterday") return `Yesterday, ${istDateString(range.from)} IST`;
  if (id === "custom") {
    const from = istDateString(range.from);
    const to = istDateString(range.to);
    return from === to ? `${from}, IST` : `${from} to ${to}, IST`;
  }
  return `Last ${id.replace("d", "")} days`;
}
