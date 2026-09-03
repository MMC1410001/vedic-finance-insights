import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { SectorResult } from "../lib/sector-scoring-engine";

export interface SectorRadarChartProps {
  sectors: SectorResult[];
}

interface TooltipPayloadEntry {
  payload?: { sector: string; score: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;
  return (
    <div style={{
      background: "rgba(10,10,20,0.92)",
      border: "1px solid rgba(139,92,246,0.3)",
      borderRadius: 10,
      padding: "8px 12px",
      backdropFilter: "blur(16px)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
    }}>
      <p style={{ color: "rgba(203,213,225,0.8)", margin: 0, fontSize: 11 }}>{entry.sector}</p>
      <p style={{ color: "#a78bfa", margin: "2px 0 0", fontWeight: 700, fontSize: 13 }}>{entry.score}<span style={{ color: "rgba(148,163,184,0.5)", fontWeight: 400, fontSize: 10 }}>/100</span></p>
    </div>
  );
}

export function SectorRadarChart({ sectors }: SectorRadarChartProps) {
  const data = sectors.map((s) => ({
    sector: s.sectorName.split(" ")[0], // short label
    score: s.overallScore,
    fullMark: 100,
  }));

  const top3 = [...sectors].sort((a, b) => b.overallScore - a.overallScore).slice(0, 3);

  return (
    <div role="img" aria-label="Sector favorability radar chart">
      {/* Screen reader fallback */}
      <p style={{
        position: "absolute", width: 1, height: 1, padding: 0,
        margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)",
        whiteSpace: "nowrap", border: 0,
      }}>
        Top 3 sectors: {top3.map((s) => `${s.sectorName} (${s.overallScore})`).join(", ")}.
      </p>

      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%">
          <title>Sector Favorability Radar</title>
          <PolarGrid
            stroke="rgba(139,92,246,0.15)"
            strokeOpacity={1}
          />
          <PolarAngleAxis
            dataKey="sector"
            tick={{ fill: "rgba(148,163,184,0.6)", fontSize: 10, fontWeight: 500 }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="score"
            stroke="#a78bfa"
            fill="#a78bfa"
            fillOpacity={0.12}
            strokeWidth={1.5}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
