import type { ReportConfidence, DashaInfo } from "@/lib/vedicfinance-types";

interface Props {
  confidence: ReportConfidence;
  dasha: DashaInfo;
}

export default function InsightConfidence({ confidence, dasha }: Props) {
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (confidence.score / 100) * circumference;
  const isHigh = confidence.level === "high";
  const strokeColor = isHigh ? "#34d399" : confidence.level === "medium" ? "#facc15" : "#f87171";

  return (
    <div
      className="rounded-2xl p-3 lg:p-4 flex gap-3 lg:gap-4"
      style={{ background: "rgba(10,18,14,0.75)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(16px)" }}
    >
      {/* Left — dasha stepper */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        {[
          { label: "Mahadasha",      lord: dasha.mahadasha_lord,  date: dasha.mahadasha_end,       prefix: "until", active: true  },
          { label: "Antardasha",     lord: dasha.antardasha_lord, date: dasha.antardasha_end,       prefix: "until", active: true  },
          { label: "Next Mahadasha", lord: dasha.next_mahadasha,  date: dasha.next_mahadasha_start, prefix: "from",  active: false },
        ].map((step, i, arr) => (
          <div key={step.label} className="flex items-start gap-2">
            {/* dot + connector */}
            <div className="flex flex-col items-center">
              <div
                className="w-2 h-2 rounded-full mt-1 shrink-0"
                style={step.active
                  ? { background: strokeColor, boxShadow: `0 0 6px ${strokeColor}` }
                  : { background: "rgba(255,255,255,0.2)" }}
              />
              {i < arr.length - 1 && (
                <div className="w-px bg-white/10 my-1" style={{ minHeight: 20 }} />
              )}
            </div>
            {/* text */}
            <div className="pb-3 lg:pb-5">
              <p className="text-[8px] lg:text-[9px] uppercase tracking-widest text-white/35 leading-none mb-0.5">{step.label}</p>
              <p className={`text-xs lg:text-sm font-semibold leading-tight ${step.active ? "text-white" : "text-white/50"}`}>
                {step.lord}
              </p>
              <p className="text-[9px] lg:text-[10px] text-white/35">{step.prefix} {step.date}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Right — circular score */}
      <div className="flex flex-col items-center justify-center gap-1.5 lg:gap-2 flex-shrink-0">
        <div className="relative w-18 h-18 lg:w-24 lg:h-24" style={{ width: 'clamp(72px, 18vw, 96px)', height: 'clamp(72px, 18vw, 96px)' }}>
          <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
            <circle
              cx="44" cy="44" r="38"
              fill="none"
              stroke={strokeColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ filter: `drop-shadow(0 0 6px ${strokeColor}88)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{confidence.score}</span>
            <span className="text-[9px] text-white/35 uppercase tracking-wide">score</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs lg:text-sm font-semibold" style={{ color: strokeColor }}>
            {isHigh ? "High Confidence" : confidence.level === "medium" ? "Medium Confidence" : "Low Confidence"}
          </p>
          <p className="text-[9px] lg:text-[10px] text-white/40 mt-0.5 max-w-[110px] leading-snug">{confidence.reason}</p>
        </div>
      </div>
    </div>
  );
}
