import { TrendingUp, Clock } from "lucide-react";
import type { ReportSummary, DashaInfo, ReportConfidence } from "@/lib/vedicfinance-types";

const PHASE_COLORS: Record<string, { pill: string; glow: string; dot: string }> = {
  "Growth Phase":   { pill: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25", glow: "#34d399", dot: "bg-emerald-400" },
  "Stable Phase":   { pill: "text-blue-400 bg-blue-400/10 border-blue-400/25",          glow: "#60a5fa", dot: "bg-blue-400" },
  "Cautious Phase": { pill: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25",    glow: "#facc15", dot: "bg-yellow-400" },
  "Volatile Phase": { pill: "text-orange-400 bg-orange-400/10 border-orange-400/25",    glow: "#fb923c", dot: "bg-orange-400" },
  "Pressure Phase": { pill: "text-red-400 bg-red-400/10 border-red-400/25",             glow: "#f87171", dot: "bg-red-400" },
};

const CONF_CFG: Record<string, { stroke: string; label: string; text: string }> = {
  high:   { stroke: "#34d399", label: "High",   text: "text-emerald-400" },
  medium: { stroke: "#facc15", label: "Medium", text: "text-yellow-400" },
  low:    { stroke: "#f87171", label: "Low",    text: "text-red-400" },
};

interface Props {
  summary: ReportSummary;
  dasha: DashaInfo;
  confidence: ReportConfidence;
}

export default function SummaryCard({ summary, dasha, confidence }: Props) {
  const phase = PHASE_COLORS[summary.financial_phase] ?? PHASE_COLORS["Growth Phase"];
  const conf  = CONF_CFG[confidence.level] ?? CONF_CFG.medium;

  const r = 44;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (confidence.score / 100) * circumference;

  const dashaSteps = [
    { label: "Mahadasha",      lord: dasha.mahadasha_lord,  date: dasha.mahadasha_end,        prefix: "until",  active: true  },
    { label: "Antardasha",     lord: dasha.antardasha_lord, date: dasha.antardasha_end,        prefix: "until",  active: true  },
    { label: "Next Mahadasha", lord: dasha.next_mahadasha,  date: dasha.next_mahadasha_start,  prefix: "from",   active: false },
  ];

  return (
    <div className="glass-card-glow p-4 md:p-5 flex flex-col md:flex-row gap-4 md:gap-6 items-stretch min-h-0 md:min-h-[160px]">

      {/* ── Left: phase + insight ── */}
      <div className="flex-1 flex flex-col justify-between gap-3 min-w-0">
        <div className="space-y-2">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Financial Phase</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${phase.pill}`}>
              <TrendingUp className="w-3 h-3" />
              {summary.financial_phase}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 text-[10px] text-muted-foreground">
              <Clock className="w-2.5 h-2.5" />
              {summary.time_window}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-foreground/70 leading-relaxed border-l-2 border-primary/30 pl-3 line-clamp-3">
          {summary.primary_insight}
        </p>
      </div>

      {/* ── Divider ── */}
      <div className="hidden md:block w-px bg-white/[0.06] self-stretch" />
      <div className="md:hidden h-px bg-white/[0.06] w-full" />

      {/* ── Bottom row on mobile: dasha + confidence side by side ── */}
      <div className="flex flex-row md:contents gap-4">
        {/* ── Middle: vertical dasha stepper ── */}
        <div className="flex flex-col justify-center gap-0 w-auto md:w-36 shrink-0 flex-1 md:flex-none">
          {dashaSteps.map((step, i) => (
            <div key={step.label} className="flex items-start gap-2.5">
              {/* spine */}
              <div className="flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${step.active ? phase.dot : "bg-white/20"}`}
                  style={step.active ? { boxShadow: `0 0 6px ${phase.glow}` } : {}} />
                {i < dashaSteps.length - 1 && (
                  <div className="w-px flex-1 bg-white/[0.08] my-1" style={{ minHeight: 18 }} />
                )}
              </div>
              {/* text */}
              <div className="pb-3">
                <p className="text-[8px] uppercase tracking-widest text-muted-foreground leading-none mb-0.5">{step.label}</p>
                <p className={`text-[11px] font-semibold leading-tight ${step.active ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.lord}
                </p>
                <p className="text-[9px] text-muted-foreground/60">{step.prefix} {step.date}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Divider ── */}
        <div className="hidden md:block w-px bg-white/[0.06] self-stretch" />

        {/* ── Right: confidence metric circle ── */}
        <div className="flex flex-col items-center justify-center gap-2 w-auto md:w-28 shrink-0">
          <div className="relative w-20 h-20 md:w-24 md:h-24">
            <svg className="w-20 h-20 md:w-24 md:h-24 -rotate-90" viewBox="0 0 100 100">
              {/* track */}
              <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
              {/* glow layer */}
              <circle cx="50" cy="50" r={r} fill="none" stroke={conf.stroke} strokeWidth="7"
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
                style={{ filter: `drop-shadow(0 0 6px ${conf.stroke}80)`, transition: "stroke-dashoffset 1s ease" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl md:text-2xl font-bold tracking-tight">{confidence.score}</span>
              <span className="text-[8px] uppercase tracking-widest text-muted-foreground">Score</span>
            </div>
          </div>
          <div className="text-center">
            <p className={`text-xs font-semibold ${conf.text}`}>{conf.label} Confidence</p>
            <p className="text-[9px] text-muted-foreground/70 capitalize mt-0.5 leading-tight">{confidence.reason}</p>
          </div>
        </div>
      </div>

    </div>
  );
}
