/**
 * Internal traffic — which sessions are the team's own.
 *
 * This is a **filter, not a blocklist**. Every rule here still gets recorded and
 * still appears in the Visitors table below, marked. All it changes is what the
 * Analytics section subtracts, and only while that section's toggle is on.
 *
 * ── Why "Add my current IP" is the primary control ─────────────────────────
 * Measured from the Vikhroli office: three consecutive requests left by three
 * different ISPs (Tata Teleservices, Satellite Netcom, Vortex Netsol). The
 * office balances across several WAN links per request, so there is no single
 * address to type in — and a browser cannot read its own public IP anyway.
 * The edge function resolves it from the request headers, which makes collecting
 * all of an office's links a matter of clicking this a few times from there.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Building2, Loader2, RefreshCw, Plus, Trash2, Globe, UserRound, AlertTriangle, Check,
} from "lucide-react";
import { invokeAdmin } from "@/lib/admin-api";
import { AdminCard, Pill } from "./AdminCard";

/** The union of what the internal-traffic actions reply with. */
interface AdminReply {
  entries?: InternalEntry[];
  entry?: { network?: string | null } | null;
  alreadyPresent?: boolean;
  ip?: string | null;
  added?: number;
  domain?: string;
}

export interface InternalEntry {
  id: string;
  kind: "network" | "account";
  network: string | null;
  user_id: string | null;
  email: string | null;
  label: string;
  note: string | null;
  enabled: boolean;
  created_at: string;
}

/** One admin action, with its result surfaced rather than swallowed. */
type Busy = null | "loading" | "whoami" | "add" | "sync";

export function InternalTraffic() {
  const [entries, setEntries] = useState<InternalEntry[]>([]);
  const [busy, setBusy] = useState<Busy>("loading");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const [newNetwork, setNewNetwork] = useState("");
  const [newLabel, setNewLabel] = useState("Vikhroli");
  const [newEmail, setNewEmail] = useState("");
  const [domain, setDomain] = useState("example.com");

  // invokeAdmin, not functions.invoke: a deliberate 400 from the function
  // carries its reason in the response body, which invoke() discards. Without
  // it every validation message here reads "non-2xx status code".
  const call = useCallback(
    (body: Record<string, unknown>) => invokeAdmin<AdminReply>(body),
    [],
  );

  const refresh = useCallback(async () => {
    setBusy("loading");
    setError(null);
    try {
      const data = await call({ action: "list-internal-traffic" });
      const rows = (data?.entries ?? []) as InternalEntry[];

      // Dev preview so the card is usable before migration 018 is applied.
      // import.meta.env.DEV is a compile-time constant, so the dynamic import
      // lets the bundler drop this branch and the mock module from a production
      // build — a static import would ship the sample rows.
      if (import.meta.env.DEV && rows.length === 0) {
        const dev = await import("@/lib/dev-visitor-mock");
        if (dev.mockVisitorsEnabled()) {
          setEntries(dev.mockInternalTraffic() as InternalEntry[]);
          setIsSample(true);
          setBusy(null);
          return;
        }
      }

      setEntries(rows);
      setIsSample(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (import.meta.env.DEV) {
        const dev = await import("@/lib/dev-visitor-mock");
        if (dev.mockVisitorsEnabled()) {
          setEntries(dev.mockInternalTraffic() as InternalEntry[]);
          setIsSample(true);
          setBusy(null);
          return;
        }
      }
      // Never an empty list on failure: "no rules configured" and "could not ask"
      // lead to opposite conclusions about whether the filter is working.
      setError(message);
      setEntries([]);
    }
    setBusy(null);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Wrap an action so its outcome is always reported, success or failure. */
  const run = async (state: Busy, fn: () => Promise<string>) => {
    setBusy(state);
    setError(null);
    setNotice(null);
    try {
      setNotice(await fn());
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  };

  const addCurrentIp = () =>
    run("whoami", async () => {
      const who = await call({ action: "whoami-ip" });
      if (!who?.ip) throw new Error("The server could not read an address for this request.");

      const added = await call({
        action: "add-internal-network",
        network: who.ip,
        label: newLabel || "Internal",
        note: `Added from the admin panel on ${new Date().toLocaleDateString("en-IN")}`,
      });

      return added?.alreadyPresent
        ? `${who.ip} was already covered.`
        : `Added ${who.ip}. This office may use several links: click again in a minute to catch the others.`;
    });

  const addNetwork = () =>
    run("add", async () => {
      const added = await call({
        action: "add-internal-network",
        network: newNetwork,
        label: newLabel || "Internal",
      });
      setNewNetwork("");
      return added?.alreadyPresent ? "That address was already covered." : `Added ${added?.entry?.network ?? newNetwork}.`;
    });

  const addAccount = () =>
    run("add", async () => {
      const added = await call({ action: "add-internal-account", email: newEmail, label: "Team" });
      const target = newEmail;
      setNewEmail("");
      return added?.alreadyPresent ? `${target} was already listed.` : `Added ${target}.`;
    });

  const syncDomain = () =>
    run("sync", async () => {
      const result = await call({ action: "sync-internal-domain", domain });
      return result?.added
        ? `Listed ${result.added} account${result.added === 1 ? "" : "s"} at @${result.domain}.`
        : `No accounts found at @${result?.domain ?? domain}.`;
    });

  const setEnabled = (entry: InternalEntry, enabled: boolean) =>
    run(null, async () => {
      await call({ action: "set-internal-enabled", entryId: entry.id, enabled });
      const name = entry.network ?? entry.email ?? "entry";
      return `${name} ${enabled ? "enabled" : "disabled"}.`;
    });

  const remove = (entry: InternalEntry) =>
    run(null, async () => {
      await call({ action: "remove-internal-entry", entryId: entry.id });
      return `Removed ${entry.network ?? entry.email ?? "entry"}.`;
    });

  const networks = entries.filter((e) => e.kind === "network");
  const accounts = entries.filter((e) => e.kind === "account");
  const activeCount = entries.filter((e) => e.enabled).length;

  const Row = ({ entry }: { entry: InternalEntry }) => (
    <div
      className={`flex items-center gap-2 py-1.5 border-b border-admin-border-subtle last:border-0 ${
        entry.enabled ? "" : "opacity-50"
      }`}
    >
      {entry.kind === "network" ? (
        <Globe className="w-3.5 h-3.5 text-admin-text-faint shrink-0" />
      ) : (
        <UserRound className="w-3.5 h-3.5 text-admin-text-faint shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-mono text-admin-text break-all">
          {entry.network ?? entry.email ?? entry.user_id}
        </span>
        {entry.note && (
          <span className="block text-[10px] text-admin-text-faint break-words" title={entry.note}>
            {entry.note}
          </span>
        )}
      </span>
      <Pill tone="bg-admin-surface-2 text-admin-text-muted border border-admin-border" className="px-1.5 shrink-0">
        {entry.label}
      </Pill>
      {/* Disable is offered before delete, and listed first: it keeps the note
          explaining what an address was, which is the only way to tell a stale
          entry from a live one a year from now. */}
      <button
        onClick={() => setEnabled(entry, !entry.enabled)}
        className="text-[10px] px-2 min-h-[44px] sm:min-h-[28px] rounded-lg border border-admin-border text-admin-text-muted hover:text-admin-text transition-colors shrink-0"
      >
        {entry.enabled ? "Disable" : "Enable"}
      </button>
      <button
        onClick={() => remove(entry)}
        aria-label={`Remove ${entry.network ?? entry.email ?? "entry"}`}
        className="grid place-items-center min-h-[44px] min-w-[44px] sm:min-h-[44px] sm:min-h-[28px] sm:min-w-[28px] text-admin-text-faint hover:text-admin-danger transition-colors shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <div className="mb-6" data-testid="internal-traffic">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex flex-wrap items-center gap-2 min-h-[44px] text-left min-w-0"
        >
          <Building2 className="w-4 h-4 text-admin-info shrink-0" />
          <h3 className="text-sm font-semibold text-admin-text">Internal traffic</h3>
          {busy === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin text-admin-text-muted" />}
          {isSample && (
            <Pill size="md" tone="bg-admin-warn/20 text-admin-warn border border-admin-warn/40" className="font-semibold">
              SAMPLE DATA
            </Pill>
          )}
          {busy !== "loading" && !error && (
            <Pill size="md" tone="bg-admin-surface-2 text-admin-text-muted border border-admin-border">
              {networks.length} network{networks.length === 1 ? "" : "s"} · {accounts.length} account
              {accounts.length === 1 ? "" : "s"} · {activeCount} active
            </Pill>
          )}
        </button>
        <button
          onClick={refresh}
          disabled={busy === "loading"}
          className="flex items-center gap-1.5 px-2 min-h-[44px] text-xs text-admin-text-muted hover:text-admin-text transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy === "loading" ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <p className="text-[11px] text-admin-text-muted mb-3">
        These rules only affect the <strong>Analytics</strong> section, and only while its
        “Real users” toggle is on. Nothing here stops traffic being recorded, and every
        session below stays visible: internal ones are simply marked.
      </p>

      {error && (
        <AdminCard className="p-3 mb-3 border-admin-danger/40 bg-admin-danger/10">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-admin-danger shrink-0 mt-0.5" />
            <p className="text-xs text-admin-text min-w-0 break-words" data-testid="internal-traffic-error">
              {error}
            </p>
          </div>
        </AdminCard>
      )}

      {notice && (
        <AdminCard className="p-3 mb-3 border-admin-ok/40 bg-admin-ok/10">
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-admin-ok shrink-0 mt-0.5" />
            <p className="text-xs text-admin-text min-w-0 break-words" data-testid="internal-traffic-result">
              {notice}
            </p>
          </div>
        </AdminCard>
      )}

      <AdminCard className="p-4">
        {/* Stacked on phones, side by side from sm up. These controls carry
            long labels and a monospace input; forcing them onto one line at
            390px pushed the whole page sideways by 8px. */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-2 mb-4">
          <label className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-admin-text-faint">Office</span>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              aria-label="Office label"
              className="w-full sm:w-32 min-w-0 px-2 min-h-[44px] sm:min-h-[36px] rounded-lg bg-admin-surface-2 border border-admin-border text-xs text-admin-text"
            />
          </label>

          {/* The primary control. See the header comment on why typing an address
              is the fallback rather than the main path. */}
          <button
            onClick={addCurrentIp}
            disabled={busy === "whoami"}
            className="flex items-center justify-center gap-1.5 px-3 min-h-[44px] sm:min-h-[36px] rounded-lg bg-admin-info-strong text-white text-xs disabled:opacity-50 transition-opacity"
          >
            {busy === "whoami" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add my current IP
          </button>

          <label className="flex flex-col gap-1 min-w-0 sm:flex-1">
            <span className="text-[10px] uppercase tracking-wider text-admin-text-faint">
              …or an address / range
            </span>
            <div className="flex gap-2 min-w-0">
              <input
                value={newNetwork}
                onChange={(e) => setNewNetwork(e.target.value)}
                placeholder="103.87.167.0/24"
                aria-label="IP address or range"
                className="flex-1 min-w-0 px-2 min-h-[44px] sm:min-h-[36px] rounded-lg bg-admin-surface-2 border border-admin-border text-xs text-admin-text font-mono"
              />
              <button
                onClick={addNetwork}
                disabled={!newNetwork.trim() || busy === "add"}
                className="shrink-0 px-3 min-h-[44px] sm:min-h-[36px] rounded-lg border border-admin-border text-xs text-admin-text-muted hover:text-admin-text disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
          </label>
        </div>

        <p className="text-[11px] uppercase tracking-wide text-admin-text-faint mb-1">
          Office networks
        </p>
        {networks.length === 0 && (
          <p className="text-xs text-admin-text-muted mb-3">
            None yet. Click <strong>Add my current IP</strong> from each office.
          </p>
        )}
        <div className="mb-4">
          {networks.map((entry) => (
            <Row key={entry.id} entry={entry} />
          ))}
        </div>

        <p className="text-[11px] uppercase tracking-wide text-admin-text-faint mb-1">
          Internal accounts
        </p>
        <p className="text-[11px] text-admin-text-muted mb-2">
          Catches the team testing from home or on mobile data, but only once they are
          signed in. Their logged-out browsing still counts as a real user.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-end gap-2 mb-3">
          <div className="flex gap-2 min-w-0 sm:flex-1">
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="someone@example.com"
              aria-label="Account email"
              className="flex-1 min-w-0 px-2 min-h-[44px] sm:min-h-[36px] rounded-lg bg-admin-surface-2 border border-admin-border text-xs text-admin-text"
            />
            <button
              onClick={addAccount}
              disabled={!newEmail.includes("@") || busy === "add"}
              className="shrink-0 px-3 min-h-[44px] sm:min-h-[36px] rounded-lg border border-admin-border text-xs text-admin-text-muted hover:text-admin-text disabled:opacity-40 transition-colors"
            >
              Add
            </button>
          </div>
          <div className="flex gap-2 min-w-0">
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              aria-label="Email domain"
              className="flex-1 sm:w-36 sm:flex-none min-w-0 px-2 min-h-[44px] sm:min-h-[36px] rounded-lg bg-admin-surface-2 border border-admin-border text-xs text-admin-text"
            />
            {/* Short label, because the sentence below already explains it — a
                button wide enough to hold the explanation is what broke the
                mobile layout in the first place. */}
            <button
              onClick={syncDomain}
              disabled={busy === "sync"}
              className="flex items-center gap-1.5 shrink-0 px-3 min-h-[44px] sm:min-h-[36px] rounded-lg border border-admin-border text-xs text-admin-text-muted hover:text-admin-text disabled:opacity-40 transition-colors"
            >
              {busy === "sync" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Add all
            </button>
          </div>
        </div>

        {accounts.length === 0 && <p className="text-xs text-admin-text-muted">None listed.</p>}
        <div>
          {accounts.map((entry) => (
            <Row key={entry.id} entry={entry} />
          ))}
        </div>

        {/* Stated because re-running it is the intended workflow, and a rule that
            looks automatic but is not would quietly go stale as people join. */}
        <p className="text-[11px] text-admin-text-faint mt-3">
          <strong>Add all</strong> lists every account at that domain which exists right
          now. Someone who joins later is not added automatically: click it again.
        </p>
      </AdminCard>
    </div>
  );
}
