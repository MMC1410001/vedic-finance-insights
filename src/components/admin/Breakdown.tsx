/**
 * Small labelled bar list — devices, browsers and both source views share it.
 *
 * Its own module because two panels need it: the Analytics dashboard renders
 * Devices/Browsers/Sources with it, and CampaignsPanel renders the tagged-source
 * split. Importing it back out of AnalyticsDashboard would make that pair
 * circular, since the dashboard mounts the campaigns panel.
 */

import type { LucideIcon } from "lucide-react";
import { AdminCard } from "./AdminCard";
import { num, pct, ratio } from "./analytics-format";

export function Breakdown({
  title,
  icon: Icon,
  rows,
  note,
}: {
  title: string;
  icon: LucideIcon;
  rows: { label: string; sessions: number }[];
  /** One line under the title, for when the metric needs disambiguating. */
  note?: string;
}) {
  const total = rows.reduce((sum, r) => sum + r.sessions, 0);

  return (
    <AdminCard className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-admin-text-muted" />
        <h4 className="text-xs font-semibold text-admin-text">{title}</h4>
      </div>
      {note && <p className="text-[10px] text-admin-text-faint mb-2">{note}</p>}
      {!note && <div className="mb-2" />}
      {rows.length === 0 && <p className="text-xs text-admin-text-muted">—</p>}
      <div className="space-y-2">
        {rows.map((row) => {
          const share = ratio(row.sessions, total);
          return (
            <div key={row.label}>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-admin-text-secondary capitalize break-words min-w-0">{row.label}</span>
                <span className="text-admin-text-muted tabular-nums shrink-0 ml-2">
                  {num(row.sessions)} · {pct(share)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-admin-surface-2 overflow-hidden">
                <div
                  className="h-full bg-admin-info/60"
                  style={{ width: `${share ?? 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </AdminCard>
  );
}
