/**
 * Campaigns — which marketing link produced kundalis, accounts and revenue.
 *
 * Fetches on its own rather than riding the analytics payload, for the same
 * reason ClickHeatmap does: this is the newest query in the panel, and a failure
 * in it must not blank the funnel above it.
 *
 * ── The one thing to understand before reading a row ────────────────────────
 * A row is one campaign AND one creative (utm_content), because "which creative
 * worked" is the question a campaign is run to answer — grouping the creatives
 * together would leave a row saying only that the campaign ran.
 *
 * The left columns are SESSION-level, counted from the campaign that session
 * landed on. The right columns are USER-level, counted from that user's
 * first-ever tagged visit. So `Paid` is not a subset of `Sessions` on the same
 * row — a September click that pays in November lands in two different windows.
 * Attributing payments by session instead would report near-zero for every
 * campaign, because almost nobody lands and pays in one sitting.
 *
 * The dev preview is gated three ways, because invented campaign names read out
 * in a meeting would be worse than no preview at all: it is dropped from
 * production builds (import.meta.env.DEV is a compile-time constant, so the
 * dynamic import lets the bundler remove the module), it honours the same
 * ?mockVisitors=0 opt-out as the rest of the panel, and it renders behind a
 * banner saying so. Same contract as AnalyticsDashboard — see dev-visitor-mock.ts.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Megaphone, TrendingUp } from "lucide-react";
import { invokeAdmin } from "@/lib/admin-api";
import { AdminCard, AdminStat } from "./AdminCard";
import { AdminField, AdminTable, type AdminColumn } from "./AdminTable";
import { Breakdown } from "./Breakdown";
import { FunnelSteps, type FunnelStep } from "./FunnelSteps";
import { num, pct, ratio } from "./analytics-format";

export interface CampaignRow {
  source: string;
  medium: string;
  campaign: string;
  /** The creative variant (utm_content). '(none)' when the link carried none. */
  content: string;
  sessions: number;
  kundali_generated: number;
  signed_in: number;
  payment_started: number;
  signed_up_users: number;
  paid_users: number;
  revenue: number;
}

interface Campaigns {
  generated_at: string;
  campaigns: CampaignRow[];
  sources: { source: string; sessions: number; revenue: number }[];
  totals: {
    tagged_sessions: number;
    untagged_sessions: number;
    unattributed_paid_users: number;
  };
}

/** Sentinel for the picker's default option. Not a campaign name — no campaign
 *  can collide with it, because normaliseUtm rejects everything outside
 *  [a-z0-9._-] before a value is ever stored. */
const ALL_TAGGED = "__all_tagged";

/**
 * Rows that represent an actual campaign.
 *
 * `direct` is untagged traffic and `(pre-attribution)` is people who signed up
 * before any of this existed. Folding either into "all tagged traffic" would
 * credit campaigns with users they did not bring — which is the one number in
 * this panel most likely to be quoted in a meeting.
 */
function isCampaign(row: CampaignRow): boolean {
  return row.source !== "direct" && row.source !== "(pre-attribution)";
}

function sumRows(rows: CampaignRow[]): CampaignRow {
  return rows.reduce<CampaignRow>(
    (total, row) => ({
      ...total,
      sessions: total.sessions + row.sessions,
      kundali_generated: total.kundali_generated + row.kundali_generated,
      signed_in: total.signed_in + row.signed_in,
      payment_started: total.payment_started + row.payment_started,
      signed_up_users: total.signed_up_users + row.signed_up_users,
      paid_users: total.paid_users + row.paid_users,
      revenue: total.revenue + row.revenue,
    }),
    {
      source: "", medium: "", campaign: "", content: "",
      sessions: 0, kundali_generated: 0, signed_in: 0, payment_started: 0,
      signed_up_users: 0, paid_users: 0, revenue: 0,
    },
  );
}

/**
 * Six stages in two groups, and the break is the point of the whole component.
 *
 * The first four are counted per session. Accounts and Paid are counted per
 * user, from that user's first-ever tagged visit, so they are measured against
 * accounts rather than sessions — otherwise a campaign whose September clicks
 * pay in November draws a bar wider than its own track. See FunnelSteps.
 */
function campaignFunnelSteps(row: CampaignRow): FunnelStep[] {
  return [
    { key: "sessions", label: "Sessions", value: row.sessions, note: "Landed on a tagged link" },
    { key: "kundali", label: "Kundali generated", value: row.kundali_generated, note: "Guest or signed-in" },
    { key: "signin", label: "Signed in", value: row.signed_in, note: "Google account linked" },
    { key: "paystart", label: "Payment started", value: row.payment_started, note: "₹99 order created" },
    {
      key: "accounts",
      label: "Accounts created",
      value: row.signed_up_users,
      note: "Stamped with this campaign as their first touch",
      groupStart: true,
      baselineNoun: "accounts",
      groupNote:
        "Counted per user, from that user's first-ever tagged visit — not a subset of the sessions above, and measured against accounts from here down.",
    },
    { key: "paid", label: "Paid", value: row.paid_users, note: "From payment_orders, not the browser" },
  ];
}

/** A row of zeroes, so the funnel can show its shape before any campaign runs. */
const EMPTY_ROW: CampaignRow = {
  source: "", medium: "", campaign: "", content: "",
  sessions: 0, kundali_generated: 0, signed_in: 0, payment_started: 0,
  signed_up_users: 0, paid_users: 0, revenue: 0,
};

const money = (value: number) => `₹${num(Math.round(value))}`;

export function CampaignsPanel({
  from,
  to,
  excludeInternal,
}: {
  from: string;
  to: string;
  excludeInternal: boolean;
}) {
  const [data, setData] = useState<Campaigns | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(ALL_TAGGED);
  const [isSample, setIsSample] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await invokeAdmin<{ campaigns?: Campaigns }>({
        action: "campaigns-overview",
        from,
        to,
        excludeInternal,
      });
      const campaigns = response?.campaigns;

      // Dev-only preview, so the funnel is developable before 019 is pushed and
      // before any real campaign has run. The dynamic import is what lets the
      // bundler drop the mock from a production build; a static one would ship
      // the sample campaign names.
      if (import.meta.env.DEV && !campaigns?.campaigns?.length) {
        const dev = await import("@/lib/dev-visitor-mock");
        if (dev.mockVisitorsEnabled()) {
          setData(dev.mockCampaigns({ from: new Date(from), to: new Date(to) }, excludeInternal));
          setIsSample(true);
          setLoading(false);
          return;
        }
      }

      setData(campaigns ?? null);
      setIsSample(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to load campaigns:", message);

      if (import.meta.env.DEV) {
        const dev = await import("@/lib/dev-visitor-mock");
        if (dev.mockVisitorsEnabled()) {
          setData(dev.mockCampaigns({ from: new Date(from), to: new Date(to) }, excludeInternal));
          setIsSample(true);
          setLoading(false);
          return;
        }
      }

      // An error card rather than zeroes: "no campaign produced anything" and
      // "we could not ask" are very different statements to put in front of
      // someone deciding where to spend next month.
      setError(message);
      setData(null);
    }
    setLoading(false);
  }, [from, to, excludeInternal]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  const columns: AdminColumn<CampaignRow>[] = [
    { label: "Campaign", sortValue: (r) => `${r.campaign} ${r.content}` },
    { label: "Sessions", align: "right", sortValue: (r) => r.sessions, descFirst: true },
    { label: "Kundali", align: "right", sortValue: (r) => r.kundali_generated, descFirst: true },
    { label: "Signed in", align: "right", sortValue: (r) => r.signed_in, descFirst: true },
    { label: "Pay started", align: "right", sortValue: (r) => r.payment_started, descFirst: true },
    { label: "Accounts", align: "right", sortValue: (r) => r.signed_up_users, descFirst: true },
    { label: "Paid", align: "right", sortValue: (r) => r.paid_users, descFirst: true },
    { label: "Revenue", align: "right", sortValue: (r) => r.revenue, descFirst: true },
    {
      label: "Session → paid",
      align: "right",
      // -1 rather than null for the unmeasurable case, matching the convention
      // the CTA table already uses: it sorts them together at one end instead of
      // scattering them through the middle.
      sortValue: (r) => ratio(r.paid_users, r.sessions) ?? -1,
      descFirst: true,
      sortLabel: "Session to paid",
    },
  ];

  // Memoised, not a bare `?? []`: that literal is a new array on every render,
  // which would make the memos below recompute every time and defeat them.
  const rows = useMemo(() => data?.campaigns ?? [], [data]);

  // Keyed the same way AdminTable keys its rows, so the picker and the table
  // cannot disagree about which row is which.
  const rowKey = (r: CampaignRow) =>
    `${r.source}|${r.medium}|${r.campaign}|${r.content}`;

  const campaignRows = useMemo(() => rows.filter(isCampaign), [rows]);

  const funnelRow = useMemo(() => {
    if (selected === ALL_TAGGED) return sumRows(campaignRows);
    return campaignRows.find((r) => rowKey(r) === selected) ?? sumRows(campaignRows);
  }, [selected, campaignRows]);

  return (
    <section className="mt-6" data-testid="campaigns-panel">
      <div className="flex items-center gap-2 mb-1">
        <Megaphone className="w-4 h-4 text-admin-text-muted" />
        <h3 className="text-sm font-semibold text-admin-text">Campaigns</h3>
      </div>
      <p className="text-[11px] text-admin-text-faint mb-3 max-w-3xl">
        Sessions, kundalis, sign-ins and pay clicks are counted per session, from the campaign
        that session landed on. Accounts, paid and revenue are counted per user, from that
        user&rsquo;s first-ever tagged visit — so <em>Paid</em> is not a subset of{" "}
        <em>Sessions</em> in the same row.
      </p>

      {loading && <p className="text-xs text-admin-text-muted">Loading campaigns…</p>}

      {!loading && error && (
        <AdminCard className="p-4">
          <p className="text-xs text-admin-warn">Could not load campaigns: {error}</p>
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
                These campaigns are <strong>generated sample data</strong>, not real traffic —
                the rows exist so every branch of the funnel can be checked without waiting
                for a campaign to run. Real numbers appear on their own once
                <code className="mx-1 px-1 rounded bg-admin-surface-2">019_visitor_attribution.sql</code>
                is pushed, the edge functions are redeployed and a tagged link has been
                clicked. Turn this off with
                <code className="mx-1 px-1 rounded bg-admin-surface-2">?mockVisitors=0</code>.
              </p>
            </AdminCard>
          )}

          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <AdminStat value={num(data.totals.tagged_sessions)} label="Tagged sessions" />
            <AdminStat
              value={num(data.totals.untagged_sessions)}
              label="Untagged (direct or referral)"
            />
            <AdminStat
              value={num(data.totals.unattributed_paid_users)}
              label="Paying users with no first touch — they signed up before attribution shipped, and are reported as (pre-attribution) rather than direct"
            />
          </div>

          {rows.length === 0 ? (
            <AdminCard className="p-4">
              <p className="text-xs text-admin-text-muted">
                No campaign data in this period. Sessions only appear here once a link
                carries utm_ parameters — see docs/CAMPAIGN-UTM-GUIDE.md.
              </p>
            </AdminCard>
          ) : (
            <AdminTable<CampaignRow>
              columns={columns}
              rows={rows}
              rowKey={rowKey}
              defaultSort={{ key: "1", dir: "desc" }}
              renderRow={(r) => (
                <>
                  <td className="px-4 py-2.5">
                    <p className="text-xs text-admin-text break-words">{r.campaign}</p>
                    <p className="font-mono text-[10px] text-admin-text-muted break-all">
                      {r.source} / {r.medium}
                      {r.content !== "(none)" && ` · ${r.content}`}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-admin-text-secondary">
                    {num(r.sessions)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-admin-text-secondary">
                    {num(r.kundali_generated)}
                    <span className="text-[10px] text-admin-text-faint ml-1">
                      {pct(ratio(r.kundali_generated, r.sessions))}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-admin-text-secondary">
                    {num(r.signed_in)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-admin-text-secondary">
                    {num(r.payment_started)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-admin-text-secondary">
                    {num(r.signed_up_users)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-admin-ok">
                    {num(r.paid_users)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-admin-text">
                    {money(r.revenue)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-admin-text-muted">
                    {pct(ratio(r.paid_users, r.sessions))}
                  </td>
                </>
              )}
              renderCard={(r) => (
                <div className="space-y-1">
                  <p className="text-xs text-admin-text break-words">{r.campaign}</p>
                  <p className="font-mono text-[10px] text-admin-text-muted break-all mb-1">
                    {r.source} / {r.medium}
                    {r.content !== "(none)" && ` · ${r.content}`}
                  </p>
                  <AdminField label="Sessions">{num(r.sessions)}</AdminField>
                  <AdminField label="Kundali">
                    {num(r.kundali_generated)} · {pct(ratio(r.kundali_generated, r.sessions))}
                  </AdminField>
                  <AdminField label="Signed in">{num(r.signed_in)}</AdminField>
                  <AdminField label="Pay started">{num(r.payment_started)}</AdminField>
                  <AdminField label="Accounts">{num(r.signed_up_users)}</AdminField>
                  <AdminField label="Paid">{num(r.paid_users)}</AdminField>
                  <AdminField label="Revenue">{money(r.revenue)}</AdminField>
                </div>
              )}
            />
          )}

          {/* Always rendered, never gated on having data. It used to be hidden
              whenever no tagged campaign had run — which is every panel before
              the first campaign, i.e. exactly when someone is looking for it —
              and nothing on screen said the funnel existed at all. An empty
              funnel that explains itself beats a missing one. */}
          <AdminCard className="p-4 mt-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-admin-text-muted shrink-0" />
              <h4 className="text-xs font-semibold text-admin-text">Campaign funnel</h4>
              {campaignRows.length > 0 && (
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  aria-label="Campaign funnel"
                  className="min-h-[44px] sm:min-h-[36px] px-2 rounded-lg bg-admin-surface-2 border border-admin-border text-xs text-admin-text min-w-0 max-w-full ml-auto"
                >
                  <option value={ALL_TAGGED}>
                    All tagged traffic · {num(sumRows(campaignRows).sessions)} sessions
                  </option>
                  {campaignRows.map((row) => (
                    <option key={rowKey(row)} value={rowKey(row)}>
                      {row.campaign} · {row.source}/{row.medium}
                      {row.content !== "(none)" ? ` · ${row.content}` : ""} ·{" "}
                      {num(row.sessions)} sessions
                    </option>
                  ))}
                </select>
              )}
            </div>

            {campaignRows.length === 0 ? (
              <p className="text-[11px] text-admin-text-muted mb-3">
                No tagged campaign has been clicked in this range, so there is nothing to
                chart yet — the stages below are the shape it will take. Add
                <code className="mx-1 px-1 rounded bg-admin-surface-2">utm_source</code>,
                <code className="mx-1 px-1 rounded bg-admin-surface-2">utm_medium</code>,
                <code className="mx-1 px-1 rounded bg-admin-surface-2">utm_campaign</code> and
                <code className="mx-1 px-1 rounded bg-admin-surface-2">utm_content</code> to a
                link and it fills in from the first click. See
                docs/CAMPAIGN-UTM-GUIDE.md. Untagged traffic is charted in the
                site-wide funnel above.
              </p>
            ) : (
              <p className="text-[10px] text-admin-text-faint mb-3">
                {selected === ALL_TAGGED
                  ? "Every tagged campaign combined. Direct traffic and (pre-attribution) users are left out — neither was brought here by a campaign."
                  : "One campaign and one creative. The figures match its row in the table above."}
              </p>
            )}

            {campaignRows.length > 0 && funnelRow.sessions === 0 && (
              <p className="text-[11px] text-admin-warn mb-3">
                No sessions for this campaign inside the selected range — its clicks happened
                earlier. The stages below the divider are still counted, which is why a
                campaign can show revenue here with an empty top half.
              </p>
            )}

            <FunnelSteps
              steps={campaignFunnelSteps(campaignRows.length === 0 ? EMPTY_ROW : funnelRow)}
              testId="campaign-funnel"
            />

            {campaignRows.length > 0 && (
              <p className="text-[11px] text-admin-text-muted mt-3 tabular-nums">
                {money(funnelRow.revenue)} from {num(funnelRow.paid_users)} paying{" "}
                {funnelRow.paid_users === 1 ? "user" : "users"}
              </p>
            )}
          </AdminCard>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
            <Breakdown
              title="Sources (tagged)"
              icon={TrendingUp}
              note="Declared utm_source. Compare with Sources (referrer) above — they answer different questions."
              // `direct` and `(pre-attribution)` come back in the RPC's source
              // rollup, but neither carries a utm_source — listing them under a
              // card titled "tagged" contradicts the funnel above, which leaves
              // them out for the same reason.
              rows={data.sources
                .filter((s) => s.source !== "direct" && s.source !== "(pre-attribution)")
                .map((s) => ({ label: s.source, sessions: s.sessions }))}
            />
          </div>

          <p className="text-[10px] text-admin-text-faint mt-3">
            Computed {new Date(data.generated_at).toLocaleString("en-IN")}
          </p>
        </>
      )}
    </section>
  );
}
