import type { ReportConfidence } from "@/lib/vedicfinance-types";

const LEVEL_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  high: { color: "text-emerald-400", bg: "bg-emerald-400", label: "High Confidence" },
  medium: { color: "text-yellow-400", bg: "bg-yellow-400", label: "Medium Confidence" },
  low: { color: "text-red-400", bg: "bg-red-400", label: "Low Confidence" },
};

interface Props {
  confidence: ReportConfidence;
}

export default function ConfidencePanel({ confidence }: Props) {
  const cfg = LEVEL_CONFIG[confidence.level] ?? LEVEL_CONFIG.medium;
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (confidence.score / 100) * circumference;

  return (
    <div className="glass-card p-5 flex flex-col sm:flex-row items-center gap-5">
      {/* Circular gauge */}
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="hsl(220 15% 14%)" strokeWidth="6" />
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke={confidence.level === "high" ? "#34d399" : confidence.level === "medium" ? "#facc15" : "#f87171"}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold">{confidence.score}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Score</span>
        </div>
      </div>

      <div className="flex-1 space-y-2 text-center sm:text-left">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Analysis Confidence</p>
          <p className={`text-base font-semibold mt-0.5 ${cfg.color}`}>{cfg.label}</p>
        </div>
        <p className="text-xs text-muted-foreground capitalize">{confidence.reason}</p>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden max-w-[200px] mx-auto sm:mx-0">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${cfg.bg}`}
            style={{ width: `${confidence.score}%` }}
          />
        </div>
      </div>
    </div>
  );
}
