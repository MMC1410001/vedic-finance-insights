/**
 * CareerGrowthScore — 3-zone gauge showing career strength.
 */

import type { CareerInsight } from "@/lib/financial-kundali-engine";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";

interface Props {
  career: CareerInsight | null;
}

export default function CareerGrowthScore({ career }: Props) {
  const score = career?.careerStrength ?? 0;

  const zones = [
    { label: "Needs Attention", min: 0, max: 44, color: "#E06BAA" },
    { label: "Stable Growth", min: 45, max: 69, color: "#F2C572" },
    { label: "High Stability", min: 70, max: 100, color: "#2FBF9F" },
  ];

  const activeZone = zones.find((z) => score >= z.min && score <= z.max) ?? zones[1];
  const markerPercent = Math.max(2, Math.min(98, score));
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div
      className="rounded-2xl px-5 pt-5 pb-5 flex flex-col"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Title + score */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-1.5">
          <h3
            className="text-[13px] font-semibold tracking-wide uppercase"
            style={{ color: "#F2C572", letterSpacing: "0.06em" }}
          >
            Career Growth Score
          </h3>
          <InsightInfoTooltip explanation="Career strength is calculated from your 10th house lord's placement and dignity. A score above 70 means strong career momentum, 45–69 is stable growth, and below 45 needs focused effort during the next favourable Dasha period." />
        </div>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="text-xl font-bold" style={{ color: activeZone.color }}>{score}</span>
          <span className="text-[10px]" style={{ color: "rgba(214,198,245,0.5)" }}>/100</span>
        </div>
      </div>

      {/* 3-zone gauge bar */}
      <div className="relative mb-2">
        <div className="flex h-[5px] rounded-full overflow-hidden gap-[2px]">
          {zones.map((z) => (
            <div
              key={z.label}
              className="h-full rounded-full"
              style={{
                width: `${z.max - z.min + 1}%`,
                background: z === activeZone ? z.color : `${z.color}40`,
                boxShadow: z === activeZone ? `0 0 6px ${z.color}50` : "none",
              }}
            />
          ))}
        </div>

        {/* Marker */}
        <div
          className="absolute top-1/2"
          style={{ left: `${markerPercent}%`, transform: "translateX(-50%) translateY(-50%)" }}
        >
          <div
            className="w-3.5 h-3.5 rounded-full border-[2px]"
            style={{
              background: activeZone.color,
              borderColor: "#0D0618",
              boxShadow: `0 0 10px ${activeZone.color}90, 0 0 3px ${activeZone.color}`,
            }}
          />
        </div>
      </div>

      {/* Tick marks */}
      <div className="relative h-4 mb-2">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute text-[8px] font-medium"
            style={{
              left: `${t}%`,
              transform: "translateX(-50%)",
              color: "rgba(214,198,245,0.55)",
            }}
          >
            {t}
          </span>
        ))}
      </div>

      {/* Zone labels */}
      <div className="flex justify-between">
        {zones.map((z) => (
          <span
            key={z.label}
            className="text-[8px] uppercase tracking-wider font-semibold"
            style={{ color: z === activeZone ? z.color : "rgba(214,198,245,0.45)" }}
          >
            {z.label}
          </span>
        ))}
      </div>
    </div>
  );
}
