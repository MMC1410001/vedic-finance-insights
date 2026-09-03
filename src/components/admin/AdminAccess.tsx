/**
 * Who can get into this panel.
 *
 * Its own card rather than a filter over the user table, for a specific reason:
 * that table is capped and paged, so an admin past the cap would simply not
 * appear on it. A missing name on a list of "everyone with full access" is the
 * kind of gap nobody notices until it matters.
 *
 * The Make admin toggle on the user list stays exactly as it was — this is an
 * addition, not a replacement. Granting by email exists because the person you
 * want to promote is often easier to name than to find in a long table.
 *
 * The dangerous cases are refused server-side (see set-admin in
 * admin-user-management): you cannot remove your own access, and you cannot
 * remove the last admin. Both are also reflected in the UI here, so a disabled
 * control explains itself instead of a click failing after the fact.
 */

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Loader2, RefreshCw, AlertTriangle, Check, UserMinus } from "lucide-react";
import { invokeAdmin } from "@/lib/admin-api";
import { AdminCard, Pill } from "./AdminCard";

export interface AdminRow {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  /** True for the signed-in operator; their own remove control is disabled. */
  is_self: boolean;
}

const formatWhen = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export function AdminAccess() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invokeAdmin<{ admins?: AdminRow[] }>({ action: "list-admins" });
      setAdmins(data?.admins ?? []);
    } catch (err) {
      // Never an empty list on failure: "nobody is an admin" and "we could not
      // ask" lead to opposite conclusions, and only one of them is alarming.
      setError(err instanceof Error ? err.message : String(err));
      setAdmins([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await fn());
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  };

  const grant = () =>
    run(async () => {
      const target = email.trim();
      await invokeAdmin({ action: "set-admin", email: target, isAdmin: true });
      setEmail("");
      return `${target} now has admin access.`;
    });

  const revoke = (row: AdminRow) =>
    run(async () => {
      await invokeAdmin({ action: "set-admin", userId: row.id, isAdmin: false });
      return `Removed admin access for ${row.email ?? row.id}.`;
    });

  const onlyOne = admins.length <= 1;

  return (
    <div className="mb-6" data-testid="admin-access">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="w-4 h-4 text-admin-info shrink-0" />
          <h3 className="text-sm font-semibold text-admin-text">Admin access</h3>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-admin-text-muted" />}
          {!loading && error && (
            <Pill size="md" tone="bg-admin-danger/15 text-admin-danger border border-admin-danger/40">
              failed to load
            </Pill>
          )}
          {!loading && !error && (
            <Pill size="md" tone="bg-admin-surface-2 text-admin-text-muted border border-admin-border">
              {admins.length} {admins.length === 1 ? "person" : "people"}
            </Pill>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-2 min-h-[44px] text-xs text-admin-text-muted hover:text-admin-text transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <p className="text-[11px] text-admin-text-muted mb-3">
        Everyone here can see every user, every kundali and every payment, and can grant
        access to others. The <strong>Make admin</strong> toggle in the table below does the
        same thing for someone already listed there.
      </p>

      {error && (
        <AdminCard className="p-3 mb-3 border-admin-danger/40 bg-admin-danger/10">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-admin-danger shrink-0 mt-0.5" />
            <p className="text-xs text-admin-text min-w-0 break-words" data-testid="admin-access-error">
              {error}
            </p>
          </div>
        </AdminCard>
      )}

      {notice && (
        <AdminCard className="p-3 mb-3 border-admin-ok/40 bg-admin-ok/10">
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-admin-ok shrink-0 mt-0.5" />
            <p className="text-xs text-admin-text min-w-0 break-words" data-testid="admin-access-result">
              {notice}
            </p>
          </div>
        </AdminCard>
      )}

      <AdminCard className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 mb-4">
          <label className="flex flex-col gap-1 min-w-0 sm:flex-1">
            <span className="text-[10px] uppercase tracking-wider text-admin-text-faint">
              Grant access by email
            </span>
            <div className="flex gap-2 min-w-0">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="someone@example.com"
                aria-label="New admin email"
                className="flex-1 min-w-0 px-2 min-h-[44px] sm:min-h-[36px] rounded-lg bg-admin-surface-2 border border-admin-border text-xs text-admin-text"
              />
              <button
                onClick={grant}
                disabled={!email.includes("@") || busy}
                className="shrink-0 px-3 min-h-[44px] sm:min-h-[36px] rounded-lg bg-admin-info-strong text-white text-xs disabled:opacity-40 transition-opacity"
              >
                Make admin
              </button>
            </div>
          </label>
        </div>

        {/* Stated up front, because it is the most common reason this fails and
            the message would otherwise arrive only after a click. */}
        <p className="text-[11px] text-admin-text-faint mb-4">
          They must have signed in to VedicFinance at least once: an email with no account
          cannot be granted access.
        </p>

        {admins.length === 0 && !loading && !error && (
          <p className="text-xs text-admin-text-muted">No admins found.</p>
        )}

        <div>
          {admins.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-2 py-2 border-b border-admin-border-subtle last:border-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-admin-text break-all" title={row.email ?? row.id}>
                  {row.email ?? row.id}
                  {row.is_self && <span className="ml-1.5 text-admin-text-faint">(you)</span>}
                </span>
                <span className="block text-[10px] text-admin-text-faint">
                  joined {formatWhen(row.created_at)} · last seen {formatWhen(row.last_sign_in_at)}
                </span>
              </span>

              {/* Disabled with the reason on the control rather than letting the
                  click fail server-side. Both rules are enforced there too — this
                  is the explanation, not the guard. */}
              <button
                onClick={() => revoke(row)}
                disabled={busy || row.is_self || onlyOne}
                title={
                  row.is_self
                    ? "You cannot remove your own access. Ask another admin."
                    : onlyOne
                      ? "This is the only admin: removing them would lock everyone out."
                      : `Remove admin access for ${row.email ?? row.id}`
                }
                aria-label={`Remove admin access for ${row.email ?? row.id}`}
                className="flex items-center gap-1.5 shrink-0 px-2 min-h-[44px] sm:min-h-[32px] rounded-lg border border-admin-border text-[11px] text-admin-text-muted hover:text-admin-danger hover:border-admin-danger/40 disabled:opacity-30 disabled:hover:text-admin-text-muted disabled:hover:border-admin-border transition-colors"
              >
                <UserMinus className="w-3.5 h-3.5" />
                Remove
              </button>
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}
