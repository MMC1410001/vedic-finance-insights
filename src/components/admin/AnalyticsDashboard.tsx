/**
 * Analytics — first-party behavioural reporting for /admin.
 *
 * Why this exists rather than a link to GA4: GA4 (G-WJX6J34M3S) has received
 * nothing but pageviews, because every named click tag stops at window.dataLayer
 * until a trigger is built in GTM container GTM-K8SZDDSJ, which lives outside
 * this repo. Clarity has heatmaps but masks the IP and cannot join a click to
 * payment_orders. The questions this panel answers — "of the guests who
 * generated a kundali, how many then signed in?", "how many pay clicks became
 * payments?" — need our own tables on both sides of the join.
 *
 * Everything comes from admin_analytics() in one round trip (migration 018) via
 * the analytics-overview action. Aggregating in Postgres is not an optimisation:
 * the funnel's last step reads payment_orders, which the browser cannot read for
 * other users at all.
 *
 * Follows PipelineHealth's rules, and one of them is doing real work here:
 * **never render a zero where the truth is "the request failed"**. An empty
 * funnel and a broken endpoint look identical, and only one means nobody
 * converted.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3, Loader2, RefreshCw, AlertTriangle, TrendingUp, Clock,
  MousePointerClick, LogOut, Smartphone, Compass, Filter,
  ArrowDownWideNarrow, Eye, Zap, FormInput, DoorOpen,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { invokeAdmin } from "@/lib/admin-api";
import { useAdminTheme } from "@/lib/admin-theme-context";
import { AdminCard, AdminStat, Pill } from "./AdminCard";
import { AdminTable, type AdminColumn } from "./AdminTable";
import { Breakdown } from "./Breakdown";
import { FunnelSteps, type FunnelStep } from "./FunnelSteps";
import { AudiencePanel } from "./AudiencePanel";
import { CampaignsPanel } from "./CampaignsPanel";
import { ClickHeatmap } from "./ClickHeatmap";
import {
  describeInternal, describeRange, duration, num, pct, RANGE_PRESETS, ratio,
  resolveRange, type RangeId,
} from "./analytics-format";
import { pageLabel } from "@/lib/tracked-pages";

// ─── Types — the shape admin_analytics() returns ────────────────────────────

interface Funnel {
  sessions: number;
  kundali_generated: number;
  signed_in: number;
  payment_started: number;
  payment_completed: number;
  paying_users: number;
  revenue: number;
}

interface PageRow {
  path: string;
  views: number;
  sessions: number;
  avg_seconds: number;
  exits: number;
  exit_pct: number;
}

interface EventRow {
  label: string;
  tagged: boolean;
  clicks: number;
  sessions: number;
  users: number;
}

/**
 * The five admin-only behaviour blocks.
 *
 * Every one of them is fed by an event that is queued through queueEvent() and
 * never routed through analytics() — the app's one window.dataLayer writer — so
 * nothing here exists in GTM or GA4. See ANALYTICS.md → "Admin-only behaviour
 * signals".
 */
interface ScrollRow {
  path: string;
  sessions: number;
  d25: number;
  d50: number;
  d75: number;
  d100: number;
  d25_pct: number;
  d50_pct: number;
  d75_pct: number;
  d100_pct: number;
}

interface CtaRow {
  tag: string;
  seen_sessions: number;
  clicks: number;
  clicked_sessions: number;
  /** Null when the CTA was never recorded as seen — unknown, not zero. */
  ctr: number | null;
}

interface FrictionRow {
  kind: "dead" | "rage";
  path: string | null;
  selector: string;
  events: number;
  sessions: number;
}

interface FormFieldRow {
  form: string;
  field: string;
  sessions: number;
  position: number;
}

interface ExitClickRow {
  label: string;
  path: string | null;
  sessions: number;
  converted: number;
}

interface Analytics {
  generated_at: string;
  days: number;
  funnel: Funnel;
  guest_to_google: {
    generated_as_guest: number;
    then_signed_in: number;
    already_signed_in: number;
  };
  payment: {
    clicks: number;
    sessions: number;
    orders: number;
    completed: number;
    failed: number;
    expired: number;
    pending: number;
    revenue: number;
  };
  engagement: {
    sessions: number;
    avg_seconds: number;
    median_seconds: number;
    bounce_pct: number;
    views_per_session: number;
    identified: number;
    anonymous: number;
  };
  pages: PageRow[];
  events: EventRow[];
  /** Admin-only blocks. Optional so an un-migrated project renders the rest. */
  scroll_depth?: ScrollRow[];
  cta_funnel?: CtaRow[];
  friction?: FrictionRow[];
  form_fields?: FormFieldRow[];
  exit_clicks?: ExitClickRow[];
  devices: { device: string; sessions: number }[];
  browsers: { browser: string; sessions: number }[];
  sources: { source: string; sessions: number }[];
  daily: { day: string; sessions: number; views: number; kundalis: number; signins: number; payments: number }[];
  /**
   * One row per path AND device — see the grouping in migration 018. Rows with no
   * points are absent, so a consumer must read "missing" as zero.
   */
  click_map_paths: {
    path: string;
    /** A viewport-width band (click_viewport_class), not a user-agent label. */
    device: string | null;
    /** 'click' | 'dead' | 'rage'. Absent on rows written before the column. */
    kind?: string;
    points: number;
  }[];
  internal: {
    excluded: boolean;
    sessions_matched: number;
    networks_active: number;
    accounts_active: number;
  };
}

/**
 * Per-operator, not shared. Two admins can hold different views without one
 * silently changing the other's numbers — which is why the chip below always
 * states the current mode rather than leaving it to be inferred from a total.
 *
 * Deliberately NOT in the SIGNED_OUT clear list in auth-context.tsx: that list
 * exists to stop one user seeing another's data, and this is a boolean view
 * preference identical for every admin.
 */
const EXCLUDE_KEY = "admin:analytics:excludeInternal";

function readExcludePreference(): boolean {
  try {
    // Defaults to true. The panel exists to describe real users, so that is what
    // it should show without anyone having to discover a filter first.
    return localStorage.getItem(EXCLUDE_KEY) !== "false";
  } catch {
    return true;
  }
}

/** Today's IST date, for seeding the custom picker with something sensible. */
function istToday(): string {
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
}

// ─── Funnel ─────────────────────────────────────────────────────────────────

/**
 * The five site-wide stages, in order — in two groups, for the same reason the
 * campaign funnel has two.
 *
 * The first four are counted per session from visitor_events. The last is
 * counted from payment_orders, which is a different population and not a subset
 * of them: a browser event can be lost (blocked beacon, closed tab, ad blocker)
 * while the payment row is authoritative, and an order can complete in a window
 * whose session started outside it.
 *
 * That is not hypothetical. On live data this funnel has read `Payment started
 * 0` above `Payment completed 8` — measured against sessions, the last stage
 * drew a band that widened back out to 80% of the track and claimed "42.1% of
 * sessions" for a stage the four above it said nobody reached. Restarting the
 * baseline is what stops the panel asserting that.
 */
function siteFunnelSteps(funnel: Funnel): FunnelStep[] {
  return [
    { key: "sessions", label: "Sessions", value: funnel.sessions, note: "Anyone who loaded the app" },
    { key: "kundali", label: "Kundali generated", value: funnel.kundali_generated, note: "Guest or signed-in" },
    { key: "signin", label: "Signed in", value: funnel.signed_in, note: "Google account linked" },
    { key: "paystart", label: "Payment started", value: funnel.payment_started, note: "₹99 order created" },
    {
      key: "paid",
      label: "Payment completed",
      value: funnel.payment_completed,
      note: "From payment_orders, not the browser",
      groupStart: true,
      baselineNoun: "payments",
      // The one comparison worth making across the break, and the reason this
      // prop exists: as a group of one, this stage's own share is 100% of itself
      // and it has no step-rate, so regrouping removed "payment started →
      // completed" from the funnel altogether. It survives as a headline stat
      // above, but the funnel is where a reader looks for it.
      crossGroupNoun: "pay clicks",
      groupNote:
        "Counted from payment_orders rather than from browser events — a completed order is a database fact, so this is not a subset of the pay clicks above and can exceed them.",
    },
  ];
}

// ─── The panel ──────────────────────────────────────────────────────────────

export function AnalyticsDashboard() {
  const { chartColors } = useAdminTheme();
  const [rangeId, setRangeId] = useState<RangeId>("30d");
  const [custom, setCustom] = useState({ from: istToday(), to: istToday() });
  const [excludeInternal, setExcludeInternal] = useState<boolean>(readExcludePreference);

  // Resolved once per change, not per render: `new Date()` inside the render
  // would make `range` a new object every time and refetch in a loop.
  const range = useMemo(
    () => resolveRange(rangeId, new Date(), custom),
    [rangeId, custom],
  );
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSample, setIsSample] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // invokeAdmin rather than functions.invoke: the latter reports every
      // non-2xx as "Edge Function returned a non-2xx status code" and discards
      // the body, so "migration 018 is not applied" would reach the error card
      // as a status-code string with nothing actionable in it.
      const response = await invokeAdmin<{ analytics?: Analytics }>({
        action: "analytics-overview",
        from: fromIso,
        to: toIso,
        excludeInternal,
      });

      const analytics = response?.analytics;

      // Dev-only preview so this panel is buildable before migration 018 is
      // applied. import.meta.env.DEV is a compile-time constant, so the dynamic
      // import lets the bundler drop the branch and the mock module from a
      // production build — a static import would ship the sample data.
      if (import.meta.env.DEV && !analytics?.funnel?.sessions) {
        const dev = await import("@/lib/dev-visitor-mock");
        if (dev.mockVisitorsEnabled()) {
          setData(dev.mockAnalytics(range, excludeInternal) as unknown as Analytics);
          setIsSample(true);
          setLoading(false);
          return;
        }
      }

      setData(analytics ?? null);
      setIsSample(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to load analytics:", message);

      if (import.meta.env.DEV) {
        const dev = await import("@/lib/dev-visitor-mock");
        if (dev.mockVisitorsEnabled()) {
          setData(dev.mockAnalytics(range, excludeInternal) as unknown as Analytics);
          setIsSample(true);
          setLoading(false);
          return;
        }
      }

      // In production this stays an error card. Zeroes here would be read as
      // "nobody visited", which is a very different statement from "we could
      // not ask".
      setError(message);
      setData(null);
    }
    setLoading(false);
  }, [fromIso, toIso, range, excludeInternal]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    try {
      localStorage.setItem(EXCLUDE_KEY, String(excludeInternal));
    } catch {
      /* private window — the toggle still works, it just will not persist */
    }
  }, [excludeInternal]);

  const guestConversion = data
    ? ratio(data.guest_to_google.then_signed_in, data.guest_to_google.generated_as_guest)
    : null;
  const payConversion = data ? ratio(data.payment.completed, data.payment.sessions) : null;

  const pageColumns: AdminColumn<PageRow>[] = [
    { label: "Page", sortValue: (r) => r.path },
    { label: "Views", align: "right", sortValue: (r) => r.views, descFirst: true },
    { label: "Sessions", align: "right", sortValue: (r) => r.sessions, descFirst: true },
    { label: "Avg time", align: "right", sortValue: (r) => r.avg_seconds, descFirst: true },
    { label: "Exits", align: "right", sortValue: (r) => r.exits, descFirst: true },
    { label: "Exit rate", align: "right", sortValue: (r) => r.exit_pct, descFirst: true },
  ];

  const eventColumns: AdminColumn<EventRow>[] = [
    { label: "Element", sortValue: (r) => r.label },
    { label: "Named", align: "center", sortValue: (r) => r.tagged, descFirst: true, sortLabel: "Named tag" },
    { label: "Clicks", align: "right", sortValue: (r) => r.clicks, descFirst: true },
    { label: "Sessions", align: "right", sortValue: (r) => r.sessions, descFirst: true },
    { label: "Users", align: "right", sortValue: (r) => r.users, descFirst: true },
  ];

  const scrollColumns: AdminColumn<ScrollRow>[] = [
    { label: "Page", sortValue: (r) => r.path },
    { label: "Sessions", align: "right", sortValue: (r) => r.sessions, descFirst: true },
    { label: "25%", align: "right", sortValue: (r) => r.d25_pct, descFirst: true, sortLabel: "Reached 25%" },
    { label: "50%", align: "right", sortValue: (r) => r.d50_pct, descFirst: true, sortLabel: "Reached 50%" },
    { label: "75%", align: "right", sortValue: (r) => r.d75_pct, descFirst: true, sortLabel: "Reached 75%" },
    { label: "100%", align: "right", sortValue: (r) => r.d100_pct, descFirst: true, sortLabel: "Reached 100%" },
  ];

  const ctaColumns: AdminColumn<CtaRow>[] = [
    { label: "CTA", sortValue: (r) => r.tag },
    { label: "Seen by", align: "right", sortValue: (r) => r.seen_sessions, descFirst: true },
    { label: "Clicked by", align: "right", sortValue: (r) => r.clicked_sessions, descFirst: true },
    { label: "Clicks", align: "right", sortValue: (r) => r.clicks, descFirst: true },
    // -1 for an unknown rate, so the sortable value is total and the unknowns
    // gather at one end instead of being ordered arbitrarily against real zeroes.
    { label: "Click-through", align: "right", sortValue: (r) => r.ctr ?? -1, descFirst: true },
  ];

  const frictionColumns: AdminColumn<FrictionRow>[] = [
    { label: "Kind", align: "center", sortValue: (r) => r.kind },
    { label: "Page", sortValue: (r) => r.path ?? "" },
    { label: "Nearest element", sortValue: (r) => r.selector },
    { label: "Events", align: "right", sortValue: (r) => r.events, descFirst: true },
    { label: "Sessions", align: "right", sortValue: (r) => r.sessions, descFirst: true },
  ];

  const exitColumns: AdminColumn<ExitClickRow>[] = [
    { label: "Last click", sortValue: (r) => r.label },
    { label: "Page", sortValue: (r) => r.path ?? "" },
    { label: "Sessions", align: "right", sortValue: (r) => r.sessions, descFirst: true },
    { label: "Of which reached checkout", align: "right", sortValue: (r) => r.converted, descFirst: true, sortLabel: "Reached checkout" },
  ];

  const daily = useMemo(() => data?.daily ?? [], [data]);

  /**
   * Form fields grouped by form, in the order visitors actually met them.
   *
   * Sorted by `position` — the field's place in each visitor's own progression —
   * and never by volume: a funnel read out of order is not a funnel. The reach
   * percentage is against the FIRST field of the same form, because that is the
   * population that started filling it in; against all sessions it would report
   * the share of site traffic that touched the form, which is a different
   * question and a much smaller number.
   */
  const formGroups = useMemo(() => {
    const rows = data?.form_fields ?? [];
    const byForm = new Map<string, FormFieldRow[]>();
    for (const row of rows) {
      const list = byForm.get(row.form) ?? [];
      list.push(row);
      byForm.set(row.form, list);
    }
    return [...byForm.entries()].map(([form, fields]) => {
      const ordered = [...fields].sort((a, b) => a.position - b.position);
      const first = ordered[0]?.sessions ?? 0;
      return {
        form,
        first,
        fields: ordered.map((f) => ({
          ...f,
          reach_pct: first > 0 ? (f.sessions / first) * 100 : null,
        })),
      };
    });
  }, [data]);

  return (
    <div className="mb-8" data-testid="analytics-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="w-4 h-4 text-admin-info shrink-0" />
          <h2 className="text-sm font-semibold text-admin-text">Behaviour &amp; conversion</h2>
          {/* Named, because "30d" and "1-14 Aug" are not self-describing once
              the reader has scrolled, and IST is not the reader's assumption. */}
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-admin-surface-2 text-admin-text-muted border border-admin-border"
            data-testid="range-label"
          >
            {describeRange(rangeId, range)}
          </span>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-admin-text-muted" />}
          {!loading && error && (
            <Pill size="md" tone="bg-admin-danger/15 text-admin-danger border border-admin-danger/40">
              failed to load
            </Pill>
          )}
          {isSample && (
            <Pill size="md" tone="bg-admin-warn/20 text-admin-warn border border-admin-warn/40" className="font-semibold">
              SAMPLE DATA
            </Pill>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-admin-border">
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setRangeId(preset.id)}
                aria-pressed={rangeId === preset.id}
                className={`px-3 min-h-[44px] sm:min-h-[36px] text-xs transition-colors ${
                  rangeId === preset.id
                    ? "bg-admin-info-strong text-white"
                    : "bg-admin-surface-2 text-admin-text-muted hover:text-admin-text"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {rangeId === "custom" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={custom.from}
                max={istToday()}
                aria-label="From date"
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                className="px-2 min-h-[44px] sm:min-h-[36px] rounded-lg bg-admin-surface-2 border border-admin-border text-xs text-admin-text"
              />
              <span className="text-xs text-admin-text-faint">to</span>
              <input
                type="date"
                value={custom.to}
                max={istToday()}
                aria-label="To date"
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                className="px-2 min-h-[44px] sm:min-h-[36px] rounded-lg bg-admin-surface-2 border border-admin-border text-xs text-admin-text"
              />
            </div>
          )}
          {/* Two labelled states rather than a bare checkbox: "Real users" and
              "All traffic" each say what the number below them means, whereas an
              unchecked box says only that something is off. */}
          <div className="flex rounded-lg overflow-hidden border border-admin-border">
            {[
              { value: true, label: "Real users" },
              { value: false, label: "All traffic" },
            ].map((mode) => (
              <button
                key={String(mode.value)}
                onClick={() => setExcludeInternal(mode.value)}
                aria-pressed={excludeInternal === mode.value}
                className={`px-3 min-h-[44px] sm:min-h-[36px] text-xs transition-colors ${
                  excludeInternal === mode.value
                    ? "bg-admin-info-strong text-white"
                    : "bg-admin-surface-2 text-admin-text-muted hover:text-admin-text"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center gap-1.5 px-2 min-h-[44px] text-xs text-admin-text-muted hover:text-admin-text transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {isSample && (
        <AdminCard className="p-3 mb-4 border-admin-warn/40 bg-admin-warn/10">
          <p className="text-xs text-admin-text">
            These figures are <strong>generated sample data</strong>, not real traffic. The
            pipeline is live in production; this is the local fallback when the dev database
            has no rows, or when a migration is pending &mdash; run
            <code className="mx-1 px-1 rounded bg-admin-surface-2">supabase db push</code>
            and redeploy <code className="px-1 rounded bg-admin-surface-2">track-visit</code> and
            <code className="mx-1 px-1 rounded bg-admin-surface-2">admin-user-management</code>.
            This panel switches over on its own. Turn it off with
            <code className="mx-1 px-1 rounded bg-admin-surface-2">?mockVisitors=0</code>.
          </p>
        </AdminCard>
      )}

      {error && !data && (
        <AdminCard className="p-4 border-admin-danger/40 bg-admin-danger/10">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-admin-danger shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-admin-text mb-1">
                Analytics could not be loaded
              </p>
              <p className="text-[11px] text-admin-text-muted font-mono break-words">{error}</p>
              <p className="text-[11px] text-admin-text-muted mt-2">
                Showing nothing rather than zeroes on purpose: an empty funnel and a
                failed request are not the same finding. If this says a function or a
                column is missing, a migration has been added since the last
                <code className="mx-1 px-1 rounded bg-admin-surface-2">supabase db push</code>
                or the edge functions need redeploying.
              </p>
            </div>
          </div>
        </AdminCard>
      )}

      {data && (
        <>
          {/* Above every number it qualifies, not tucked in a corner. Whichever
              mode is on, the reader is told before they read a total. */}
          {(() => {
            const notice = describeInternal(data.internal);
            if (!notice) return null;
            return (
              <AdminCard
                className={`p-3 mb-4 ${
                  notice.tone === "warn" ? "border-admin-warn/40 bg-admin-warn/10" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <Filter
                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                      notice.tone === "warn" ? "text-admin-warn" : "text-admin-text-muted"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-admin-text" data-testid="internal-notice">
                      {notice.headline}
                    </p>
                    <p className="text-[11px] text-admin-text-muted mt-0.5">
                      {notice.detail} Manage them under <strong>IP Addresses → Internal traffic</strong>.
                    </p>
                  </div>
                </div>
              </AdminCard>
            );
          })()}

          {/* The two questions this panel was built to answer, first. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
            <AdminStat
              value={loading ? "—" : pct(guestConversion)}
              label="Guest kundali → Google sign-in"
              tone="text-admin-info"
            />
            <AdminStat
              value={loading ? "—" : pct(payConversion)}
              label="Pay clicked → payment completed"
              tone={payConversion !== null && payConversion < 50 ? "text-admin-warn" : "text-admin-ok"}
            />
            <AdminStat
              value={loading ? "—" : duration(data.engagement.avg_seconds)}
              label="Average session"
            />
            <AdminStat
              value={loading ? "—" : `${data.engagement.bounce_pct}%`}
              label="Left without navigating"
              tone={data.engagement.bounce_pct > 60 ? "text-admin-warn" : "text-admin-text"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mb-4">
            <AdminCard className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-3.5 h-3.5 text-admin-text-muted" />
                <h3 className="text-xs font-semibold text-admin-text">
                  Funnel · {describeRange(rangeId, range).toLowerCase()}
                </h3>
              </div>
              <FunnelSteps steps={siteFunnelSteps(data.funnel)} testId="site-funnel" />
            </AdminCard>

            <div className="space-y-4">
              <AdminCard className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MousePointerClick className="w-3.5 h-3.5 text-admin-text-muted" />
                  <h3 className="text-xs font-semibold text-admin-text">Checkout</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { label: "Pay clicks", value: num(data.payment.clicks) },
                    { label: "Orders created", value: num(data.payment.orders) },
                    { label: "Completed", value: num(data.payment.completed), tone: "text-admin-ok" },
                    { label: "Failed", value: num(data.payment.failed), tone: "text-admin-danger" },
                    { label: "Expired", value: num(data.payment.expired), tone: "text-admin-warn" },
                    { label: "Revenue", value: `₹${num(data.payment.revenue)}` },
                  ].map((cell) => (
                    <div key={cell.label}>
                      <p className={`text-base font-semibold tabular-nums ${cell.tone ?? "text-admin-text"}`}>
                        {cell.value}
                      </p>
                      <p className="text-[10px] text-admin-text-muted">{cell.label}</p>
                    </div>
                  ))}
                </div>
                {/* Named explicitly because "clicks minus completed" is the number
                    worth acting on, and nobody should have to subtract it. */}
                <p className="text-[11px] text-admin-text-muted mt-3">
                  {num(Math.max(data.payment.clicks - data.payment.completed, 0))} pay clicks did
                  not end in a payment.
                </p>
              </AdminCard>

              <AdminCard className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3.5 h-3.5 text-admin-text-muted" />
                  <h3 className="text-xs font-semibold text-admin-text">Engagement</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { label: "Sessions", value: num(data.engagement.sessions) },
                    { label: "Median session", value: duration(data.engagement.median_seconds) },
                    { label: "Pages / session", value: data.engagement.views_per_session.toFixed(2) },
                    { label: "Signed in", value: num(data.engagement.identified) },
                    { label: "Anonymous", value: num(data.engagement.anonymous) },
                    { label: "Guests already signed in", value: num(data.guest_to_google.already_signed_in) },
                  ].map((cell) => (
                    <div key={cell.label}>
                      <p className="text-base font-semibold text-admin-text tabular-nums">{cell.value}</p>
                      <p className="text-[10px] text-admin-text-muted">{cell.label}</p>
                    </div>
                  ))}
                </div>
              </AdminCard>
            </div>
          </div>

          {/* Daily series. Zeroes come back as explicit zeroes from the RPC — 015
              learned that a missing key renders as a gap, which reads as "no
              data" rather than the zero it is. */}
          <AdminCard className="p-4 mb-4">
            <h3 className="text-xs font-semibold text-admin-text mb-3">
              Daily · sessions, kundalis, payments
            </h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: chartColors.tick, fontSize: 10 }}
                    stroke={chartColors.axis}
                    tickFormatter={(d: string) => d.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fill: chartColors.tick, fontSize: 10 }} stroke={chartColors.axis} />
                  <Tooltip
                    contentStyle={{
                      background: chartColors.tooltipBg,
                      border: `1px solid ${chartColors.tooltipBorder}`,
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    labelStyle={{ color: chartColors.legend }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: chartColors.legend }} />
                  <Line type="monotone" dataKey="sessions" stroke={chartColors.signed_in} dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="kundalis" stroke={chartColors.guest} dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="payments" stroke={chartColors.admin} dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </AdminCard>

          {/* Drop-off. Exit rate is the whole point of this table. */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <LogOut className="w-3.5 h-3.5 text-admin-text-muted" />
              <h3 className="text-xs font-semibold text-admin-text">
                Pages, and where people leave
              </h3>
            </div>
            <p className="text-[11px] text-admin-text-muted mb-2">
              Exit rate is the share of views that were the last page of a session. Average
              time excludes the final page of each session: nothing marks its end, so
              counting it as zero would drag every figure down.
            </p>
            <AdminTable
              columns={pageColumns}
              rows={data.pages}
              rowKey={(row) => row.path}
              defaultSort={{ key: "1", dir: "desc" }}
              renderRow={(row) => (
                <>
                  {/* The human name above the path. An unrecognised path — a
                      route since removed, or one recorded before normalisation —
                      shows bare rather than being relabelled into something
                      reassuring, because pageLabel() returns the path itself. */}
                  <td className="px-3 py-2 text-admin-text">
                    {pageLabel(row.path) !== row.path && (
                      <span className="block">{pageLabel(row.path)}</span>
                    )}
                    <span className="font-mono text-[11px] text-admin-text-muted">{row.path}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-admin-text">{num(row.views)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-admin-text-muted">{num(row.sessions)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-admin-text-muted">{duration(row.avg_seconds)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-admin-text-muted">{num(row.exits)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${row.exit_pct > 60 ? "text-admin-warn" : "text-admin-text"}`}>
                    {row.exit_pct}%
                  </td>
                </>
              )}
              renderCard={(row) => (
                <div className="space-y-1">
                  {pageLabel(row.path) !== row.path && (
                    <p className="text-xs text-admin-text">{pageLabel(row.path)}</p>
                  )}
                  <p className="font-mono text-[11px] text-admin-text-muted break-all">{row.path}</p>
                  <p className="text-[11px] text-admin-text-muted tabular-nums">
                    {num(row.views)} views · {num(row.sessions)} sessions · {duration(row.avg_seconds)} avg
                  </p>
                  <p className={`text-[11px] tabular-nums ${row.exit_pct > 60 ? "text-admin-warn" : "text-admin-text-muted"}`}>
                    {num(row.exits)} exits · {row.exit_pct}% exit rate
                  </p>
                </div>
              )}
            />
          </div>

          {/* Clicks. "Named" separates the 33 agreed GTM tags from everything the
              delegated listener picked up on its own. */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MousePointerClick className="w-3.5 h-3.5 text-admin-text-muted" />
              <h3 className="text-xs font-semibold text-admin-text">What gets clicked</h3>
            </div>
            <p className="text-[11px] text-admin-text-muted mb-2">
              A named row carries one of the agreed GTM tag strings. An unnamed row was
              identified by the delegated listener from the element itself, so its label
              changes if the button's text changes.
            </p>
            <AdminTable
              columns={eventColumns}
              rows={data.events}
              rowKey={(row) => row.label}
              defaultSort={{ key: "2", dir: "desc" }}
              renderRow={(row) => (
                <>
                  <td className="px-3 py-2 text-admin-text min-w-[240px] break-all" title={row.label}>
                    {row.label}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.tagged ? (
                      <Pill tone="bg-admin-ok/15 text-admin-ok border border-admin-ok/40" className="px-1.5">
                        tag
                      </Pill>
                    ) : (
                      <span className="text-[10px] text-admin-text-faint">derived</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-admin-text">{num(row.clicks)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-admin-text-muted">{num(row.sessions)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-admin-text-muted">{num(row.users)}</td>
                </>
              )}
              renderCard={(row) => (
                <div className="space-y-1">
                  <p className="text-xs text-admin-text break-words">{row.label}</p>
                  <p className="text-[11px] text-admin-text-muted tabular-nums">
                    {num(row.clicks)} clicks · {num(row.sessions)} sessions · {num(row.users)} users
                    {!row.tagged && " · derived label"}
                  </p>
                </div>
              )}
            />
          </div>

          {/* ── Admin-only behaviour signals ──────────────────────────────────
              Everything from here to the heatmap is fed by events that never reach
              window.dataLayer, so GTM, GA4 and Clarity know nothing about them and
              none of the agreed click-tag strings is affected. They answer the
              questions the tables above cannot: where reading stops, which control
              was seen but not pressed, where people click and nothing happens, which
              form field the flow dies on, and what they touched last. */}
          <AdminCard className="p-3 mb-4 border-admin-info/30 bg-admin-info/5">
            <p className="text-[11px] text-admin-text-muted">
              The five sections below come from <strong>our own</strong> instrumentation
              only. They are not GTM tags and never reach dataLayer, GA4 or Clarity, so
              nothing here can collide with the analytics team's container.
            </p>
          </AdminCard>

          {/* Scroll reach. The only signal at all on a page whose sole interaction
              is scrolling — the legal pages, the long landing sections. */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownWideNarrow className="w-3.5 h-3.5 text-admin-text-muted" />
              <h3 className="text-xs font-semibold text-admin-text">
                Where people stop scrolling
              </h3>
            </div>
            <p className="text-[11px] text-admin-text-muted mb-2">
              The share of each page's sessions that reached a given depth. The
              denominator is every session that opened the page, including those that
              left without scrolling — so a low 25% means people are leaving
              immediately, not that the measurement is missing. A page that fits the
              viewport reports 100% for everyone, correctly.
            </p>
            {(data.scroll_depth ?? []).length === 0 ? (
              <AdminCard className="p-3">
                <p className="text-xs text-admin-text-muted">
                  No scroll depth recorded yet in this period.
                </p>
              </AdminCard>
            ) : (
              <AdminTable
                columns={scrollColumns}
                rows={data.scroll_depth ?? []}
                rowKey={(row) => row.path}
                defaultSort={{ key: "1", dir: "desc" }}
                renderRow={(row) => (
                  <>
                    <td className="px-3 py-2 text-admin-text">
                      {pageLabel(row.path) !== row.path && (
                        <span className="block">{pageLabel(row.path)}</span>
                      )}
                      <span className="font-mono text-[11px] text-admin-text-muted">{row.path}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-admin-text">{num(row.sessions)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-admin-text-muted">{row.d25_pct}%</td>
                    <td className="px-3 py-2 text-right tabular-nums text-admin-text-muted">{row.d50_pct}%</td>
                    <td className="px-3 py-2 text-right tabular-nums text-admin-text-muted">{row.d75_pct}%</td>
                    {/* The one column worth colouring: a page almost nobody finishes. */}
                    <td className={`px-3 py-2 text-right tabular-nums ${row.d100_pct < 15 ? "text-admin-warn" : "text-admin-text"}`}>
                      {row.d100_pct}%
                    </td>
                  </>
                )}
                renderCard={(row) => (
                  <div className="space-y-1">
                    {pageLabel(row.path) !== row.path && (
                      <p className="text-xs text-admin-text">{pageLabel(row.path)}</p>
                    )}
                    <p className="font-mono text-[11px] text-admin-text-muted break-all">{row.path}</p>
                    <p className="text-[11px] text-admin-text-muted tabular-nums">
                      {num(row.sessions)} sessions · 25%: {row.d25_pct}% · 50%: {row.d50_pct}%
                    </p>
                    <p className={`text-[11px] tabular-nums ${row.d100_pct < 15 ? "text-admin-warn" : "text-admin-text-muted"}`}>
                      75%: {row.d75_pct}% · reached the end: {row.d100_pct}%
                    </p>
                  </div>
                )}
              />
            )}
          </div>

          {/* CTA impressions. The denominator the clicks table has never had. */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-3.5 h-3.5 text-admin-text-muted" />
              <h3 className="text-xs font-semibold text-admin-text">
                CTAs: seen versus clicked
              </h3>
            </div>
            <p className="text-[11px] text-admin-text-muted mb-2">
              "Seen by" counts sessions where the control was at least half on screen
              for a full second — a fling past it does not count. A low click-through on
              a high "seen by" is a control people are looking at and rejecting; a low
              "seen by" means they never got to it, which is a different problem with a
              different fix. A dash means the control was clicked but never recorded as
              seen, so there is no rate to give.
            </p>
            {(data.cta_funnel ?? []).length === 0 ? (
              <AdminCard className="p-3">
                <p className="text-xs text-admin-text-muted">
                  No CTA impressions recorded yet in this period.
                </p>
              </AdminCard>
            ) : (
              <AdminTable
                columns={ctaColumns}
                rows={data.cta_funnel ?? []}
                rowKey={(row) => row.tag}
                defaultSort={{ key: "1", dir: "desc" }}
                renderRow={(row) => (
                  <>
                    <td className="px-3 py-2 text-admin-text min-w-[240px] break-all" title={row.tag}>
                      {row.tag}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-admin-text">{num(row.seen_sessions)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-admin-text-muted">{num(row.clicked_sessions)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-admin-text-muted">{num(row.clicks)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${
                      row.ctr === null ? "text-admin-text-faint" : row.ctr < 2 ? "text-admin-warn" : "text-admin-text"
                    }`}>
                      {row.ctr === null ? "—" : `${row.ctr}%`}
                    </td>
                  </>
                )}
                renderCard={(row) => (
                  <div className="space-y-1">
                    <p className="text-xs text-admin-text break-words">{row.tag}</p>
                    <p className="text-[11px] text-admin-text-muted tabular-nums">
                      seen by {num(row.seen_sessions)} · clicked by {num(row.clicked_sessions)} ·{" "}
                      {num(row.clicks)} clicks
                    </p>
                    <p className={`text-[11px] tabular-nums ${
                      row.ctr === null ? "text-admin-text-faint" : row.ctr < 2 ? "text-admin-warn" : "text-admin-text-muted"
                    }`}>
                      click-through {row.ctr === null ? "unknown" : `${row.ctr}%`}
                    </p>
                  </div>
                )}
              />
            )}
          </div>

          {/* Friction. The counterpart to the heatmap's Dead clicks toggle. */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-admin-text-muted" />
              <h3 className="text-xs font-semibold text-admin-text">
                Clicks that did nothing
              </h3>
            </div>
            <p className="text-[11px] text-admin-text-muted mb-2">
              A <strong>dead</strong> click hit no button, link or field. A{" "}
              <strong>rage</strong> click is three or more in one spot inside 700ms.
              Both used to be discarded, which is why an empty area of the heatmap was
              ambiguous: nobody clicking there and everybody clicking there fruitlessly
              looked the same. Dead clicks are a 15% sample, capped per page view. The
              element named is the nearest one that could be identified — it is not a
              control, by definition.
            </p>
            {(data.friction ?? []).length === 0 ? (
              <AdminCard className="p-3">
                <p className="text-xs text-admin-text-muted">
                  No dead or rage clicks recorded yet in this period.
                </p>
              </AdminCard>
            ) : (
              <AdminTable
                columns={frictionColumns}
                rows={data.friction ?? []}
                rowKey={(row, i) => `${row.kind}-${row.path}-${row.selector}-${i}`}
                defaultSort={{ key: "3", dir: "desc" }}
                renderRow={(row) => (
                  <>
                    <td className="px-3 py-2 text-center">
                      <Pill
                        tone={row.kind === "rage"
                          ? "bg-admin-danger/15 text-admin-danger border border-admin-danger/40"
                          : "bg-admin-warn/15 text-admin-warn border border-admin-warn/40"}
                        className="px-1.5"
                      >
                        {row.kind}
                      </Pill>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-admin-text-muted">{row.path ?? "—"}</td>
                    <td className="px-3 py-2 text-admin-text min-w-[200px] break-all" title={row.selector}>
                      {row.selector}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-admin-text">{num(row.events)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-admin-text-muted">{num(row.sessions)}</td>
                  </>
                )}
                renderCard={(row) => (
                  <div className="space-y-1">
                    <p className="text-xs text-admin-text break-words">
                      <span className={row.kind === "rage" ? "text-admin-danger" : "text-admin-warn"}>
                        {row.kind}
                      </span>{" "}
                      · {row.selector}
                    </p>
                    <p className="font-mono text-[11px] text-admin-text-muted break-all">{row.path ?? "—"}</p>
                    <p className="text-[11px] text-admin-text-muted tabular-nums">
                      {num(row.events)} events · {num(row.sessions)} sessions
                    </p>
                  </div>
                )}
              />
            )}
          </div>

          {/* Form reach. The drop the funnel cannot see at all: someone who opens
              the birth-details form and abandons it is absent from every count. */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <FormInput className="w-3.5 h-3.5 text-admin-text-muted" />
              <h3 className="text-xs font-semibold text-admin-text">
                Where the form stalls
              </h3>
            </div>
            <p className="text-[11px] text-admin-text-muted mb-2">
              Sessions that focused each field, in the order visitors met them.
              Percentages are against the first field of the same form — the people who
              actually started filling it in. There is no separate "abandoned" figure
              because abandonment is the gap between one row and the next.
            </p>
            {formGroups.length === 0 ? (
              <AdminCard className="p-3">
                <p className="text-xs text-admin-text-muted">
                  No form field activity recorded yet in this period.
                </p>
              </AdminCard>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {formGroups.map((group) => (
                  <AdminCard key={group.form} className="p-3">
                    <p className="text-[11px] uppercase tracking-wide text-admin-text-faint mb-2">
                      {group.form}
                    </p>
                    <ul className="space-y-1.5">
                      {group.fields.map((field) => (
                        <li key={field.field} className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-[11px] text-admin-text truncate">
                            {field.field}
                          </span>
                          {/* A bar, because the shape of the decay is the finding and
                              five numbers in a column do not show a shape. */}
                          <span className="flex-1 h-1.5 rounded-full bg-admin-surface-2 overflow-hidden">
                            <span
                              className="block h-full bg-admin-info-strong"
                              style={{ width: `${Math.min(100, field.reach_pct ?? 0)}%` }}
                            />
                          </span>
                          <span className="tabular-nums text-admin-text-muted shrink-0">
                            {num(field.sessions)}
                            {field.reach_pct !== null && ` · ${field.reach_pct.toFixed(0)}%`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </AdminCard>
                ))}
              </div>
            )}
          </div>

          {/* Last click before leaving. Needs no new event — a session's final click
              row already is the answer. */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <DoorOpen className="w-3.5 h-3.5 text-admin-text-muted" />
              <h3 className="text-xs font-semibold text-admin-text">
                What they touched last
              </h3>
            </div>
            <p className="text-[11px] text-admin-text-muted mb-2">
              The final click of each session, ranked. Read it with the last column:
              the same control at the end of sessions that reached checkout is the end of
              a journey that worked, and at the end of sessions that did not, it is where
              people gave up. The clicks table above cannot show this — it ranks by
              volume, so it is dominated by whatever everyone clicks on the way in.
            </p>
            {(data.exit_clicks ?? []).length === 0 ? (
              <AdminCard className="p-3">
                <p className="text-xs text-admin-text-muted">
                  No clicks recorded yet in this period.
                </p>
              </AdminCard>
            ) : (
              <AdminTable
                columns={exitColumns}
                rows={data.exit_clicks ?? []}
                rowKey={(row, i) => `${row.label}-${row.path}-${i}`}
                defaultSort={{ key: "2", dir: "desc" }}
                renderRow={(row) => (
                  <>
                    <td className="px-3 py-2 text-admin-text min-w-[220px] break-all" title={row.label}>
                      {row.label}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-admin-text-muted">{row.path ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-admin-text">{num(row.sessions)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-admin-text-muted">
                      {num(row.converted)}
                    </td>
                  </>
                )}
                renderCard={(row) => (
                  <div className="space-y-1">
                    <p className="text-xs text-admin-text break-words">{row.label}</p>
                    <p className="font-mono text-[11px] text-admin-text-muted break-all">{row.path ?? "—"}</p>
                    <p className="text-[11px] text-admin-text-muted tabular-nums">
                      {num(row.sessions)} sessions ended here · {num(row.converted)} of them
                      reached checkout
                    </p>
                  </div>
                )}
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
            <Breakdown
              title="Devices"
              icon={Smartphone}
              rows={data.devices.map((d) => ({ label: d.device, sessions: d.sessions }))}
            />
            <Breakdown
              title="Browsers"
              icon={Compass}
              rows={data.browsers.map((b) => ({ label: b.browser, sessions: b.sessions }))}
            />
            <Breakdown
              title="Sources (referrer)"
              icon={TrendingUp}
              note="Bucketed from the referring host. Says nothing about which campaign."
              rows={data.sources.map((s) => ({ label: s.source, sessions: s.sessions }))}
            />
          </div>

          {/* Its own fetch, like the heatmap: a failing campaigns RPC must not
              blank the funnel above it. */}
          <AudiencePanel from={fromIso} to={toIso} excludeInternal={excludeInternal} />

          <CampaignsPanel from={fromIso} to={toIso} excludeInternal={excludeInternal} />

          <ClickHeatmap
            paths={data.click_map_paths ?? []}
            isSample={isSample}
            from={fromIso}
            to={toIso}
            excludeInternal={excludeInternal}
          />

          <p className="text-[10px] text-admin-text-faint mt-4">
            Computed {new Date(data.generated_at).toLocaleString("en-IN")} · GA4 and Clarity
            are still running in parallel; compare against them before trusting a number
            enough to act on it.
          </p>
        </>
      )}
    </div>
  );
}
