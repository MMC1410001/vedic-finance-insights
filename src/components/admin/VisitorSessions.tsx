/**
 * Visitors — IP-level view of who is hitting the app.
 *
 * The IP is captured server-side by the track-visit edge function; nothing here
 * (and nothing in the browser) can observe or forge it. See migration
 * 018_visitor_events.sql for the table and its retention.
 *
 * Reads through admin-user-management (service role) rather than querying
 * visitor_events directly, for the same reason AllKundaliList does: a direct
 * read depends on the admin SELECT policy staying attached, and an empty result
 * from a detached policy is indistinguishable from an empty table.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe, RefreshCw, ChevronDown, ChevronUp, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AdminTable, AdminField } from "./AdminTable";
import { AdminCard, AdminStat, Pill } from "./AdminCard";

interface VisitorSession {
  session_id: string;
  first_seen_at: string;
  last_seen_at: string;
  event_count: number;
  distinct_ips: number;
  last_ip: string | null;
  user_id: string | null;
  last_user_agent: string | null;
  events: string[];
  /** Account email. Null for guests — they have no account to have one. */
  email: string | null;
  full_name: string | null;
  /** "account" = registered name; "kundali" = typed into a guest form. */
  name_source: "account" | "kundali" | null;
  /** >1 means this session generated charts under several names. */
  name_count: number;
  /**
   * One of ours — an office network or a listed team account. Marked here and
   * never hidden: the Analytics section subtracts these from its aggregates, but
   * this table is where you come to see what actually happened.
   */
  internal?: boolean;
}

interface SharedIp {
  ip: string;
  user_count: number;
  emails: string[];
}

const formatSeen = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** "Chrome on Android" is what an operator needs; the full UA string is noise. */
function shortUserAgent(ua: string | null): string {
  if (!ua) return "—";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" : "Other";
  const os =
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad|iOS/.test(ua) ? "iOS" :
    /Windows/.test(ua) ? "Windows" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}

/**
 * Real session ids from kundli_reports, so a sample IP lines up with the rows in
 * the kundali list rather than floating free. Dev-preview only.
 */
async function recentKundaliSessionIds(): Promise<string[]> {
  try {
    const { data } = await supabase.functions.invoke("admin-user-management", {
      body: { action: "list-all-kundalis", limit: 200 },
    });
    return (data?.kundalis ?? [])
      .map((k: { session_id?: string | null }) => k.session_id)
      .filter(Boolean) as string[];
  } catch {
    return [];
  }
}

/**
 * Who a session belongs to.
 *
 * Signed-in sessions show the account email, because that is the durable
 * identifier an operator can act on. Guests have no account, so the only name
 * available is whatever they typed into a kundali form during that session —
 * styled and captioned differently, because presenting it like a registered
 * account name would overstate what is actually known.
 */
/** Marks a session as the team's own, with the reason it is filtered elsewhere. */
function InternalBadge() {
  return (
    <Pill
      tone="bg-admin-info/15 text-admin-info border border-admin-info/40"
      className="ml-1.5 text-[9px] px-1.5 align-middle"
      title="Matches an office network or an internal account. Still recorded and shown here; excluded from Analytics while its Real users toggle is on."
    >
      internal
    </Pill>
  );
}

function VisitorIdentity({ s }: { s: VisitorSession }) {
  if (s.email) {
    return (
      <span className="block min-w-0">
        <span className="block break-all text-admin-text" title={s.email}>{s.email}</span>
        {s.full_name && (
          <span className="block break-words text-[10px] text-admin-text-faint" title={s.full_name}>
            {s.full_name}
          </span>
        )}
      </span>
    );
  }

  if (s.full_name) {
    return (
      <span className="block min-w-0">
        <span
          className="block break-words italic text-admin-text-muted"
          title={
            s.name_source === "kundali"
              ? "From a kundali generated in this session: not a registered account."
              : undefined
          }
        >
          {s.full_name}
          {s.name_count > 1 && (
            <span
              className="ml-1 not-italic text-[10px] text-admin-text-faint"
              title={`This session generated kundalis under ${s.name_count} different names: likely charts for other people, so this is the most recent, not necessarily the visitor.`}
            >
              +{s.name_count - 1}
            </span>
          )}
        </span>
      </span>
    );
  }

  // A signed-in row with no email means the account was deleted but the events
  // survived (visitor_events.user_id is ON DELETE SET NULL, so this is rare).
  return (
    <span
      className="italic text-admin-text-faint"
      title={s.user_id ? "Account not found: it may have been deleted." : "No account and no kundali in this session."}
    >
      —
    </span>
  );
}

export function VisitorSessions() {
  const [sessions, setSessions] = useState<VisitorSession[]>([]);
  const [distinctIps24h, setDistinctIps24h] = useState(0);
  const [sharedIps, setSharedIps] = useState<SharedIp[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Expanded by default. The section nav jumps straight here, and landing on a
  // collapsed header with nothing under it reads as a broken link.
  const [expanded, setExpanded] = useState(true);
  const [isSample, setIsSample] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "guest" | "authenticated">("all");

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "list-visitor-sessions", limit: 500 },
      });

      if (error || data?.error) {
        const msg = error?.message || data?.error || "Unknown error";
        console.error("Failed to fetch visitor sessions:", msg);
        setLoadError(msg);
        setSessions([]);
      } else {
        setSessions((data?.sessions ?? []) as VisitorSession[]);
        setDistinctIps24h(data?.summary?.distinct_ips_24h ?? 0);
        setSharedIps((data?.summary?.shared_ips ?? []) as SharedIp[]);
        setIsSample(false);
      }

      // Dev-only preview, so this panel can be looked at before migration 018 is
      // applied and the edge functions are deployed. Only fires when the real
      // query came back empty, so it disappears on its own once real rows exist.
      // `import.meta.env.DEV` is a compile-time constant, so the dynamic import
      // inside it lets the bundler drop this branch and the mock module entirely
      // from a production build. A static import would ship the sample data.
      if (import.meta.env.DEV && !(data?.sessions ?? []).length) {
        const dev = await import("@/lib/dev-visitor-mock");
        if (dev.mockVisitorsEnabled()) {
          const ids = (await recentKundaliSessionIds()).slice(0, 40);
          const mock = dev.mockVisitorSessions(
            ids.length ? ids : Array.from({ length: 24 }, (_, i) => `sample-session-${i}`),
          );
          setSessions(mock.sessions as VisitorSession[]);
          setDistinctIps24h(mock.summary.distinct_ips_24h);
          setSharedIps(mock.summary.shared_ips);
          setIsSample(true);
          setLoadError(null);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch visitor sessions:", msg);
      setLoadError(msg);
      setSessions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const filtered = useMemo(() => {
    let result = sessions;

    if (filter === "guest") result = result.filter(s => !s.user_id);
    else if (filter === "authenticated") result = result.filter(s => !!s.user_id);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.last_ip?.includes(q) ||
        s.session_id.toLowerCase().includes(q) ||
        s.user_id?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.full_name?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [sessions, filter, search]);

  const guestCount = sessions.filter(s => !s.user_id).length;

  return (
    <div className="mb-8" data-testid="visitor-sessions">
      <div className="w-full flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-3">
        <button
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          className="flex flex-wrap items-center gap-2 min-h-[44px] text-left min-w-0"
        >
          <Globe className="w-4 h-4 text-admin-info shrink-0" />
          <h2 className="text-sm font-semibold text-admin-text">Visitors &amp; IPs</h2>
          {isSample && (
            <Pill size="md" tone="bg-admin-warn/20 text-admin-warn border border-admin-warn/40" className="font-semibold">
              SAMPLE DATA
            </Pill>
          )}
          {!loading && loadError && (
            <Pill size="md" tone="bg-admin-danger/15 text-admin-danger border border-admin-danger/40">
              failed to load
            </Pill>
          )}
          {!loading && !loadError && (
            <Pill size="md" tone="bg-admin-surface-2 text-admin-text-muted border border-admin-border">
              {sessions.length} sessions · {guestCount} guest
            </Pill>
          )}
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchSessions}
            disabled={loading}
            className="flex items-center gap-1.5 px-2 min-h-[44px] text-xs text-admin-text-muted hover:text-admin-text transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            aria-label={expanded ? "Collapse" : "Expand"}
            className="grid place-items-center min-h-[44px] min-w-[44px] text-admin-text-muted hover:text-admin-text transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isSample && (
        <AdminCard className="p-3 mb-3 border-admin-warn/40 bg-admin-warn/10">
          <p className="text-xs text-admin-text">
            These rows are <strong>generated sample data</strong>, not real traffic. Addresses are
            from the RFC&nbsp;5737 documentation ranges and the user ids are fake. Apply
            <code className="mx-1 px-1 rounded bg-admin-surface-2">018_visitor_events.sql</code>
            and deploy <code className="px-1 rounded bg-admin-surface-2">track-visit</code> to see
            real visitors; this panel switches over on its own. Turn it off with
            <code className="mx-1 px-1 rounded bg-admin-surface-2">?mockVisitors=0</code>.
          </p>
        </AdminCard>
      )}

      {/* The two headline numbers stay visible while collapsed — they are the
          reason to open this section at all. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        <AdminStat value={loading ? "—" : distinctIps24h} label="Distinct IPs (24h)" />
        <AdminStat value={loading ? "—" : sessions.length} label="Sessions tracked" />
        <AdminStat
          value={loading ? "—" : sharedIps.length}
          label="IPs with 2+ accounts"
          tone={sharedIps.length > 0 ? "text-admin-warn" : "text-admin-text"}
        />
      </div>

      {sharedIps.length > 0 && (
        <AdminCard className="p-3 mb-3 border-admin-warn/40 bg-admin-warn/10">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-admin-warn shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-admin-text mb-1">
                Addresses seen against more than one account in the last 24h
              </p>
              {/* Stated plainly because this number invites over-reading: Indian
                  mobile carriers put thousands of users behind one address, and
                  a shared office does the same. This is a prompt to look, not a
                  finding. */}
              <p className="text-[11px] text-admin-text-muted mb-2">
                Carrier NAT and shared offices produce this legitimately: treat it as a
                prompt to look, not as evidence.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sharedIps.slice(0, 12).map(s => (
                  <button
                    key={s.ip}
                    onClick={() => { setSearch(s.ip); setExpanded(true); }}
                    // Naming the accounts is what makes this actionable — "two
                    // accounts share an address" is not something you can look
                    // into without knowing which two.
                    title={
                      s.emails?.length
                        ? `Accounts seen from this address:\n${s.emails.join("\n")}`
                        : undefined
                    }
                    className="px-2 min-h-[44px] sm:min-h-0 sm:py-1 rounded-md bg-admin-surface-2 border border-admin-border text-[11px] font-mono text-admin-text hover:border-admin-warn/40 transition-colors"
                  >
                    {s.ip} <span className="text-admin-text-faint">×{s.user_count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </AdminCard>
      )}

      {expanded && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="flex flex-wrap gap-1.5">
              {(["all", "guest", "authenticated"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filter === f
                      ? "bg-admin-info/20 text-admin-info border border-admin-info/40"
                      : "bg-admin-surface-2 text-admin-text-muted border border-admin-border hover:text-admin-text"
                  }`}
                >
                  {f === "all" ? "All" : f === "guest" ? "Guest (No Account)" : "Signed-In Users"}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search IP, session, user id..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[180px] px-3 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg bg-admin-surface-2 border border-admin-border text-admin-text placeholder-admin-text-faint text-xs outline-none focus:border-admin-info/40 transition-colors"
            />
          </div>

          {loading ? (
            <div className="rounded-xl border border-admin-border bg-admin-surface p-8 text-center text-admin-text-faint text-sm">
              <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
              Loading visitor sessions...
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-admin-danger/40 bg-admin-danger/15 p-8 text-center text-admin-danger text-sm">
              <p className="font-medium mb-1">Could not load visitor sessions.</p>
              <p className="text-xs text-admin-danger/80 break-words">{loadError}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-admin-border bg-admin-surface p-8 text-center text-admin-text-faint text-sm">
              {search || filter !== "all"
                ? "No sessions match your filters."
                : "No visitor sessions recorded yet."}
            </div>
          ) : (
            <>
              <AdminTable
                rows={filtered}
                rowKey={(s) => s.session_id}
                maxHeightClass="max-h-[500px]"
                stickyHeader
                // "#" is the row number, so sorting by it is meaningless.
                // Dates and counts open descending: newest and busiest first.
                columns={[
                  { label: "#", className: "w-8" },
                  { label: "IP", sortValue: (s) => s.last_ip },
                  // Sorts on whatever the row actually shows — email for a
                  // signed-in session, the kundali name for a guest — rather
                  // than on email alone, which would drop every guest to the
                  // bottom of a column that is visibly full of names.
                  { label: "User", sortValue: (s) => s.email || s.full_name },
                  { label: "Type", align: "center", sortValue: (s) => (s.user_id ? "Signed-In" : "Guest") },
                  { label: "Device", sortValue: (s) => shortUserAgent(s.last_user_agent) },
                  { label: "Events", align: "center", sortValue: (s) => s.event_count, descFirst: true },
                  { label: "First seen", sortValue: (s) => s.first_seen_at, descFirst: true },
                  { label: "Last seen", sortValue: (s) => s.last_seen_at, descFirst: true },
                ]}
                renderRow={(s, i) => (
                  <>
                    <td className="px-4 py-3 text-admin-text-faint text-xs">{i + 1}</td>
                    <td className="px-4 py-3 text-admin-text text-xs font-mono">
                      {s.last_ip || <span className="italic text-admin-text-faint font-sans">—</span>}
                      {s.distinct_ips > 1 && (
                        <span
                          className="ml-1.5 text-[10px] text-admin-text-faint font-sans"
                          title="This session was seen from more than one address: a network change, or a VPN toggled mid-visit."
                        >
                          +{s.distinct_ips - 1}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs min-w-[200px]">
                      <VisitorIdentity s={s} />
                      {s.internal && <InternalBadge />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Pill
                        tone={
                          s.user_id
                            ? "bg-admin-ok/20 text-admin-ok"
                            : "bg-admin-surface-3/30 text-admin-text-muted"
                        }
                      >
                        {s.user_id ? "signed-in" : "guest"}
                      </Pill>
                    </td>
                    {/* The one column in the panel that stays clipped. Every
                        other name, email, place and IP now wraps, but a raw
                        user-agent is ~150 characters of machine string and
                        wrapping it costs four lines in every row for something
                        nobody reads in full — the title attribute is the right
                        affordance here. */}
                    <td className="px-4 py-3 text-admin-text-muted text-xs max-w-[140px]">
                      <span className="block truncate" title={s.last_user_agent ?? ""}>
                        {shortUserAgent(s.last_user_agent)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-admin-text-muted text-xs" title={s.events?.join(", ")}>
                      {s.event_count}
                    </td>
                    <td className="px-4 py-3 text-admin-text-faint text-xs whitespace-nowrap">
                      {formatSeen(s.first_seen_at)}
                    </td>
                    <td className="px-4 py-3 text-admin-text-faint text-xs whitespace-nowrap">
                      {formatSeen(s.last_seen_at)}
                    </td>
                  </>
                )}
                renderCard={(s) => (
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <span className="text-sm font-mono text-admin-text break-all min-w-0">
                        {s.last_ip || "—"}
                      </span>
                      <Pill
                        className="shrink-0"
                        tone={
                          s.user_id
                            ? "bg-admin-ok/20 text-admin-ok"
                            : "bg-admin-surface-3/30 text-admin-text-muted"
                        }
                      >
                        {s.user_id ? "signed-in" : "guest"}
                      </Pill>
                    </div>
                    <AdminField label="User">
                      <VisitorIdentity s={s} />
                      {s.internal && <InternalBadge />}
                    </AdminField>
                    <AdminField label="Device">{shortUserAgent(s.last_user_agent)}</AdminField>
                    <AdminField label="Events">{s.event_count} · {s.events?.join(", ")}</AdminField>
                    <AdminField label="First seen">{formatSeen(s.first_seen_at)}</AdminField>
                    <AdminField label="Last seen">{formatSeen(s.last_seen_at)}</AdminField>
                  </div>
                )}
              />
              <div className="px-4 py-2 mt-2 text-xs text-admin-text-faint text-center">
                Showing {filtered.length} of {sessions.length} sessions
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
