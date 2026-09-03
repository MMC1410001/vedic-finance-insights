/**
 * Audience — who the visitors are, as opposed to what they did.
 *
 * Its own fetch and its own RPC (admin_audience in 019), like CampaignsPanel:
 * this is new, and a failure in it must not blank the funnel above it.
 *
 * ── Why the pies show only three slices ─────────────────────────────────────
 * The categorical palette is capped at three by measurement, not taste. A pie is
 * an all-pairs form — any slice can end up beside any other — and run through
 * the palette validator with `--pairs all`, three hues pass every check on both
 * theme surfaces while a fourth fails colour-blind separation and the
 * normal-vision floor whichever hue is added. So each pie shows the top two
 * categories plus a neutral "Other", and the full ranked list sits directly
 * beneath it as bars. The bars are also the relief the light theme's contrast
 * warning obliges — see AdminChartColors.series.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Users, MonitorSmartphone, Cpu, Radio, MapPin } from "lucide-react";
import { invokeAdmin } from "@/lib/admin-api";
import { useAdminTheme } from "@/lib/admin-theme-context";
import { AdminCard, AdminStat, Pill } from "./AdminCard";
import { AdminField, AdminTable, type AdminColumn } from "./AdminTable";
import { Breakdown } from "./Breakdown";
import { duration, num, pct, ratio } from "./analytics-format";

interface LabelledCount {
  label: string;
  sessions: number;
}

export interface CityRow {
  city: string;
  region: string;
  country: string;
  sessions: number;
}

export interface SourceMediumRow {
  source: string;
  medium: string;
  tagged: boolean;
  sessions: number;
}

interface Audience {
  generated_at: string;
  visitors: { new: number; returning: number; unknown: number; identified: number };
  engagement: {
    sessions: number;
    engaged: number;
    engagement_rate: number | null;
    avg_seconds: number;
  };
  devices: LabelledCount[];
  os: LabelledCount[];
  source_medium: SourceMediumRow[];
  cities: CityRow[];
  geo_available: boolean;
  geo_sessions: number;
  geo_cached_ips: number;
  /**
   * Whether IPINFO_TOKEN is set, which only the edge runtime can answer —
   * admin_audience() runs in Postgres and cannot see the function's secrets.
   *
   * Distinct from geo_available, which says whether anything actually resolved.
   * Optional because a deployment where admin-user-management is older than this
   * panel will omit it; undefined then reads as "not configured", which is the
   * message this card showed before the field existed.
   */
  geo_configured?: boolean;
  /**
   * Which provider resolved each cached address. Whole-table, not window-scoped,
   * like geo_cached_ips beside it.
   *
   * Worth showing because the fallback chain means two providers can populate
   * one table, and they do not always agree — the same address resolves to
   * Mumbai on ipinfo and Delhi on ipwho.is. It is also how a lapsed token
   * becomes visible: the ipinfo count stops growing while ipwho climbs.
   */
  geo_sources?: { source: string; addresses: number }[];
}

/** How the panel names each provider. Unknown sources print their raw value. */
const SOURCE_LABELS: Record<string, string> = {
  ipinfo: "ipinfo.io",
  ipwho: "ipwho.is",
  unknown: "unrecorded",
};

/** The synthetic catch-all slice. A real category never carries this label. */
const OTHER_LABEL = "Other";

/**
 * Top two by volume plus everything else as one neutral slice.
 *
 * Not a display nicety: three is the validated ceiling for this palette, so a
 * fourth hue would be a colour a reader cannot reliably tell from another.
 */
export function topTwoPlusOther(rows: LabelledCount[]): LabelledCount[] {
  if (rows.length <= 3) return rows;
  const [first, second, ...rest] = rows;
  return [first, second, { label: OTHER_LABEL, sessions: rest.reduce((s, r) => s + r.sessions, 0) }];
}

function SharePie({
  title,
  icon: Icon,
  rows,
  colours,
  otherColour,
}: {
  title: string;
  icon: typeof Users;
  rows: LabelledCount[];
  colours: readonly string[];
  otherColour: string;
}) {
  const slices = topTwoPlusOther(rows);
  const total = slices.reduce((sum, r) => sum + r.sessions, 0);

  // Colour follows the entity, not its rank. Indexing the palette by position
  // in a volume-sorted list meant "mobile" was blue this week and orange the
  // next simply because desktop overtook it — or, worse, that toggling Real
  // users / All traffic repainted the chart under the reader mid-comparison.
  // Alphabetical rank among the named slices is stable under every filter that
  // does not change WHICH categories are shown.
  const order = slices
    .filter((r) => r.label !== OTHER_LABEL)
    .map((r) => r.label)
    .sort((a, b) => a.localeCompare(b));
  const colourOf = (row: LabelledCount) =>
    row.label === OTHER_LABEL ? otherColour : colours[order.indexOf(row.label)] ?? otherColour;

  return (
    <AdminCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5 text-admin-text-muted" />
        <h4 className="text-xs font-semibold text-admin-text">{title}</h4>
      </div>

      {total === 0 ? (
        <p className="text-xs text-admin-text-muted">—</p>
      ) : (
        <>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="sessions"
                  nameKey="label"
                  innerRadius="52%"
                  outerRadius="82%"
                  // A 2px surface gap between slices, so adjacent fills read as
                  // separate marks rather than one continuous ring.
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {slices.map((row) => (
                    <Cell key={row.label} fill={colourOf(row)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${num(value)} · ${pct(ratio(value, total))}`,
                    name,
                  ]}
                  contentStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Identity is never colour alone: every slice is named and numbered
              here, which is also the relief the light theme's contrast warning
              on the third hue requires. */}
          <ul className="mt-2 space-y-1">
            {slices.map((row) => (
              <li key={row.label} className="flex items-center gap-2 text-[11px]">
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: colourOf(row) }}
                />
                <span className="text-admin-text-secondary capitalize truncate">{row.label}</span>
                <span className="ml-auto text-admin-text-muted tabular-nums shrink-0">
                  {num(row.sessions)} · {pct(ratio(row.sessions, total))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminCard>
  );
}

export function AudiencePanel({
  from,
  to,
  excludeInternal,
}: {
  from: string;
  to: string;
  excludeInternal: boolean;
}) {
  const { chartColors } = useAdminTheme();
  const [data, setData] = useState<Audience | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSample, setIsSample] = useState(false);

  const fetchAudience = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await invokeAdmin<{ audience?: Audience }>({
        action: "audience-overview",
        from,
        to,
        excludeInternal,
      });
      const audience = response?.audience;

      if (import.meta.env.DEV && !audience?.engagement?.sessions) {
        const dev = await import("@/lib/dev-visitor-mock");
        if (dev.mockVisitorsEnabled()) {
          setData(dev.mockAudience(excludeInternal));
          setIsSample(true);
          setLoading(false);
          return;
        }
      }

      setData(audience ?? null);
      setIsSample(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to load audience:", message);

      if (import.meta.env.DEV) {
        const dev = await import("@/lib/dev-visitor-mock");
        if (dev.mockVisitorsEnabled()) {
          setData(dev.mockAudience(excludeInternal));
          setIsSample(true);
          setLoading(false);
          return;
        }
      }

      setError(message);
      setData(null);
    }
    setLoading(false);
  }, [from, to, excludeInternal]);

  useEffect(() => {
    void fetchAudience();
  }, [fetchAudience]);

  const sourceRows = useMemo(() => data?.source_medium ?? [], [data]);
  const sourceTotal = useMemo(
    () => sourceRows.reduce((sum, r) => sum + r.sessions, 0),
    [sourceRows],
  );

  const cityColumns: AdminColumn<CityRow>[] = [
    { label: "City", sortValue: (r) => `${r.city} ${r.region}` },
    { label: "Sessions", align: "right", sortValue: (r) => r.sessions, descFirst: true },
    { label: "Share", align: "right", sortValue: (r) => r.sessions, descFirst: true },
  ];

  const columns: AdminColumn<SourceMediumRow>[] = [
    { label: "Source / medium", sortValue: (r) => `${r.source} ${r.medium}` },
    { label: "Tagged", align: "center", sortValue: (r) => r.tagged },
    { label: "Sessions", align: "right", sortValue: (r) => r.sessions, descFirst: true },
    { label: "Share", align: "right", sortValue: (r) => r.sessions, descFirst: true },
  ];

  return (
    <section className="mt-6" data-testid="audience-panel">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-4 h-4 text-admin-text-muted" />
        <h3 className="text-sm font-semibold text-admin-text">Audience</h3>
      </div>
      <p className="text-[11px] text-admin-text-faint mb-3 max-w-3xl">
        Who the visitors are, rather than what they did. Everything here counts sessions
        in the selected range and honours the same internal-traffic filter as the funnel
        above.
      </p>

      {loading && <p className="text-xs text-admin-text-muted">Loading audience…</p>}

      {!loading && error && (
        <AdminCard className="p-4">
          <p className="text-xs text-admin-warn">Could not load audience: {error}</p>
          <p className="text-[10px] text-admin-text-faint mt-1">
            If this says the function is missing, redeploy admin-user-management after
            applying migration 019.
          </p>
        </AdminCard>
      )}

      {!loading && !error && data && (
        <>
          {isSample && (
            <AdminCard className="p-3 mb-4 border-admin-warn/40 bg-admin-warn/10">
              <p className="text-xs text-admin-text">
                <strong>Generated sample data</strong>, not real traffic. Turn it off with
                <code className="mx-1 px-1 rounded bg-admin-surface-2">?mockVisitors=0</code>.
              </p>
            </AdminCard>
          )}

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
            <AdminStat value={num(data.visitors.new)} label="New visitors" />
            <AdminStat value={num(data.visitors.returning)} label="Returning visitors" />
            <AdminStat
              value={data.engagement.engagement_rate === null ? "—" : `${data.engagement.engagement_rate}%`}
              label="Engagement rate — 2+ views, or 10s+"
            />
            <AdminStat
              value={duration(data.engagement.avg_seconds)}
              label="Average session duration"
            />
          </div>

          {data.visitors.unknown > 0 && (
            <p className="text-[11px] text-admin-text-faint mb-4">
              {num(data.visitors.unknown)} session
              {data.visitors.unknown === 1 ? "" : "s"} carry no device id, so they count as
              neither new nor returning. Either they were recorded before the id was
              attached to every visit, or the browser blocks local storage &mdash; a private
              window, iOS Lockdown, or &ldquo;block all site data&rdquo;. This shrinks as
              older sessions age out of the range; it does not reach zero.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <SharePie
              title="Devices"
              icon={MonitorSmartphone}
              rows={data.devices}
              colours={chartColors.series}
              otherColour={chartColors.seriesOther}
            />
            <SharePie
              title="Operating systems"
              icon={Cpu}
              rows={data.os}
              colours={chartColors.series}
              otherColour={chartColors.seriesOther}
            />
          </div>

          {/* The full lists, under the pies: a pie can hold three slices, and
              these are where the tail actually lives. */}
          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <Breakdown
              title="Devices — all"
              icon={MonitorSmartphone}
              rows={data.devices}
            />
            <Breakdown
              title="Operating systems — all"
              icon={Cpu}
              rows={data.os}
            />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-3.5 h-3.5 text-admin-text-muted" />
            <h4 className="text-xs font-semibold text-admin-text">Source / medium</h4>
          </div>
          <p className="text-[11px] text-admin-text-faint mb-2">
            Tagged sessions report what their link declared. Untagged ones are bucketed from
            the referring host — the most that can honestly be said about them.
          </p>
          {sourceRows.length === 0 ? (
            <AdminCard className="p-4">
              <p className="text-xs text-admin-text-muted">No sessions in this period.</p>
            </AdminCard>
          ) : (
            <AdminTable<SourceMediumRow>
              columns={columns}
              rows={sourceRows}
              rowKey={(r) => `${r.source}|${r.medium}`}
              defaultSort={{ key: "2", dir: "desc" }}
              renderRow={(r) => (
                <>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-admin-text break-words">{r.source}</span>
                    <span className="font-mono text-[10px] text-admin-text-muted ml-1">
                      / {r.medium}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {r.tagged ? (
                      <Pill tone="bg-admin-ok/20 text-admin-ok">utm</Pill>
                    ) : (
                      <span className="text-[10px] text-admin-text-faint">referrer</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-admin-text-secondary">
                    {num(r.sessions)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-admin-text-muted">
                    {pct(ratio(r.sessions, sourceTotal))}
                  </td>
                </>
              )}
              renderCard={(r) => (
                <div className="space-y-1">
                  <p className="text-xs text-admin-text break-words">
                    {r.source}
                    <span className="font-mono text-[10px] text-admin-text-muted ml-1">
                      / {r.medium}
                    </span>
                  </p>
                  <AdminField label="Tagged">{r.tagged ? "utm" : "referrer"}</AdminField>
                  <AdminField label="Sessions">{num(r.sessions)}</AdminField>
                  <AdminField label="Share">{pct(ratio(r.sessions, sourceTotal))}</AdminField>
                </div>
              )}
            />
          )}

          <div className="flex items-center gap-2 mt-6 mb-2">
            <MapPin className="w-3.5 h-3.5 text-admin-text-muted" />
            <h4 className="text-xs font-semibold text-admin-text">Cities</h4>
          </div>

          {data.geo_available ? (
            <>
              {/* Stated up front, not in a footnote: this is the number most
                  likely to be quoted in a meeting and least likely to be true. */}
              <p className="text-[11px] text-admin-warn mb-2">
                Approximate, and skewed. Indian mobile carriers route very large
                subscriber pools through a few metro exchanges, so users across a state
                often resolve to one city — Mumbai above all. Read this as a regional
                hint, never as where someone is. GA4 does the same lookup and is wrong
                in the same direction.
              </p>
              <AdminTable<CityRow>
                columns={cityColumns}
                rows={data.cities}
                rowKey={(r) => `${r.country}|${r.region}|${r.city}`}
                defaultSort={{ key: "1", dir: "desc" }}
                renderRow={(r) => (
                  <>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-admin-text break-words">{r.city}</span>
                      <span className="text-[10px] text-admin-text-muted ml-1">
                        {r.region}
                        {r.country !== "—" && `, ${r.country}`}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-admin-text-secondary">
                      {num(r.sessions)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-admin-text-muted">
                      {pct(ratio(r.sessions, data.geo_sessions))}
                    </td>
                  </>
                )}
                renderCard={(r) => (
                  <div className="space-y-1">
                    <p className="text-xs text-admin-text break-words">
                      {r.city}
                      <span className="text-[10px] text-admin-text-muted ml-1">{r.region}</span>
                    </p>
                    <AdminField label="Sessions">{num(r.sessions)}</AdminField>
                    <AdminField label="Share">
                      {pct(ratio(r.sessions, data.geo_sessions))}
                    </AdminField>
                  </div>
                )}
              />
              <p className="text-[10px] text-admin-text-faint mt-2">
                {num(data.geo_sessions)} of {num(data.engagement.sessions)} sessions in this
                range were placed. Unplaced sessions are left out of the shares above rather
                than counted as unknown. The address cache holds {num(data.geo_cached_ips)}{" "}
                resolved addresses in total — that figure is not limited to this range.
              </p>

              {/* Which provider placed them. The chain falls back to a keyless
                  provider when the primary fails, so a table filled entirely by
                  the fallback is the visible symptom of a lapsed token — and the
                  two providers do not always name the same city. */}
              {data.geo_sources && data.geo_sources.length > 0 && (
                <p className="text-[10px] text-admin-text-faint mt-1">
                  Resolved by{" "}
                  {data.geo_sources.map((s, i) => (
                    <span key={s.source}>
                      {i > 0 && " · "}
                      {SOURCE_LABELS[s.source] ?? s.source} {num(s.addresses)}
                    </span>
                  ))}
                  . Providers disagree on some addresses, so a table filled by more than one
                  is a blend of two opinions.
                </p>
              )}
            </>
          ) : data.geo_configured ? (
            /* Configured, and still nothing resolved. Almost always a rejected or
               out-of-quota token: ipinfo answers 403 or 429, resolveAndCache
               caches nothing, and the visit is written without a city. Nothing
               is broken and no session was lost — but this will not fix itself,
               so it says so in amber rather than in the muted grey used for
               "not set up yet". */
            <AdminCard className="p-4 border-admin-warn/40">
              <p className="text-xs text-admin-text">
                <code className="px-1 rounded bg-admin-surface-2">IPINFO_TOKEN</code> is set,
                but nothing has resolved in this range.
              </p>
              <p className="text-[11px] text-admin-warn mt-1">
                Check the token is still valid and inside its monthly quota — a rejected or
                exhausted token returns an error, is not cached, and silently leaves every
                visit without a city. Sessions, the funnel and campaigns are unaffected.
              </p>
              <p className="text-[10px] text-admin-text-faint mt-1">
                If you only just set it, this is expected: cities fill in from the next visit
                onward and existing rows are not backfilled. Widen the range to check whether
                earlier lookups worked.
              </p>
            </AdminCard>
          ) : (
            <AdminCard className="p-4">
              <p className="text-xs text-admin-text-muted">
                No locations resolved yet. Geography is off unless
                <code className="mx-1 px-1 rounded bg-admin-surface-2">IPINFO_TOKEN</code>
                is set in the edge-function secrets; once it is, cities fill in from the
                next visit onward. Existing rows are not backfilled.
              </p>
            </AdminCard>
          )}
        </>
      )}
    </section>
  );
}
