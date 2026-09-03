/**
 * Admin Panel — view and manage users.
 *
 * Access is decided server-side: every action calls the admin-user-management
 * edge function, which verifies the caller's JWT and their user_profiles.is_admin
 * flag. AdminRoute additionally keeps the page from rendering for non-admins,
 * but that is presentation only. There is deliberately no password here — the
 * previous ADMIN_PASSWORD constant shipped in the client bundle.
 *
 * Single unified view with expandable rows showing each user's kundalis.
 */

import { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext, type ReactNode } from "react";
import { AlertTriangle, Trash2, RefreshCw, Sparkles, ChevronDown, ChevronUp, ExternalLink, User, MapPin, Loader2, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PipelineHealth } from "@/components/admin/PipelineHealth";
import { VisitorSessions } from "@/components/admin/VisitorSessions";
import { InternalTraffic } from "@/components/admin/InternalTraffic";
import { AdminAccess } from "@/components/admin/AdminAccess";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { AdminThemeProvider, useAdminTheme } from "@/lib/admin-theme-context";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import { AdminTable, AdminField } from "@/components/admin/AdminTable";
import { MobileSortBar, SortHeader } from "@/components/admin/TableSortControls";
import { ariaSort, useTableSort, type SortableColumn } from "@/components/admin/table-sort";
import { AdminStat, Pill } from "@/components/admin/AdminCard";
import { AdminSection } from "@/components/admin/AdminSection";
import { AdminSectionPills, AdminSidebar } from "@/components/admin/AdminSidebar";
import { ADMIN_SECTIONS, type AdminSectionId } from "@/components/admin/admin-sections";
import { useAdminSectionNav } from "@/hooks/useAdminSectionNav";


// ─── Shared row helpers ─────────────────────────────────────────────────────
// phaseColor was duplicated byte-for-byte in two sections; typeBadge and
// formatCreated are shared by the table and the mobile card renderers so the two
// layouts cannot drift apart.

const phaseColor = (phase: string | null) => {
  if (!phase) return "bg-admin-surface-3/30 text-admin-text-muted";
  if (phase.toLowerCase().includes("growth")) return "bg-admin-ok/20 text-admin-ok";
  if (phase.toLowerCase().includes("caution")) return "bg-admin-danger/20 text-admin-danger";
  return "bg-admin-warn/20 text-admin-warn";
};

const formatCreated = (iso: string) =>
  `${new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} ${new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;

/**
 * How the server attributed a kundali to an account. "linked" means
 * kundli_reports.user_id is actually set; the other two are inferences the panel
 * displays but never writes. See buildAttribution in admin-user-management.
 */
export type MatchKind = "linked" | "session" | "birth_details" | "none";

const MATCH_LABEL: Record<Exclude<MatchKind, "linked" | "none">, string> = {
  session: "session",
  birth_details: "birth details",
};

const MATCH_TITLE: Record<Exclude<MatchKind, "linked" | "none">, string> = {
  session:
    "Not linked in the database. Matched because this guest session signed in as this account.",
  birth_details:
    "Not linked in the database. Matched because the birth date, time and place are identical to this account's. This can be wrong \u2014 a chart generated for someone else matches too.",
};

/** Muted on purpose: an inference must not read like a confirmed fact. */
const matchBadge = (match?: MatchKind) => {
  if (!match || match === "linked" || match === "none") return null;
  return (
    <Pill
      tone="bg-admin-surface-3/40 text-admin-text-muted border border-admin-border-subtle"
      className="px-1.5"
      title={MATCH_TITLE[match]}
    >
      matched · {MATCH_LABEL[match]}
    </Pill>
  );
};

const typeBadge = (rec: { is_admin_generated?: boolean; user_id: string | null }) => (
  <Pill
    className="shrink-0"
    tone={
      rec.is_admin_generated
        ? "bg-admin-purple/20 text-admin-purple"
        : rec.user_id
          ? "bg-admin-info/20 text-admin-info"
          : "bg-admin-orange/20 text-admin-orange"
    }
  >
    {rec.is_admin_generated ? "Admin" : rec.user_id ? "Signed-In" : "Guest"}
  </Pill>
);

// ─── Types ──────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  has_paid: boolean;
  onboarding_done: boolean;
  is_admin: boolean;
  created_at: string;
  full_name: string | null;
  email: string | null;
  share_slug: string | null;
}

interface KundaliRow {
  id: string;
  full_name: string | null;
  share_slug: string;
  birth_date: string;
  birth_time: string;
  birth_place: string;
  financial_phase: string | null;
  created_at: string;
  /** "linked" when user_id is set; otherwise how the server inferred the owner. */
  match?: MatchKind;
}

interface AdminKundaliRecord {
  id: string;
  full_name: string | null;
  share_slug: string;
  birth_date: string;
  birth_time: string;
  birth_place: string;
  financial_phase: string | null;
  confidence_lvl: string | null;
  created_at: string;
}

// Location search result shape
interface LocationResult {
  display_name: string;
  lat: string;
  lon: string;
}

type UserFilter = "all" | "active" | "awaiting-payment" | "onboarding";

/**
 * Sortable columns of the users table.
 *
 * Declared at module scope so the array is stable across renders, and outside
 * AdminTable because this table cannot use it: each user renders a second <tr>
 * holding their kundalis, which AdminTable's cells-only renderRow cannot
 * express.
 */
const USER_COLUMNS: SortableColumn<UserRow>[] = [
  { key: "num" },
  { key: "email", sortValue: (u) => u.email },
  { key: "name", sortValue: (u) => u.full_name },
  // Funnel position, not the label. Alphabetical would put "Active" before
  // "Onboarding", which reads as progress running backwards.
  { key: "stage", sortValue: (u) => (u.has_paid ? 2 : u.onboarding_done ? 1 : 0), descFirst: true },
  { key: "created", sortValue: (u) => u.created_at, descFirst: true },
  { key: "kundali", sortValue: (u) => !!u.share_slug, descFirst: true },
  { key: "admin", sortValue: (u) => u.is_admin, descFirst: true },
  { key: "bulk" },
  { key: "action" },
];

const USER_COLUMN_LABELS: Record<string, string> = {
  email: "Email",
  name: "Username",
  stage: "Stage",
  created: "Created",
  kundali: "Kundali",
  admin: "Admin",
};

// ─── Shared user state ──────────────────────────────────────────────────────
/*
 * The funnel counts are shown twice: as at-a-glance KPIs in Analytics and above
 * the table in Users. Two copies of a number is only a problem if they come
 * from two fetches, so they do not — `users` is fetched once here and both
 * consumers derive from the same array, which makes them equal by construction
 * rather than by us remembering to refresh both.
 *
 * `filter` lives here for the same reason: clicking "Awaiting Payment" in
 * Analytics has to arrive at the Users table with that filter already applied,
 * which is the only thing that justifies a second copy of the numbers.
 */

interface FunnelCounts {
  total: number;
  active: number;
  awaiting: number;
  onboarding: number;
}

interface AdminUsersValue {
  users: UserRow[];
  loading: boolean;
  counts: FunnelCounts;
  filter: UserFilter;
  setFilter: (f: UserFilter) => void;
  refresh: () => void;
  updateUser: (id: string, patch: Partial<UserRow>) => void;
  removeUser: (id: string) => void;
}

const AdminUsersContext = createContext<AdminUsersValue | null>(null);

function useAdminUsers(): AdminUsersValue {
  const ctx = useContext(AdminUsersContext);
  if (!ctx) throw new Error("useAdminUsers must be used inside AdminUsersProvider");
  return ctx;
}

function AdminUsersProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<UserFilter>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "list-users" },
      });
      if (!error && data?.users) {
        setUsers(data.users as UserRow[]);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateUser = useCallback((id: string, patch: Partial<UserRow>) => {
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const removeUser = useCallback((id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  }, []);

  const counts = useMemo<FunnelCounts>(() => ({
    total: users.length,
    active: users.filter(u => u.has_paid).length,
    awaiting: users.filter(u => u.onboarding_done && !u.has_paid).length,
    onboarding: users.filter(u => !u.onboarding_done).length,
  }), [users]);

  const value = useMemo<AdminUsersValue>(
    () => ({ users, loading, counts, filter, setFilter, refresh, updateUser, removeUser }),
    [users, loading, counts, filter, refresh, updateUser, removeUser],
  );

  return <AdminUsersContext.Provider value={value}>{children}</AdminUsersContext.Provider>;
}

/**
 * The funnel, at the top of Analytics.
 *
 * Every tile is a button: it applies its filter to the Users table and jumps
 * there. A read-only mirror of numbers you can already see further down would
 * just be two things to keep in sync for no gain.
 */
function AdminKpiRow({ onJumpToUsers }: { onJumpToUsers: () => void }) {
  const { counts, loading, setFilter } = useAdminUsers();

  const tiles: { label: string; value: number; tone: string; filter: UserFilter }[] = [
    { label: "Total Users", value: counts.total, tone: "text-admin-text", filter: "all" },
    { label: "Active (Paid)", value: counts.active, tone: "text-admin-ok", filter: "active" },
    { label: "Awaiting Payment", value: counts.awaiting, tone: "text-admin-warn", filter: "awaiting-payment" },
    { label: "Onboarding", value: counts.onboarding, tone: "text-admin-info", filter: "onboarding" },
  ];

  const jump = (f: UserFilter) => {
    setFilter(f);
    onJumpToUsers();
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {tiles.map((tile) => (
        <button
          key={tile.label}
          onClick={() => jump(tile.filter)}
          title={`Show ${tile.label.toLowerCase()} in the Users table`}
          className="text-left rounded-xl border border-admin-border bg-admin-surface p-4 hover:border-admin-info/50 hover:bg-admin-surface-2/50 transition-colors group"
        >
          {/* Dash rather than 0 while loading: a real 0 and an unfetched 0 look
              identical, and "0 paid users" is an alarming thing to show wrongly. */}
          <p className={`text-2xl font-bold ${tile.tone}`}>{loading ? "—" : tile.value}</p>
          <p className="text-xs text-admin-text-muted mt-1">{tile.label}</p>
          <p className="text-[10px] text-admin-text-faint mt-1.5 group-hover:text-admin-info transition-colors">
            Filter users →
          </p>
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

const AdminInner = () => {
  const { user, signOut } = useAuth();
  const { theme } = useAdminTheme();
  const { active, scrollTo } = useAdminSectionNav();
  const [navCollapsed, setNavCollapsed] = useState(false);

  const section = (id: AdminSectionId) => ADMIN_SECTIONS.find(s => s.id === id)!;

  const handleLogout = async () => {
    // Land back on the admin sign-in card rather than /home — auth-context
    // reads this key on SIGNED_OUT. Same mechanism AdminLogin uses to switch
    // accounts.
    sessionStorage.setItem("signOutRedirect", "/admin");
    await signOut();
  };

  return (
    /*
     * `admin-theme` + data-admin-theme is the whole switch: index.css defines the
     * token values for both themes under those selectors.
     *
     * Do NOT add the `vedic-theme` class here, and do NOT wrap this content in a
     * <main> element. The Vedic stylesheet is ~700 lines scoped to
     * `.vedic-theme main …`, written for kundali insight cards — it would force
     * every cell to one brown, put a 10-second shimmer on each card, and keep
     * .text-white white (invisible on cream). Admin is deliberately decoupled.
     */
    <div className={`admin-theme min-h-screen bg-admin-bg text-admin-text p-4 sm:p-6`} data-admin-theme={theme}>
      <div className="max-w-7xl mx-auto flex gap-6">
        <AdminSidebar
          active={active}
          onSelect={scrollTo}
          collapsed={navCollapsed}
          onToggleCollapse={() => setNavCollapsed(v => !v)}
        />

        {/* min-w-0 so the tables inside can overflow-x-auto instead of forcing
            the flex row wider than the viewport. */}
        <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-xl sm:text-2xl font-bold">Admin Panel</h1>
          <div className="flex items-center gap-2 shrink-0">
          <AdminThemeToggle />
          {/* Icon only. The tooltip carries the signed-in email — every action
              here hits live data, and it is easy to be on the wrong Google
              account without noticing. */}
          <button
            onClick={handleLogout}
            aria-label={user?.email ? `Log out ${user.email}` : "Log out"}
            title={user?.email ? `Log out, ${user.email}` : "Log out"}
            className="grid place-items-center min-h-[44px] min-w-[44px] rounded-lg border border-admin-border-subtle text-admin-text-muted hover:bg-admin-surface-2 hover:text-admin-text transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
          </div>
        </div>
        {/* ── Pre-May-15 Data Link ─────────────────────────────────── */}
        <div className="mb-6 px-4 py-3 rounded-lg bg-admin-surface border border-admin-border flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
          <span className="text-admin-text-muted">For data before 15 May 2026, visit the spreadsheet:</span>
          <a
            href="https://docs.google.com/spreadsheets/d/1yj8mnzCFxtL7Il25OBBtjozFTL3qCqRBuXNTAaoQARs/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center min-h-[44px] sm:min-h-0 text-admin-info hover:text-admin-info underline underline-offset-2 transition-colors whitespace-nowrap"
          >
            Open Google Sheet →
          </a>
        </div>

        {/* Phone/tablet equivalent of the sidebar. Sits after the header so the
            title scrolls away and the pills are what stays pinned. */}
        <AdminSectionPills active={active} onSelect={scrollTo} />

        {/* 1. Overview — account counts, then whether data is still flowing at
               all. Everything below assumes it is, and for three days in Aug 2026
               it silently was not. */}
        <AdminSection
          id="admin-overview"
          label={section("admin-overview").label}
          icon={section("admin-overview").icon}
          description="Account funnel and end-to-end data flow. Tap a number to see those users."
        >
          <AdminKpiRow onJumpToUsers={() => scrollTo("admin-users")} />
          <PipelineHealth />
        </AdminSection>

        {/* 2. Analytics — behaviour, in our own tables rather than GA4's.
               Separate from Overview because "is the pipeline alive" and "why is
               checkout leaking" are different jobs and were competing for one
               screen. */}
        <AdminSection
          id="admin-analytics"
          label={section("admin-analytics").label}
          icon={section("admin-analytics").icon}
          description="First-party funnel, engagement, drop-off and click density. No GA4 or Clarity involved."
        >
          <AnalyticsDashboard />
        </AdminSection>

        {/* 3. IP addresses */}
        <AdminSection
          id="admin-ips"
          label={section("admin-ips").label}
          icon={section("admin-ips").icon}
          description="Sessions grouped by address, with the account or kundali name behind each one."
        >
          {/* Above the sessions table: the rules are what the table's `internal`
              badges are derived from, so reading them in that order makes sense. */}
          <InternalTraffic />
          <VisitorSessions />
        </AdminSection>

        {/* 4. Admin-generated kundalis. The form and the list are coupled by the
               `adminKundaliCreated` window event, so they belong together. */}
        <AdminSection
          id="admin-kundalis"
          label={section("admin-kundalis").label}
          icon={section("admin-kundalis").icon}
          description="Charts generated from this panel: no login or payment required."
        >
          <GenerateTempKundali />
          <AdminKundaliList />
        </AdminSection>

        {/* 5. Everything users generated themselves */}
        <AdminSection
          id="admin-user-kundalis"
          label={section("admin-user-kundalis").label}
          icon={section("admin-user-kundalis").icon}
          description="Charts generated by visitors, guest and signed-in."
        >
          <AllKundaliList />
        </AdminSection>

        {/* 6. Accounts, with the auth-table hygiene tool as a footer */}
        <AdminSection
          id="admin-users"
          label={section("admin-users").label}
          icon={section("admin-users").icon}
          description="Registered accounts. Guest visitors have none: look under Kundalis Generated for those."
        >
          {/* Above the table: who has full access is the more consequential
              list, and it must be visible without scrolling a paged table. */}
          <AdminAccess />
          <UserList />
          <OrphanCleanup />
        </AdminSection>
        </div>
      </div>
    </div>
  );
};

// ─── Orphan Cleanup ─────────────────────────────────────────────────────────

interface OrphanRow {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

function OrphanCleanup() {
  const [orphans, setOrphans] = useState<OrphanRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<{ deleted: number; errors?: string[] } | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchOrphans = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "list-orphans" },
      });
      if (!error && data?.orphans) {
        setOrphans(data.orphans as OrphanRow[]);
        setExpanded(true);
      } else {
        console.error("list-orphans error:", error?.message || data?.error);
      }
    } catch (err) {
      console.error("list-orphans failed:", err);
    }
    setLoading(false);
  };

  const cleanupOrphans = async () => {
    if (!orphans || orphans.length === 0) return;
    setCleaning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "cleanup-orphans" },
      });
      if (!error) {
        setResult({ deleted: data?.deleted ?? 0, errors: data?.errors });
        setOrphans([]);
        setExpanded(false);
      } else {
        console.error("cleanup-orphans error:", error?.message);
      }
    } catch (err) {
      console.error("cleanup-orphans failed:", err);
    }
    setCleaning(false);
  };

  const orphanCount = orphans?.length ?? null;
  const hasDangerLevel = orphanCount !== null && orphanCount > 0;

  return (
    /* mt, not mb: this is now the footer of the Users section rather than a
       standalone block, and AdminSection owns the gap below it. */
    <div className={`mt-6 rounded-xl border ${hasDangerLevel ? "border-admin-orange/40 bg-admin-orange/15" : "border-admin-border bg-admin-surface"} p-4`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <AlertTriangle className={`w-4 h-4 shrink-0 ${hasDangerLevel ? "text-admin-orange" : "text-admin-text-faint"}`} />
          <div>
            <p className="text-sm font-semibold text-admin-text">
              Ghost User Cleanup
            </p>
            <p className="text-xs text-admin-text-muted mt-0.5">
              Auth accounts with no user profile: left behind by failed sign-in attempts or interrupted deletes.
              {orphanCount !== null && (
                <span className={`ml-1 font-semibold ${hasDangerLevel ? "text-admin-orange" : "text-admin-ok"}`}>
                  {hasDangerLevel ? `${orphanCount} found` : "None found, all clear"}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={fetchOrphans}
            disabled={loading || cleaning}
            className="flex items-center gap-1.5 px-3 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg text-xs font-medium bg-admin-surface-2 text-admin-text-secondary hover:bg-admin-surface-3 hover:text-admin-text transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Scanning..." : "Scan"}
          </button>
          {hasDangerLevel && (
            <button
              onClick={cleanupOrphans}
              disabled={cleaning || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-admin-orange-strong hover:brightness-110 text-white transition-colors disabled:opacity-50"
            >
              <Trash2 className={`w-3.5 h-3.5 ${cleaning ? "animate-pulse" : ""}`} />
              {cleaning ? "Cleaning..." : `Delete ${orphanCount} Ghost${orphanCount !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div className={`mt-3 px-3 py-2 rounded-lg text-xs ${result.errors?.length ? "bg-admin-warn/15 text-admin-warn" : "bg-admin-ok/15 text-admin-ok"}`}>
          {result.errors?.length
            ? `Deleted ${result.deleted} ghosts. ${result.errors.length} failed: check edge function logs.`
            : `Successfully deleted ${result.deleted} ghost account${result.deleted !== 1 ? "s" : ""}. Re-registration is now unblocked.`}
        </div>
      )}

      {/* Orphan list */}
      {expanded && orphans && orphans.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] text-admin-text-faint uppercase tracking-wider">Ghost accounts</p>
          {orphans.map((o) => (
            <div key={o.id} className="flex items-center gap-4 px-3 py-1.5 rounded-lg bg-admin-surface/60 border border-admin-orange/40">
              <span className="text-xs text-admin-orange font-medium min-w-0 break-all flex-1" title={o.email || o.id}>
                {o.email || <span className="italic text-admin-text-faint">no email, {o.id.slice(0, 12)}...</span>}
              </span>
              <span className="text-[10px] text-admin-text-faint whitespace-nowrap flex-shrink-0">
                Created {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
              {o.last_sign_in_at && (
                <span className="text-[10px] text-admin-text-faint whitespace-nowrap flex-shrink-0">
                  Last seen {new Date(o.last_sign_in_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── User List ──────────────────────────────────────────────────────────────

function UserList() {
  // users / loading / filter live in AdminUsersProvider so the Analytics KPI
  // tiles and this table read the same array and cannot disagree, and so a tile
  // click can arrive here with its filter already applied.
  const { users, loading, counts, filter, setFilter, updateUser, removeUser } = useAdminUsers();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [kundaliCache, setKundaliCache] = useState<Record<string, KundaliRow[]>>({});
  const [kundaliError, setKundaliError] = useState<Record<string, string>>({});
  const [kundaliLoading, setKundaliLoading] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [adminBusyId, setAdminBusyId] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [deletingKundaliId, setDeletingKundaliId] = useState<string | null>(null);
  const [confirmDeleteKundalis, setConfirmDeleteKundalis] = useState<UserRow | null>(null);
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id ?? null;

  // Grant/revoke the is_admin flag. The edge function is the real authority —
  // it refuses self-demotion and removing the last admin — so surface whatever
  // it says rather than second-guessing it here.
  const handleToggleAdmin = async (target: UserRow) => {
    setAdminBusyId(target.id);
    setAdminError(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "set-admin", userId: target.id, isAdmin: !target.is_admin },
      });
      if (error || data?.error) {
        setAdminError(data?.error || error?.message || "Failed to update admin access");
      } else {
        updateUser(target.id, { is_admin: !target.is_admin });
      }
    } catch {
      setAdminError("Failed to update admin access: network error.");
    }
    setAdminBusyId(null);
  };

  // Same reason as AllKundaliList: a direct table read here is RLS-gated and
  // returns nothing for other users' kundalis. Go through the service role.
  const fetchKundalis = useCallback(async (userId: string) => {
    if (kundaliCache[userId]) return; // already fetched
    setKundaliLoading(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "list-all-kundalis", userId },
      });

      if (error || data?.error) {
        const msg = error?.message || data?.error || "Unknown error";
        console.error(`Failed to fetch kundalis for ${userId}:`, msg);
        setKundaliError(prev => ({ ...prev, [userId]: msg }));
        setKundaliCache(prev => ({ ...prev, [userId]: [] }));
      } else {
        setKundaliCache(prev => ({ ...prev, [userId]: (data?.kundalis ?? []) as KundaliRow[] }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to fetch kundalis for ${userId}:`, msg);
      setKundaliError(prev => ({ ...prev, [userId]: msg }));
      setKundaliCache(prev => ({ ...prev, [userId]: [] }));
    }
    setKundaliLoading(null);
  }, [kundaliCache]);

  const toggleExpand = (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(userId);
      fetchKundalis(userId);
    }
  };

  const filteredUsers = useMemo(() => {
    let result = users;

    if (filter === "active") {
      result = result.filter(u => u.has_paid);
    } else if (filter === "awaiting-payment") {
      result = result.filter(u => u.onboarding_done && !u.has_paid);
    } else if (filter === "onboarding") {
      result = result.filter(u => !u.onboarding_done);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    }

    return result;
  }, [users, filter, search]);

  // Sort runs after filter, so the visible rows are what gets ordered.
  const { rows: sortedUsers, sort, setSort, toggle } = useTableSort(filteredUsers, USER_COLUMNS);

  const handleDelete = async (userId: string) => {
    setDeletingId(userId);
    setDeleteError(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "delete-user", userId },
      });
      if (error || data?.error) {
        const msg = error?.message || data?.error || "Unknown error";
        console.error("Delete failed:", msg);
        setDeleteError(`Delete failed: ${msg}. The account may still exist in auth: use Ghost Scan to clean it up.`);
      } else {
        removeUser(userId);
        if (expandedUserId === userId) setExpandedUserId(null);
      }
    } catch (err) {
      console.error("Delete error:", err);
      setDeleteError("Delete request failed: network error or edge function timeout. Use Ghost Scan to check if the account still exists.");
    }
    setDeletingId(null);
    setConfirmDelete(null);
  };

  // Delete all kundalis for a user (preserves admin access and user account)
  const handleDeleteKundalis = async (userId: string) => {
    setDeletingId(userId);
    setDeleteError(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "delete-kundalis", userId },
      });
      if (error || data?.error) {
        const msg = error?.message || data?.error || "Unknown error";
        console.error("Delete kundalis failed:", msg);
        setDeleteError(`Failed to delete kundalis: ${msg}`);
      } else {
        // Refresh the kundali cache for this user
        setKundaliCache(prev => ({ ...prev, [userId]: [] }));
        console.log("All kundalis deleted for user:", userId);
      }
    } catch (err) {
      console.error("Delete kundalis error:", err);
      setDeleteError("Failed to delete kundalis: network error.");
    }
    setDeletingId(null);
    setConfirmDeleteKundalis(null);
  };

  // Delete a single kundali (preserves admin access and user account)
  const handleDeleteSingleKundali = async (userId: string, kundaliId: string) => {
    setDeletingKundaliId(kundaliId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "delete-kundalis", kundaliIds: [kundaliId] },
      });
      if (error || data?.error) {
        const msg = error?.message || data?.error || "Unknown error";
        console.error("Delete kundali failed:", msg);
      } else {
        // Remove from cache
        setKundaliCache(prev => ({
          ...prev,
          [userId]: (prev[userId] || []).filter(k => k.id !== kundaliId)
        }));
      }
    } catch (err) {
      console.error("Delete single kundali error:", err);
    }
    setDeletingKundaliId(null);
  };

  const getStage = (user: UserRow) => {
    if (user.has_paid) return { label: "Active", color: "bg-admin-ok/20 text-admin-ok" };
    if (user.onboarding_done) return { label: "Awaiting Payment", color: "bg-admin-warn/20 text-admin-warn" };
    return { label: "Onboarding", color: "bg-admin-info/20 text-admin-info" };
  };

  return (
    <>
      {/* Delete error banner */}
      {deleteError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-admin-danger/15 border border-admin-danger/40 text-sm text-admin-danger flex items-start justify-between gap-3">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="text-admin-danger hover:text-admin-danger flex-shrink-0 text-xs mt-0.5">✕</button>
        </div>
      )}

      {adminError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-admin-warn/15 border border-admin-warn/40 text-sm text-admin-warn flex items-start justify-between gap-3">
          <span>{adminError}</span>
          <button onClick={() => setAdminError(null)} className="text-admin-warn hover:text-admin-warn flex-shrink-0 text-xs mt-0.5">✕</button>
        </div>
      )}

      {/* Stats. Same numbers as the Analytics tiles, from the same array —
          AdminStat replaces four hand-rolled copies of its own markup.
          `loading ? "—"` matters and is not cosmetic: an unfetched 0 and a real
          0 render identically, so without it this copy flashes "0 Total Users /
          0 Active (Paid)" on every load while the Analytics copy correctly
          shows a dash — two copies of one number disagreeing, which is the
          exact failure the shared provider exists to prevent. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <AdminStat value={loading ? "—" : counts.total} label="Total Users" />
        <AdminStat value={loading ? "—" : counts.active} label="Active (Paid)" tone="text-admin-ok" />
        <AdminStat value={loading ? "—" : counts.awaiting} label="Awaiting Payment" tone="text-admin-warn" />
        <AdminStat value={loading ? "—" : counts.onboarding} label="Onboarding" tone="text-admin-info" />
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 min-h-[44px] py-2.5 rounded-lg bg-admin-surface border border-admin-border text-admin-text placeholder-admin-text-faint outline-none focus:border-admin-info/40 text-sm"
        />
        <div className="flex flex-wrap gap-1 bg-admin-surface border border-admin-border rounded-lg p-1">
          {([
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "awaiting-payment", label: "Awaiting Payment" },
            { key: "onboarding", label: "Onboarding" },
          ] as { key: UserFilter; label: string }[]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-admin-info-strong text-white"
                  : "text-admin-text-muted hover:text-admin-text"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-admin-surface border border-admin-border rounded-xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-admin-text mb-2">Delete User</h3>
            <p className="text-sm text-admin-text-secondary mb-1">
              This will permanently delete this user and all associated data including kundali reports, birth details, and payment records.
            </p>
            <p className="text-xs text-admin-text-faint mb-4 break-all">
              {confirmDelete.email || confirmDelete.full_name || confirmDelete.id.slice(0, 12) + "..."}
            </p>
            <div className="flex flex-wrap gap-3 justify-end [&>button]:min-h-[44px]">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg text-sm text-admin-text-secondary hover:text-admin-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                disabled={deletingId === confirmDelete.id}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-admin-danger-strong hover:brightness-110 text-white transition-colors disabled:opacity-50"
              >
                {deletingId === confirmDelete.id ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Deleting Kundalis */}
      {confirmDeleteKundalis && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-admin-surface border border-admin-border rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-admin-text mb-2">Delete All Kundalis</h3>
            <p className="text-sm text-admin-text-secondary mb-1">
              This will permanently delete all kundali reports linked to this user.
            </p>
            {/* The server deletes by user_id. Rows shown as "matched, not linked"
                have user_id NULL, so they survive this — deleting on a heuristic
                is not something to do behind a bulk button. Remove those one at a
                time from the expanded list if you mean to. */}
            <p className="text-xs text-admin-text-muted mb-1">
              Kundalis shown as “matched, not linked” are not deleted, remove those
              individually.
            </p>
            <p className="text-xs text-admin-ok mb-1">
              ✓ User account will be preserved
            </p>
            <p className="text-xs text-admin-ok mb-4">
              ✓ Admin access will be preserved
            </p>
            <p className="text-xs text-admin-text-faint mb-4 break-all">
              {confirmDeleteKundalis.email || confirmDeleteKundalis.full_name}
            </p>
            <div className="flex flex-wrap gap-3 justify-end [&>button]:min-h-[44px]">
              <button
                onClick={() => setConfirmDeleteKundalis(null)}
                className="px-4 py-2 rounded-lg text-sm text-admin-text-secondary hover:text-admin-text"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteKundalis(confirmDeleteKundalis.id)}
                disabled={deletingId === confirmDeleteKundalis.id}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-admin-warn hover:brightness-110 text-white disabled:opacity-50"
              >
                {deletingId === confirmDeleteKundalis.id ? "Deleting..." : "Delete Kundalis Only"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Table */}
      {loading ? (
        <div className="text-center py-20 text-admin-text-faint">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-20 text-admin-text-faint">
          {search || filter !== "all" ? "No users match your search/filter" : "No users found"}
        </div>
      ) : (
        <>
        {/* Desktop / tablet. overflow-x-auto, never overflow-hidden: this table
            needs ~800px and clipping made Delete and Make-admin unreachable. */}
        <div className="hidden sm:block bg-admin-surface border border-admin-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-admin-text-faint uppercase tracking-wider border-b border-admin-border">
                {([
                  ["num", "#", "left", "w-12"],
                  ["email", "Email", "left", ""],
                  ["name", "Username", "left", ""],
                  ["stage", "Stage", "center", ""],
                  ["created", "Created", "left", ""],
                  ["kundali", "Kundali", "center", ""],
                  ["admin", "Admin", "center", ""],
                  ["bulk", "Kundalis", "center", ""],
                  ["action", "Action", "right", ""],
                ] as [string, string, "left" | "center" | "right", string][]).map(([key, label, align, extra]) => {
                  const sortable = !!USER_COLUMNS.find((c) => c.key === key)?.sortValue;
                  // Spelled out, not interpolated: Tailwind scans source text, so
                  // `text-${align}` produces a class it never generates.
                  const alignClass =
                    align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
                  return (
                    <th
                      key={key}
                      aria-sort={sortable ? ariaSort(sort, key) : undefined}
                      className={`px-4 py-3 ${alignClass} ${extra}`}
                    >
                      <SortHeader
                        label={label}
                        columnKey={key}
                        sortable={sortable}
                        sort={sort}
                        onToggle={toggle}
                        align={align}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user, index) => {
                const stage = getStage(user);
                const isExpanded = expandedUserId === user.id;
                const userKundalis = kundaliCache[user.id];
                const isLoadingKundalis = kundaliLoading === user.id;

                return (
                  <UserRowItem
                    key={user.id}
                    user={user}
                    index={index}
                    stage={stage}
                    isExpanded={isExpanded}
                    kundalis={userKundalis}
                    kundaliError={kundaliError[user.id]}
                    isLoadingKundalis={isLoadingKundalis}
                    deletingId={deletingId}
                    onToggleExpand={() => toggleExpand(user.id)}
                    onDelete={() => setConfirmDelete(user)}
                    onDeleteKundalis={() => setConfirmDeleteKundalis(user)}
                    onToggleAdmin={() => handleToggleAdmin(user)}
                    adminBusy={adminBusyId === user.id}
                    isSelf={user.id === currentUserId}
                    deletingKundaliId={deletingKundaliId}
                    onDeleteSingleKundali={(kundaliId) => handleDeleteSingleKundali(user.id, kundaliId)}
                  />
                );
              })}
            </tbody>
          </table>
          </div>
        </div>

        {/* Phone: one card per user, so every action stays reachable. */}
        <div className="sm:hidden">
          <MobileSortBar columns={USER_COLUMNS} labels={USER_COLUMN_LABELS} sort={sort} onSet={setSort} />
        </div>
        <div className="sm:hidden space-y-2">
          {sortedUsers.map((user, index) => (
            <UserCardItem
              key={user.id}
              user={user}
              index={index}
              stage={getStage(user)}
              isExpanded={expandedUserId === user.id}
              kundalis={kundaliCache[user.id]}
              kundaliError={kundaliError[user.id]}
              isLoadingKundalis={kundaliLoading === user.id}
              deletingId={deletingId}
              onToggleExpand={() => toggleExpand(user.id)}
              onDelete={() => setConfirmDelete(user)}
              onDeleteKundalis={() => setConfirmDeleteKundalis(user)}
              onToggleAdmin={() => handleToggleAdmin(user)}
              adminBusy={adminBusyId === user.id}
              isSelf={user.id === currentUserId}
              deletingKundaliId={deletingKundaliId}
              onDeleteSingleKundali={(kundaliId) => handleDeleteSingleKundali(user.id, kundaliId)}
            />
          ))}
        </div>
        </>
      )}
    </>
  );
}

/** Phone layout for one user. Same data and the same actions as the table row —
 *  the desktop table clips below ~800px, which is what made Delete and
 *  Make-admin untappable on a phone. */
function UserCardItem({
  user, index, stage, isExpanded, kundalis, kundaliError, isLoadingKundalis,
  deletingId, onToggleExpand, onDelete, onDeleteKundalis, onToggleAdmin, adminBusy, isSelf,
  deletingKundaliId, onDeleteSingleKundali,
}: {
  user: UserRow;
  index: number;
  stage: { label: string; color: string };
  isExpanded: boolean;
  kundalis: KundaliRow[] | undefined;
  kundaliError?: string;
  isLoadingKundalis: boolean;
  deletingId: string | null;
  onToggleExpand: () => void;
  onDelete: () => void;
  onDeleteKundalis: () => void;
  onToggleAdmin: () => void;
  adminBusy: boolean;
  isSelf: boolean;
  deletingKundaliId: string | null;
  onDeleteSingleKundali: (kundaliId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-admin-border bg-admin-surface p-3">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-medium text-admin-text break-words">
            {user.full_name || <span className="italic text-admin-text-faint font-normal">No name</span>}
          </p>
          <p className="text-xs text-admin-text-muted break-all">
            {user.email || <span className="italic text-admin-text-faint">—</span>}
          </p>
        </div>
        <Pill tone={stage.color} className="shrink-0">{stage.label}</Pill>
      </div>

      <div className="mt-2 space-y-0.5">
        <AdminField label="#">{index + 1}</AdminField>
        <AdminField label="Created">
          {user.created_at
            ? new Date(user.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : "—"}
        </AdminField>
        <AdminField label="Kundali">
          {user.share_slug ? (
            <a
              href={`/shared/${user.share_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center min-h-[44px] -my-3 px-1 text-admin-info underline"
            >
              View
            </a>
          ) : "—"}
        </AdminField>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <button
          onClick={onToggleAdmin}
          disabled={adminBusy || (isSelf && user.is_admin)}
          className={`min-h-[44px] rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
            user.is_admin
              ? "bg-admin-purple/20 text-admin-purple border border-admin-purple/30"
              : "bg-admin-surface-2 text-admin-text-secondary border border-admin-border"
          }`}
        >
          {adminBusy ? "…" : user.is_admin ? "✓ Admin" : "Make Admin"}
        </button>
        
        <button
          onClick={onDeleteKundalis}
          disabled={deletingId === user.id}
          className="min-h-[44px] rounded-lg bg-admin-warn/15 border border-admin-warn/40 text-xs font-medium text-admin-warn disabled:opacity-50"
        >
          {deletingId === user.id ? "..." : "Delete All Kundalis"}
        </button>
        
        <button
          onClick={onDelete}
          disabled={deletingId === user.id}
          className="min-h-[44px] rounded-lg bg-admin-danger/15 border border-admin-danger/40 text-xs font-medium text-admin-danger disabled:opacity-50"
        >
          {deletingId === user.id ? "Deleting..." : "Delete User Account"}
        </button>
      </div>

      <button
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
        className="mt-2 w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg border border-admin-border-subtle text-xs text-admin-text-muted"
      >
        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {isExpanded ? "Hide" : "Show"} kundalis
      </button>

      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-admin-border-subtle">
          <UserKundaliList
            kundalis={kundalis}
            kundaliError={kundaliError}
            isLoadingKundalis={isLoadingKundalis}
            onDeleteKundali={onDeleteSingleKundali}
            deletingKundaliId={deletingKundaliId}
          />
        </div>
      )}
    </div>
  );
}

/** Column count of the desktop users table — keep in step with its <thead>. */
const USER_TABLE_COLS = 9;

// ─── User Row with expandable kundali list ──────────────────────────────────

function UserRowItem({
  user,
  index,
  stage,
  isExpanded,
  kundalis,
  kundaliError,
  isLoadingKundalis,
  deletingId,
  onToggleExpand,
  onDelete,
  onDeleteKundalis,
  onToggleAdmin,
  adminBusy,
  isSelf,
  deletingKundaliId,
  onDeleteSingleKundali,
}: {
  user: UserRow;
  index: number;
  stage: { label: string; color: string };
  isExpanded: boolean;
  kundalis: KundaliRow[] | undefined;
  kundaliError?: string;
  isLoadingKundalis: boolean;
  deletingId: string | null;
  onToggleExpand: () => void;
  onDelete: () => void;
  onDeleteKundalis: () => void;
  onToggleAdmin: () => void;
  adminBusy: boolean;
  isSelf: boolean;
  deletingKundaliId: string | null;
  onDeleteSingleKundali: (kundaliId: string) => void;
}) {
  return (
    <>
      <tr className={`border-t border-admin-border-subtle hover:bg-admin-surface-2/30 ${isExpanded ? "bg-admin-surface-2/20" : ""}`}>
        <td className="px-4 py-3 text-admin-text-faint text-xs">
          {index + 1}
        </td>
        {/* min-w, not max-w. These cells used to cap at 180/120px and `truncate`,
            which clipped every real address and name — unconditionally, so it
            happened on a 27-inch monitor exactly as on a phone. The table sits in
            an overflow-x-auto wrapper (see the comment above <table>), so it is
            allowed to be wider than the viewport and there was nothing for the
            cap to protect. break-all on the address because an email has no
            spaces to break at. */}
        <td className="px-4 py-3 text-admin-text-secondary text-xs min-w-[180px]">
          <span className="block break-all" title={user.email || ""}>
            {user.email || <span className="text-admin-text-faint italic">—</span>}
          </span>
        </td>
        <td className="px-4 py-3 min-w-[140px]">
          <button
            onClick={onToggleExpand}
            className="flex items-start gap-1.5 text-admin-text font-medium hover:text-admin-info transition-colors text-left w-full"
            title={user.full_name || "No name"}
          >
            {/* items-start above, so the caret stays on the first line of a name
                that now wraps rather than centring against the whole block. */}
            <span className={`text-[10px] leading-5 text-admin-text-faint transition-transform ${isExpanded ? "rotate-90" : ""}`}>
              ▶
            </span>
            <span className="block break-words">
              {user.full_name || <span className="text-admin-text-faint italic font-normal">—</span>}
            </span>
          </button>
        </td>
        <td className="px-4 py-3 text-center">
          <Pill tone={stage.color} size="lg">{stage.label}</Pill>
        </td>
        <td className="px-4 py-3 text-admin-text-faint text-xs whitespace-nowrap">
          {user.created_at
            ? new Date(user.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "—"}
        </td>
        <td className="px-4 py-3 text-center">
          {user.share_slug ? (
            <a
              href={`/shared/${user.share_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-admin-info hover:text-admin-info underline"
            >
              View
            </a>
          ) : (
            <span className="text-xs text-admin-text-faint">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <button
            onClick={onToggleAdmin}
            disabled={adminBusy || (isSelf && user.is_admin)}
            title={
              isSelf
                ? "You cannot remove your own admin access"
                : user.is_admin
                  ? "Revoke admin access"
                  : "Grant admin access"
            }
            className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              user.is_admin
                ? "bg-admin-purple/20 text-admin-purple hover:bg-admin-purple/30"
                : "bg-admin-surface-2 text-admin-text-faint hover:bg-admin-surface-3 hover:text-admin-text-secondary"
            }`}
          >
            {adminBusy ? "…" : user.is_admin ? "Admin" : "Make admin"}
          </button>
        </td>
        <td className="px-4 py-3 text-center">
          <button
            onClick={onDeleteKundalis}
            disabled={deletingId === user.id}
            className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors bg-admin-warn/20 text-admin-warn hover:bg-admin-warn/30 disabled:opacity-50"
          >
            {deletingId === user.id ? "..." : "Del Kundalis"}
          </button>
        </td>
        <td className="px-4 py-3 text-right">
          {deletingId === user.id ? (
            <span className="text-xs text-admin-text-muted animate-pulse">Deleting...</span>
          ) : (
            <button
              onClick={onDelete}
              className="text-xs px-3 py-1.5 rounded-md bg-admin-danger/20 text-admin-danger hover:bg-admin-danger/30 transition-colors font-medium whitespace-nowrap"
            >
              Delete Account
            </button>
          )}
        </td>
      </tr>

      {/* Expanded kundali list */}
      {isExpanded && (
        <tr>
          <td colSpan={USER_TABLE_COLS} className="p-0">
            <div className="bg-admin-bg/50 border-t border-admin-border-subtle px-6 py-3">
              <UserKundaliList
                kundalis={kundalis}
                kundaliError={kundaliError}
                isLoadingKundalis={isLoadingKundalis}
                onDeleteKundali={onDeleteSingleKundali}
                deletingKundaliId={deletingKundaliId}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Shared by the desktop expanded row and the mobile card. */
function UserKundaliList({
  kundalis,
  kundaliError,
  isLoadingKundalis,
  onDeleteKundali,
  deletingKundaliId,
}: {
  kundalis: KundaliRow[] | undefined;
  kundaliError?: string;
  isLoadingKundalis: boolean;
  onDeleteKundali: (kundaliId: string) => void;
  deletingKundaliId: string | null;
}) {
  return (
    <>
              {isLoadingKundalis ? (
                <p className="text-xs text-admin-text-faint py-2">Loading kundalis...</p>
              ) : kundaliError ? (
                <p className="text-xs text-admin-danger py-2 break-words">
                  Could not load kundalis: {kundaliError}
                </p>
              ) : !kundalis || kundalis.length === 0 ? (
                <p className="text-xs text-admin-text-faint py-2">No kundalis generated yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {/* Split on purpose: a single total would read as confirmed
                      ownership, and the matched rows are inferences the panel
                      displays without writing user_id. */}
                  <p className="text-[10px] text-admin-text-faint uppercase tracking-wider mb-2">
                    {(() => {
                      const linked = kundalis.filter(k => k.match !== "session" && k.match !== "birth_details").length;
                      const matched = kundalis.length - linked;
                      return matched > 0
                        ? `${linked} linked · ${matched} matched, not linked`
                        : `${linked} Kundali${linked !== 1 ? "s" : ""} generated`;
                    })()}
                  </p>
                  {kundalis.map((k) => (
                    <div
                      key={k.id}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5 px-3 rounded-lg bg-admin-surface/60 border border-admin-border-subtle"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                        <span className="text-xs text-admin-text font-medium break-words" title={k.full_name || "—"}>
                          {k.full_name || "—"}
                        </span>
                        <span className="text-[10px] text-admin-text-faint whitespace-nowrap">
                          {k.birth_date} • {k.birth_time}
                        </span>
                        <span className="text-[10px] text-admin-text-faint break-words" title={k.birth_place}>
                          {k.birth_place}
                        </span>
                        {k.financial_phase && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-admin-ok/20 text-admin-ok whitespace-nowrap">
                            {k.financial_phase}
                          </span>
                        )}
                        {matchBadge(k.match)}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[10px] text-admin-text-faint whitespace-nowrap">
                          {new Date(k.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                        <a
                          href={`/shared/${k.share_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-admin-info hover:text-admin-info underline whitespace-nowrap"
                        >
                          View →
                        </a>
                        <button
                          onClick={() => onDeleteKundali(k.id)}
                          disabled={deletingKundaliId === k.id}
                          className="text-[10px] px-2 py-0.5 rounded bg-admin-danger/20 text-admin-danger hover:bg-admin-danger/30 transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          {deletingKundaliId === k.id ? "..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
    </>
  );
}

// ─── Generate Temporary Kundali ─────────────────────────────────────────────

function GenerateTempKundali() {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ slug: string; name: string } | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthTimeAccuracy, setBirthTimeAccuracy] = useState<"exact" | "approximate" | "unknown">("exact");
  const [birthPlace, setBirthPlace] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [timezone, setTimezone] = useState<number>(5.5);

  // Location search state
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const locationDebounce = useRef<ReturnType<typeof setTimeout>>();
  const locationContainerRef = useRef<HTMLDivElement>(null);

  // Close location dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationContainerRef.current && !locationContainerRef.current.contains(e.target as Node)) {
        setLocationOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchLocation = useCallback(async (q: string) => {
    if (q.length < 2) { setLocationResults([]); return; }
    setLocationLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=0`,
        { headers: { "Accept-Language": "en" } }
      );
      const data: LocationResult[] = await res.json();
      setLocationResults(data);
      setLocationOpen(data.length > 0);
    } catch {
      setLocationResults([]);
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const handleLocationInput = (val: string) => {
    setLocationQuery(val);
    setBirthPlace(val);
    setLatitude(null);
    setLongitude(null);
    clearTimeout(locationDebounce.current);
    locationDebounce.current = setTimeout(() => searchLocation(val), 350);
  };

  const handleLocationSelect = (r: LocationResult) => {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    // India-specific timezone, otherwise estimate from longitude
    let tz = Math.round((lon / 15) * 2) / 2;
    if (lat >= 6 && lat <= 37 && lon >= 68 && lon <= 98) tz = 5.5;
    else if (lat >= 26 && lat <= 31 && lon >= 80 && lon <= 89) tz = 5.75;

    setLocationQuery(r.display_name);
    setBirthPlace(r.display_name);
    setLatitude(lat);
    setLongitude(lon);
    setTimezone(tz);
    setLocationOpen(false);
    setLocationResults([]);
  };

  const handleReset = () => {
    setFullName("");
    setBirthDate("");
    setBirthTime("");
    setBirthTimeAccuracy("exact");
    setBirthPlace("");
    setLocationQuery("");
    setLatitude(null);
    setLongitude(null);
    setTimezone(5.5);
    setError(null);
    setSuccess(null);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!birthDate || !birthTime || !birthPlace || latitude === null || longitude === null) {
      setError("Please fill all fields and select a location from the dropdown.");
      return;
    }
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    setGenerating(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("admin-user-management", {
        body: {
          action: "generate-kundali",
                    full_name: fullName.trim(),
          birth_date: birthDate,
          birth_time: birthTime,
          birth_time_accuracy: birthTimeAccuracy,
          birth_place: birthPlace,
          latitude,
          longitude,
          timezone,
        },
      });

      if (fnError || data?.error) {
        setError(fnError?.message || data?.error || "Generation failed. Check edge function logs.");
      } else {
        setSuccess({ slug: data.shareSlug, name: fullName.trim() });
        handleReset();
        // Dispatch event so AdminKundaliList refreshes
        window.dispatchEvent(new Event("adminKundaliCreated"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-admin-indigo/40 bg-admin-indigo/15 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-admin-indigo/15 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-admin-indigo shrink-0" />
          <div>
            <p className="text-sm font-semibold text-admin-text">Generate Temporary Kundali</p>
            <p className="text-xs text-admin-text-muted mt-0.5">No login or payment required: stored in DB and visible below</p>
          </div>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-admin-text-muted shrink-0" />
          : <ChevronDown className="w-4 h-4 text-admin-text-muted shrink-0" />
        }
      </button>

      {/* Expandable form */}
      {open && (
        <div className="border-t border-admin-indigo/40 px-5 py-5">
          {/* Success banner */}
          {success && (
            <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-admin-ok/15 border border-admin-ok/40">
              <div>
                <p className="text-sm font-semibold text-admin-ok">Kundali generated!</p>
                <p className="text-xs text-admin-ok/70 mt-0.5">Saved for {success.name}</p>
              </div>
              <a
                href={`/shared/${success.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-admin-ok hover:text-admin-ok whitespace-nowrap border border-admin-ok/40 rounded-lg px-3 py-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Report
              </a>
            </div>
          )}

          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-admin-text-muted">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-admin-text-faint pointer-events-none" />
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-admin-surface border border-admin-border text-admin-text placeholder-admin-text-faint text-sm outline-none focus:border-admin-indigo/40 transition-colors"
                />
              </div>
            </div>

            {/* Date + Time row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-admin-text-muted">Date of Birth</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2.5 rounded-lg bg-admin-surface border border-admin-border text-admin-text text-sm outline-none focus:border-admin-indigo/40 transition-colors [color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-admin-text-muted">Time of Birth</label>
                <input
                  type="time"
                  value={birthTime}
                  onChange={e => setBirthTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-admin-surface border border-admin-border text-admin-text text-sm outline-none focus:border-admin-indigo/40 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Time accuracy */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-admin-text-muted">Birth Time Accuracy</label>
              <div className="flex flex-wrap gap-2">
                {(["exact", "approximate", "unknown"] as const).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setBirthTimeAccuracy(opt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                      birthTimeAccuracy === opt
                        ? "bg-admin-indigo-strong text-white"
                        : "bg-admin-surface-2 text-admin-text-muted hover:text-admin-text"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Birth Place with location search */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-admin-text-muted">
                Birth Place
                {latitude !== null && longitude !== null && (
                  <span className="ml-2 text-admin-ok font-normal">
                    ✓ {latitude.toFixed(2)}, {longitude.toFixed(2)} · TZ {timezone >= 0 ? "+" : ""}{timezone}
                  </span>
                )}
              </label>
              <div ref={locationContainerRef} className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-admin-text-faint pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder="Search city or town..."
                  value={locationQuery}
                  onChange={e => handleLocationInput(e.target.value)}
                  onFocus={() => locationResults.length > 0 && setLocationOpen(true)}
                  className="w-full pl-9 pr-9 py-2.5 rounded-lg bg-admin-surface border border-admin-border text-admin-text placeholder-admin-text-faint text-sm outline-none focus:border-admin-indigo/40 transition-colors"
                  autoComplete="off"
                />
                {locationLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-admin-text-faint animate-spin" />
                )}
                {locationOpen && locationResults.length > 0 && (
                  <ul className="absolute z-50 mt-1 w-full rounded-xl border border-admin-border shadow-2xl overflow-hidden max-h-52 overflow-y-auto bg-admin-surface">
                    {locationResults.map((r, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => handleLocationSelect(r)}
                          className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-admin-surface-2 transition-colors text-sm"
                        >
                          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-admin-indigo" />
                          <span className="text-admin-text-secondary leading-snug line-clamp-2">{r.display_name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {latitude === null && locationQuery.length > 0 && (
                <p className="text-[11px] text-admin-warn">Select a location from the dropdown to set coordinates.</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-2.5 rounded-lg bg-admin-danger/15 border border-admin-danger/40 text-sm text-admin-danger">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={generating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-admin-indigo-strong hover:brightness-110 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Kundali
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={generating}
                className="px-4 py-2.5 rounded-lg text-sm text-admin-text-muted hover:text-admin-text transition-colors disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Admin Kundali List ──────────────────────────────────────────────────────

function AdminKundaliList() {
  const [records, setRecords] = useState<AdminKundaliRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminKundaliRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "list-admin-kundalis" },
      });
      if (!error && data?.kundalis) {
        setRecords(data.kundalis as AdminKundaliRecord[]);
      }
    } catch (err) {
      console.error("list-admin-kundalis failed:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Refresh when a new kundali is generated from the form above
  useEffect(() => {
    const handler = () => fetchRecords();
    window.addEventListener("adminKundaliCreated", handler);
    return () => window.removeEventListener("adminKundaliCreated", handler);
  }, [fetchRecords]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "delete-admin-kundali", kundaliId: id },
      });
      if (!error && data?.success) {
        setRecords(prev => prev.filter(r => r.id !== id));
      } else {
        console.error("delete-admin-kundali error:", error?.message || data?.error);
      }
    } catch (err) {
      console.error("delete-admin-kundali failed:", err);
    }
    setDeletingId(null);
    setConfirmDelete(null);
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-admin-indigo" />
          <h2 className="text-sm font-semibold text-admin-text">Admin-Generated Kundalis</h2>
          {!loading && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-admin-indigo/15 text-admin-indigo border border-admin-indigo/40">
              {records.length}
            </span>
          )}
        </div>
        <button
          onClick={fetchRecords}
          disabled={loading}
          className="flex items-center gap-1.5 px-2 min-h-[44px] sm:min-h-0 sm:py-1 text-xs text-admin-text-muted hover:text-admin-text transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-admin-surface border border-admin-border rounded-xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-admin-text mb-2">Delete Kundali</h3>
            <p className="text-sm text-admin-text-secondary mb-1">
              This will permanently delete the kundali for{" "}
              <span className="font-medium text-admin-text">{confirmDelete.full_name || "this person"}</span>.
            </p>
            <p className="text-xs text-admin-text-faint mb-5">
              {confirmDelete.birth_date} · {confirmDelete.birth_place}
            </p>
            <div className="flex flex-wrap gap-3 justify-end [&>button]:min-h-[44px]">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg text-sm text-admin-text-secondary hover:text-admin-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                disabled={deletingId === confirmDelete.id}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-admin-danger-strong hover:brightness-110 text-white transition-colors disabled:opacity-50"
              >
                {deletingId === confirmDelete.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-admin-border bg-admin-surface p-8 text-center text-admin-text-faint text-sm">
          Loading...
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-admin-border bg-admin-surface p-8 text-center text-admin-text-faint text-sm">
          No temporary kundalis generated yet. Use the form above to create one.
        </div>
      ) : (
        <AdminTable
          rows={records}
          rowKey={(rec) => rec.id}
          columns={[
            { label: "#", className: "w-8" },
            { label: "Name", sortValue: (rec) => rec.full_name },
            // Birth date and time are shown as one cell, so they sort as one
            // key — otherwise the column you clicked and the order you get
            // would not match.
            { label: "Birth Details", sortValue: (rec) => `${rec.birth_date} ${rec.birth_time}` },
            { label: "Place", sortValue: (rec) => rec.birth_place },
            { label: "Phase", align: "center", sortValue: (rec) => rec.financial_phase },
            { label: "Created", sortValue: (rec) => rec.created_at, descFirst: true },
            { label: "Actions", align: "right" },
          ]}
          renderRow={(rec, i) => (
            <>
              <td className="px-4 py-3 text-admin-text-faint text-xs">{i + 1}</td>
              <td className="px-4 py-3 text-admin-text font-medium text-xs min-w-[140px]">
                <span className="block break-words" title={rec.full_name || "—"}>
                  {rec.full_name || <span className="italic text-admin-text-faint">—</span>}
                </span>
              </td>
              <td className="px-4 py-3 text-admin-text-muted text-xs whitespace-nowrap">
                {rec.birth_date} · {rec.birth_time}
              </td>
              <td className="px-4 py-3 text-admin-text-muted text-xs min-w-[140px]">
                <span className="block break-words" title={rec.birth_place}>{rec.birth_place}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <Pill tone={phaseColor(rec.financial_phase)}>{rec.financial_phase || "—"}</Pill>
              </td>
              <td className="px-4 py-3 text-admin-text-faint text-xs whitespace-nowrap">
                {new Date(rec.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <a
                    href={`/shared/${rec.share_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-admin-indigo hover:underline transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View
                  </a>
                  <button
                    onClick={() => setConfirmDelete(rec)}
                    disabled={deletingId === rec.id}
                    className="text-xs px-2.5 py-1 rounded-md bg-admin-danger/20 text-admin-danger hover:bg-admin-danger/30 transition-colors disabled:opacity-50"
                  >
                    {deletingId === rec.id ? "..." : "Delete"}
                  </button>
                </div>
              </td>
            </>
          )}
          renderCard={(rec) => (
            <div className="space-y-1">
              <p className="text-sm font-medium text-admin-text break-words">
                {rec.full_name || <span className="italic text-admin-text-faint">—</span>}
              </p>
              <AdminField label="Born">{rec.birth_date} · {rec.birth_time}</AdminField>
              <AdminField label="Place">{rec.birth_place}</AdminField>
              <AdminField label="Phase">
                <Pill tone={phaseColor(rec.financial_phase)}>{rec.financial_phase || "—"}</Pill>
              </AdminField>
              <AdminField label="Created">{formatCreated(rec.created_at)}</AdminField>
              <div className="flex gap-2 mt-2">
                <a
                  href={`/shared/${rec.share_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] rounded-lg border border-admin-indigo/40 bg-admin-indigo/15 text-xs text-admin-indigo"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View
                </a>
                <button
                  onClick={() => setConfirmDelete(rec)}
                  disabled={deletingId === rec.id}
                  className="flex-1 min-h-[44px] rounded-lg border border-admin-danger/40 bg-admin-danger/15 text-xs text-admin-danger disabled:opacity-50"
                >
                  {deletingId === rec.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}

// ─── All Generated Kundalis (Guest + Authenticated) ─────────────────────────
// This section tracks EVERY kundali generation, including:
// - Anonymous/guest users (user_id = null) — saved automatically without login
// - Authenticated users (user_id != null) — linked to their account
// Users do NOT see their history (hidden in Profile.tsx), only admins see this data

interface AllKundaliRecord {
  id: string;
  user_id: string | null;
  full_name: string | null;
  share_slug: string;
  birth_date: string;
  birth_time: string;
  birth_place: string;
  financial_phase: string | null;
  is_admin_generated?: boolean;
  created_at: string;
  /** Joins to visitor_events.session_id for the IP column. Never displayed raw. */
  session_id?: string | null;
  /** Account email, resolved server-side from auth.users. Null for guest rows. */
  email?: string | null;
  match?: MatchKind;
  matched_email?: string | null;
}

/**
 * Join key for the IP column. session_id is the real one — but the currently
 * deployed list-all-kundalis does not return it (that select change is local and
 * unshipped), so until then the row id stands in. Both sides of the join call
 * this, so the map and the lookup cannot drift apart.
 */
const ipKey = (rec: { session_id?: string | null; id: string }) => rec.session_id || rec.id;

function AllKundaliList() {
  const [records, setRecords] = useState<AllKundaliRecord[]>([]);
  // session_id -> last observed IP. Kundalis created before migration 018 have
  // no visitor_events row and never will, so the column renders "—" for them
  // rather than implying the IP is merely unknown.
  const [ipBySession, setIpBySession] = useState<Record<string, string>>({});
  const [ipIsSample, setIpIsSample] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Expanded by default: guest kundalis (user_id null) never appear anywhere
  // else on this page — the Users table below is auth-users-only — so leaving
  // this collapsed hides them from operators who are looking for them. Also
  // keeps the "guest kundali not saved" question one glance away instead of
  // one click.
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState<"all" | "guest" | "authenticated">("all");
  const [search, setSearch] = useState("");

  // Reads through the admin edge function (service role) rather than querying
  // kundli_reports directly: RLS only exposes the admin's own rows and is_shared
  // ones, which made this list look empty while hundreds of rows existed.
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "list-all-kundalis", limit: 500 },
      });

      if (error || data?.error) {
        const msg = error?.message || data?.error || "Unknown error";
        console.error("Failed to fetch all kundalis:", msg);
        setLoadError(msg);
        setRecords([]);
      } else {
        setRecords((data?.kundalis ?? []) as AllKundaliRecord[]);

        // Separate call, and a failure here is deliberately not surfaced as a
        // load error: the kundali list is the primary content and must still
        // render if visitor tracking is unavailable.
        const { data: visitors } = await supabase.functions.invoke("admin-user-management", {
          body: { action: "list-visitor-sessions", limit: 2000 },
        });
        let rows = visitors?.sessions ?? [];

        // Dev-only preview so this column can be looked at before migration 018
        // is applied. Same generator the Visitors panel uses, so the two agree.
        //
        // `import.meta.env.DEV` is a compile-time constant, so wrapping the
        // dynamic import in it lets the bundler drop the whole branch — and the
        // mock module with it — from a production build. A static import would
        // ship the sample IPs to production even though the runtime check kept
        // them switched off.
        let sample = false;
        if (import.meta.env.DEV && !rows.length) {
          const dev = await import("@/lib/dev-visitor-mock");
          if (dev.mockVisitorsEnabled()) {
            const ids = ((data?.kundalis ?? []) as AllKundaliRecord[]).map(ipKey);
            rows = dev.mockVisitorSessions(ids).sessions;
            sample = true;
          }
        }
        setIpIsSample(sample);

        const map: Record<string, string> = {};
        for (const s of rows) {
          if (s.session_id && s.last_ip) map[s.session_id] = s.last_ip;
        }
        setIpBySession(map);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch all kundalis:", msg);
      setLoadError(msg);
      setRecords([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Refresh when a new kundali is generated from the admin form
  useEffect(() => {
    const handler = () => fetchRecords();
    window.addEventListener("adminKundaliCreated", handler);
    return () => window.removeEventListener("adminKundaliCreated", handler);
  }, [fetchRecords]);

  const filteredRecords = useMemo(() => {
    let result = records;

    if (filter === "guest") {
      result = result.filter(r => !r.user_id);
    } else if (filter === "authenticated") {
      result = result.filter(r => !!r.user_id);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.full_name?.toLowerCase().includes(q) ||
        r.birth_place?.toLowerCase().includes(q) ||
        r.birth_date?.includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        // Matched rows carry no email of their own, but searching the inferred
        // address should still find them.
        r.matched_email?.toLowerCase().includes(q) ||
        // Searching by IP is the point of having the column — it is how you go
        // from "this address looks suspicious" to the kundalis behind it.
        ipBySession[ipKey(r)]?.includes(q)
      );
    }

    return result;
  }, [records, filter, search, ipBySession]);

  const guestCount = records.filter(r => !r.user_id).length;
  const authCount = records.filter(r => !!r.user_id).length;

  return (
    // data-testid so e2e can scope to this section: a signed-in user's name
    // legitimately appears in BOTH this list and the Users table below, and an
    // unscoped text query matches both.
    <div className="mb-8" data-testid="all-kundali-list">
      {/* Header.
          The expand control is a button INSIDE this row, not wrapped around it:
          Refresh lives here too, and a <button> nested in a <button> is invalid
          markup that only worked because of an e.stopPropagation() patch. */}
      <div className="w-full flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-3">
        <button
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          className="flex flex-wrap items-center gap-2 min-h-[44px] text-left min-w-0"
        >
          <Sparkles className="w-4 h-4 text-admin-ok shrink-0" />
          <h2 className="text-sm font-semibold text-admin-text">All User-Generated Kundalis</h2>
          {!loading && loadError && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-admin-danger/15 text-admin-danger border border-admin-danger/40">
              failed to load
            </span>
          )}
          {!loading && !loadError && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-admin-ok/15 text-admin-ok border border-admin-ok/40">
              {records.length} total
            </span>
          )}
          {!loading && !loadError && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-admin-surface-2 text-admin-text-muted border border-admin-border">
              {guestCount} guest · {authCount} signed-in
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchRecords}
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

      {expanded && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="flex flex-wrap gap-1.5">
              {(["all", "guest", "authenticated"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filter === f
                      ? "bg-admin-ok/20 text-admin-ok border border-admin-ok/40"
                      : "bg-admin-surface-2 text-admin-text-muted border border-admin-border hover:text-admin-text"
                  }`}
                >
                  {f === "all" ? "All" : f === "guest" ? "Guest (No Account)" : "Signed-In Users"}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search name, email, place, date, IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[180px] px-3 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg bg-admin-surface-2 border border-admin-border text-admin-text placeholder-admin-text-faint text-xs outline-none focus:border-admin-ok/40 transition-colors"
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="rounded-xl border border-admin-border bg-admin-surface p-8 text-center text-admin-text-faint text-sm">
              <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
              Loading all kundalis...
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-admin-danger/40 bg-admin-danger/15 p-8 text-center text-admin-danger text-sm">
              <p className="font-medium mb-1">Could not load kundalis.</p>
              <p className="text-xs text-admin-danger/80 break-words">{loadError}</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="rounded-xl border border-admin-border bg-admin-surface p-8 text-center text-admin-text-faint text-sm">
              {search || filter !== "all"
                ? "No kundalis match your filters."
                : "No kundalis generated yet."}
            </div>
          ) : (
            <>
              <AdminTable
                rows={filteredRecords}
                rowKey={(rec) => rec.id}
                maxHeightClass="max-h-[500px]"
                stickyHeader
                columns={[
                  { label: "#", className: "w-8" },
                  { label: "Name", sortValue: (rec) => rec.full_name },
                  // Sorts on the email actually rendered, inferred matches
                  // included — sorting on rec.email alone would order the
                  // column differently from how it reads.
                  { label: "Email", sortValue: (rec) => rec.email || rec.matched_email },
                  { label: "Birth Details", sortValue: (rec) => `${rec.birth_date} ${rec.birth_time}` },
                  { label: "Place", sortValue: (rec) => rec.birth_place },
                  {
                    label: ipIsSample ? (
                      <span className="text-admin-warn" title="Generated sample data, not real traffic">
                        IP (sample)
                      </span>
                    ) : (
                      "IP"
                    ),
                    sortLabel: "IP",
                    sortValue: (rec) => ipBySession[ipKey(rec) ?? ""],
                  },
                  {
                    label: "Type",
                    align: "center",
                    sortValue: (rec) => (rec.is_admin_generated ? "Admin" : rec.user_id ? "Signed-In" : "Guest"),
                  },
                  { label: "Phase", align: "center", sortValue: (rec) => rec.financial_phase },
                  { label: "Created", sortValue: (rec) => rec.created_at, descFirst: true },
                  { label: "Actions", align: "right" },
                ]}
                renderRow={(rec, i) => (
                  <>
                    <td className="px-4 py-3 text-admin-text-faint text-xs">{i + 1}</td>
                    <td className="px-4 py-3 text-admin-text font-medium text-xs min-w-[140px]">
                      <span className="block break-words" title={rec.full_name || "—"}>
                        {rec.full_name || <span className="italic text-admin-text-faint">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-admin-text-muted text-xs min-w-[180px]">
                      {rec.email ? (
                        <span className="block break-all" title={rec.email}>{rec.email}</span>
                      ) : (
                        // A guest has no account and therefore no email. Saying "—"
                        // is the honest answer; the inferred owner, if any, is on
                        // the Type badge rather than dressed up as a real address.
                        <span className="italic text-admin-text-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-admin-text-muted text-xs whitespace-nowrap">
                      {rec.birth_date} · {rec.birth_time}
                    </td>
                    <td className="px-4 py-3 text-admin-text-muted text-xs min-w-[140px]">
                      <span className="block break-words" title={rec.birth_place}>{rec.birth_place}</span>
                    </td>
                    <td className="px-4 py-3 text-admin-text-muted text-xs font-mono min-w-[130px]">
                      {ipBySession[ipKey(rec)] ? (
                        <span className="block break-all" title={ipBySession[ipKey(rec)]}>
                          {ipBySession[ipKey(rec)]}
                        </span>
                      ) : (
                        <span className="italic text-admin-text-faint font-sans">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {typeBadge(rec)}
                        {rec.matched_email && matchBadge(rec.match)}
                        {rec.matched_email && (
                          <span
                            className="text-[10px] text-admin-text-faint break-all"
                            title={`Likely ${rec.matched_email}`}
                          >
                            {rec.matched_email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Pill tone={phaseColor(rec.financial_phase)}>{rec.financial_phase || "—"}</Pill>
                    </td>
                    <td className="px-4 py-3 text-admin-text-faint text-xs whitespace-nowrap">
                      {formatCreated(rec.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/shared/${rec.share_slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-admin-indigo hover:underline transition-colors justify-end"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View
                      </a>
                    </td>
                  </>
                )}
                renderCard={(rec) => (
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <span className="text-sm font-medium text-admin-text break-words min-w-0">
                        {rec.full_name || <span className="italic text-admin-text-faint">—</span>}
                      </span>
                      {typeBadge(rec)}
                    </div>
                    <AdminField label="Email">{rec.email || "—"}</AdminField>
                    {rec.matched_email && (
                      <AdminField label="Likely">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {rec.matched_email}
                          {matchBadge(rec.match)}
                        </span>
                      </AdminField>
                    )}
                    <AdminField label="Born">{rec.birth_date} · {rec.birth_time}</AdminField>
                    <AdminField label="Place">{rec.birth_place}</AdminField>
                    <AdminField label="IP">
                      {ipBySession[ipKey(rec)] || "—"}
                    </AdminField>
                    <AdminField label="Phase">
                      <Pill tone={phaseColor(rec.financial_phase)}>{rec.financial_phase || "—"}</Pill>
                    </AdminField>
                    <AdminField label="Created">{formatCreated(rec.created_at)}</AdminField>
                    <a
                      href={`/shared/${rec.share_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center justify-center gap-1.5 min-h-[44px] rounded-lg border border-admin-indigo/40 bg-admin-indigo/15 text-xs text-admin-indigo"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View kundali
                    </a>
                  </div>
                )}
              />
              {filteredRecords.length > 0 && (
                <div className="px-4 py-2 mt-2 text-xs text-admin-text-faint text-center">
                  Showing {filteredRecords.length} of {records.length} kundalis
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The provider wraps the page rather than the app: the admin theme is a separate
 * preference from the kundali one (own localStorage key, dark by default).
 */
const Admin = () => (
  <AdminThemeProvider>
    <AdminUsersProvider>
      <AdminInner />
    </AdminUsersProvider>
  </AdminThemeProvider>
);

export default Admin;
