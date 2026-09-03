import type { ReportTimeline } from "@/lib/vedicfinance-types";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function PeriodRow({
  type,
  start,
  end,
  reason,
}: {
  type: "favorable" | "caution";
  start: string;
  end: string;
  reason: string;
}) {
  const isFav = type === "favorable";
  return (
    <div className="flex gap-3 items-start">
      <div className="flex flex-col items-center gap-1 pt-1">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isFav ? "bg-emerald-400" : "bg-yellow-400"}`} />
        <div className={`w-px flex-1 min-h-[24px] ${isFav ? "bg-emerald-400/20" : "bg-yellow-400/20"}`} />
      </div>
      <div className="pb-4 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
              isFav ? "text-emerald-400 bg-emerald-400/10" : "text-yellow-400 bg-yellow-400/10"
            }`}
          >
            {isFav ? "Favorable" : "Caution"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(start)} – {formatDate(end)}
          </span>
        </div>
        <p className="text-xs text-foreground/70">{reason}</p>
      </div>
    </div>
  );
}

interface Props {
  timeline: ReportTimeline;
}

export default function TimelineBar({ timeline }: Props) {
  const allPeriods = [
    ...timeline.favorable_periods.map((p) => ({ ...p, type: "favorable" as const })),
    ...timeline.caution_periods.map((p) => ({ ...p, type: "caution" as const })),
  ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return (
    <div className="glass-card p-5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Financial Timeline</p>
      <div className="space-y-0">
        {allPeriods.map((p, i) => (
          <PeriodRow key={i} type={p.type} start={p.start} end={p.end} reason={p.reason} />
        ))}
      </div>
      <div className="flex gap-4 mt-2 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-emerald-400" /> Favorable
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-yellow-400" /> Caution
        </div>
      </div>
    </div>
  );
}
