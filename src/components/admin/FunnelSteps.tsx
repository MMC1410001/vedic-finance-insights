/**
 * Funnel bars for the admin panel.
 *
 * Hand-rolled divs rather than a chart library: each step needs its count, its
 * share of the group's baseline, AND its conversion from the step above. A
 * recharts funnel gives one number per bar and no room for the step-to-step
 * figure, which is the one that says where people are lost.
 *
 * Its own module because two panels need it — the site-wide funnel in
 * AnalyticsDashboard and the per-campaign one in CampaignsPanel. Importing it
 * back out of the dashboard would make that pair circular, since the dashboard
 * mounts the campaigns panel. Same reason Breakdown lives apart.
 *
 * ── Why a step list is a prop, and why groups exist ─────────────────────────
 * The site-wide funnel is one run of five stages all measured against sessions.
 * The campaign funnel is not: its first four stages are counted per session,
 * but Accounts and Paid are counted per *user*, from that user's first-ever
 * tagged visit. A September click that pays in November puts the session in one
 * window and the payment in another, so paid can legitimately exceed sessions.
 *
 * `ratio()` is deliberately unclamped, so measuring those last two against
 * sessions would draw a bar wider than its own track and assert a conversion
 * rate above 100%. A group restarts the baseline instead, and carries a caption
 * saying why — the two halves are not comparable and the reader is told so
 * rather than left to notice.
 *
 * ── Each group is its own block, and that is load-bearing ───────────────────
 * A group renders as a separate two-column row rather than as a break inside
 * one long pair of columns. That is what lets the caption above a group run the
 * full width of the component: when it lived inside the narrow label column it
 * was clamped to two lines, and at 375px the half that got cut was "not a
 * subset of the sessions above" — the exact sentence that stops a reader taking
 * the second group's 100% at face value.
 */

import { useIsMobile } from "@/hooks/use-mobile";
import { num, ratio } from "./analytics-format";

export interface FunnelStep {
  key: string;
  label: string;
  value: number;
  /** Short caption under the bar. Fixed text, not derived from the data. */
  note: string;
  /**
   * Start a new group: this step becomes the baseline every step after it is
   * measured against, until the next one. The first step is implicitly a group
   * start, so a list with none behaves exactly like one continuous funnel.
   */
  groupStart?: boolean;
  /** Caption on the divider above this group — say why the baseline changed. */
  groupNote?: string;
  /**
   * Compare this group-start step to the LAST step of the group above it, as a
   * plural noun naming that step — "pay clicks".
   *
   * Only for a comparison that is genuinely meaningful across the break. The
   * grouping exists because the two halves are counted differently, so most
   * cross-basis ratios would be nonsense; this one is opt-in per funnel.
   *
   * It exists because regrouping silently deleted a number that matters. The
   * site funnel's last stage is a group of one, so its share is 100% of itself
   * and its step-rate is null — which removed "payment started → completed", the
   * single most-read conversion on the panel, from the funnel entirely.
   */
  crossGroupNoun?: string;
  /**
   * What the group's shares are a share *of*, as a plural noun — "sessions",
   * "accounts". Only read on a group-start step.
   *
   * Every share is measured against its own group's baseline, so a single fixed
   * word like "of top" is a lie for the second group onward: it read "Accounts
   * created — 100% of top" on a funnel whose top was 1,885 sessions. Naming the
   * baseline is the only way the figure can be read correctly.
   */
  baselineNoun?: string;
}

/**
 * Width of a stage's band, as a percentage of the funnel column.
 *
 * Floored at 2 so a real-but-tiny stage still shows something to point at, and
 * capped at 100 so a band can never overflow its own container — with a group
 * baseline it should not be able to, but a visual that silently breaks its
 * bounds is worse than one that clamps.
 */
function bandWidth(share: number | null): number {
  return Math.min(Math.max(share ?? 0, 2), 100);
}

/**
 * Fixed row geometry, in pixels.
 *
 * The funnel and its labels are two columns that must line up, and the only way
 * to guarantee that is to give both the same heights by construction. Deriving
 * one from the other's rendered height would need a measurement pass, and a
 * label that wrapped to two lines would silently pull the funnel apart.
 *
 * Taller bands on a phone, because that is where the label column runs out of
 * room and the note has to wrap under its figures instead of beside them. The
 * alternative — one height everywhere — is what truncated four of six notes to
 * "Stamped with this…" at 375px.
 */
const BAND_H = 40;
const BAND_H_MOBILE = 76;
const TAPER_H = 24;
const TAPER_H_MOBILE = 18;

interface Row {
  step: FunnelStep;
  /** Share of the group's baseline, or null when that baseline is zero. */
  share: number | null;
  tapersToNext: boolean;
  from: number;
  to: number;
  stepRate: number | null;
  baselineNoun: string;
  /** Conversion from the previous GROUP's last step, when the funnel asks. */
  crossRate: number | null;
  crossNoun: string | null;
}

/** One group's worth of rows: the funnel column and the label column together. */
function FunnelGroup({
  rows,
  bandH,
  taperH,
}: {
  rows: Row[];
  bandH: number;
  taperH: number;
}) {
  return (
    <div className="flex gap-4 items-start">
      {/* The funnel. Nothing but bands and tapers goes in this column — any text
          between them would break the shape into detached lozenges. */}
      {/* Narrower on the smallest phones, so the label column keeps enough room
          for a step name: at 320px "Kundali generated" was ellipsised. */}
      <div className="w-[36%] sm:w-[42%] shrink-0" aria-hidden="true">
        {rows.map((row) => (
          <div key={row.step.key}>
            <div className="flex justify-center" style={{ height: bandH }}>
              {/* No text inside: the lower bands are a few percent wide and a
                  clipped number reads worse than none. Every figure is in the
                  label column, which cannot run out of room. */}
              <div
                data-testid="funnel-bar"
                className="h-full rounded-sm bg-admin-info-strong/70"
                style={{ width: `${row.from}%` }}
              />
            </div>
            {row.tapersToNext && (
              // Percentage coordinates, so the slope follows the column at any
              // width without anything having to be measured.
              <div
                className="bg-admin-info-strong/45"
                style={{
                  height: taperH,
                  clipPath: `polygon(${50 - row.from / 2}% 0%, ${50 + row.from / 2}% 0%, ${
                    50 + row.to / 2
                  }% 100%, ${50 - row.to / 2}% 100%)`,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* The numbers, one block per band, at exactly the band's height. */}
      <div className="flex-1 min-w-0">
        {rows.map((row) => (
          <div
            key={row.step.key}
            style={{ height: bandH + (row.tapersToNext ? taperH : 0) }}
          >
            <div className="flex flex-col justify-center" style={{ height: bandH }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-admin-text truncate">
                  {row.step.label}
                </span>
                <span className="text-xs font-medium text-admin-text tabular-nums shrink-0">
                  {num(row.step.value)}
                </span>
              </div>
              {/* Wraps rather than truncates. The two figures are separate flex
                  children, each unbreakable in itself: that is what lets them
                  drop onto their own line on a phone instead of running off the
                  right edge as "· 33.9% of previou". The band is taller there to
                  hold the extra line. */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 leading-tight">
                <p className="text-[10px] text-admin-text-faint min-w-0">{row.step.note}</p>
                <span className="flex flex-wrap items-baseline gap-x-2 text-[10px] tabular-nums">
                  <span className="text-admin-text-faint whitespace-nowrap">
                    {/* "—" rather than a number when the baseline is zero. A share
                        of nothing is not a share, and floored-to-one arithmetic
                        turned four paid users into "400% of top". */}
                    {row.share === null ? "—" : `${row.share}% of ${row.baselineNoun}`}
                  </span>
                  {row.stepRate !== null && (
                    <span
                      className={`whitespace-nowrap ${
                        row.stepRate < 25 ? "text-admin-warn" : "text-admin-text-faint"
                      }`}
                    >
                      · {row.stepRate}% of previous
                    </span>
                  )}
                  {/* Names the other side rather than saying "of previous",
                      because the two are counted differently — that is what the
                      group break above it is for. */}
                  {row.crossRate !== null && row.crossNoun && (
                    <span className="whitespace-nowrap text-admin-text-faint">
                      · {row.crossRate}% of {row.crossNoun}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FunnelSteps({
  steps,
  testId,
}: {
  steps: FunnelStep[];
  /**
   * Names this funnel for tests. Both panels render the same component on the
   * same screen, so "the funnel bars" is ambiguous without it — an e2e selector
   * that matched bars by class silently picked up eleven bars from two funnels
   * and asserted the wrong shape.
   */
  testId?: string;
}) {
  const isMobile = useIsMobile();
  const bandH = isMobile ? BAND_H_MOBILE : BAND_H;
  const taperH = isMobile ? TAPER_H_MOBILE : TAPER_H;

  // Split into groups first, so every share can be resolved against the
  // baseline of the group it actually belongs to.
  const groups: FunnelStep[][] = [];
  for (const [i, step] of steps.entries()) {
    if (i === 0 || step.groupStart === true) groups.push([step]);
    else groups[groups.length - 1].push(step);
  }

  return (
    <div data-testid={testId}>
      {groups.map((group, groupIndex) => {
        const head = group[0];
        // The stage immediately above the break, for the opt-in cross-group
        // comparison on this group's head.
        const previousGroup = groupIndex > 0 ? groups[groupIndex - 1] : null;
        const above = previousGroup ? previousGroup[previousGroup.length - 1] : null;
        // NOT floored to one. A zero baseline means there is nothing to take a
        // share of, and every share in the group is reported as "—" instead of
        // being divided by an invented denominator.
        const baseline = head.value;
        const baselineNoun = head.baselineNoun ?? head.label.toLowerCase();

        const rows: Row[] = group.map((step, i) => {
          const next = group[i + 1];
          const share = ratio(step.value, baseline);
          return {
            step,
            share,
            tapersToNext: next !== undefined,
            from: bandWidth(share),
            to: next !== undefined ? bandWidth(ratio(next.value, baseline)) : bandWidth(share),
            // Nothing above it inside its own group to convert from — showing
            // the previous group's last step here as "of previous" would compare
            // two bases without saying so. crossRate below does say so.
            stepRate: i === 0 ? null : ratio(step.value, group[i - 1].value),
            baselineNoun,
            crossRate:
              i === 0 && above && step.crossGroupNoun ? ratio(step.value, above.value) : null,
            crossNoun: i === 0 ? step.crossGroupNoun ?? null : null,
          };
        });

        return (
          <div key={head.key}>
            {groupIndex > 0 && (
              // Full width, and never clamped. This caption is the only thing
              // telling the reader that the group below restarts the baseline.
              <div className="border-t border-admin-border-subtle mt-1 pt-2 pb-2">
                {head.groupNote && (
                  <p className="text-[10px] leading-tight text-admin-text-faint">
                    {head.groupNote}
                  </p>
                )}
              </div>
            )}
            <FunnelGroup rows={rows} bandH={bandH} taperH={taperH} />
          </div>
        );
      })}
    </div>
  );
}
