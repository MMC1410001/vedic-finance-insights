import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ReportScores } from "@/lib/vedicfinance-types";

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "Strong", color: "#34d399" };
  if (score >= 45) return { label: "Moderate", color: "#facc15" };
  return { label: "Weak", color: "#f87171" };
}

const SCORE_ITEMS: { key: keyof ReportScores; title: string }[] = [
  { key: "income_score", title: "Income Support" },
  { key: "natal_wealth_score", title: "Wealth Strength" },
  { key: "savings_score", title: "Savings Retention" },
  { key: "investment_score", title: "Investment Favorability" },
  { key: "risk_score", title: "Risk / Volatility" },
  { key: "expense_score", title: "Expense Pressure" },
  { key: "timing_score", title: "Timing Support" },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { subject, value } = payload[0].payload;
  const { label, color } = scoreLabel(value);
  return (
    <div className="glass-card px-3 py-2 text-xs space-y-1">
      <p className="text-muted-foreground">{subject}</p>
      <p className="font-bold text-base" style={{ color }}>
        {value} <span className="text-muted-foreground font-normal">/100</span>
      </p>
      <p className="font-semibold uppercase tracking-wide" style={{ color }}>{label}</p>
    </div>
  );
};

interface Props {
  scores: ReportScores;
}

export default function ScoreGrid({ scores }: Props) {
  const data = SCORE_ITEMS.map(({ key, title }) => ({
    subject: title,
    value: scores[key],
  }));

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
        Financial Scores
      </p>
      <div className="glass-card p-3 md:p-4">
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
            />
            <Radar
              name="Score"
              dataKey="value"
              stroke="#facc15"
              fill="#facc15"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={{ r: 4, fill: "#facc15", strokeWidth: 0 }}
            />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>

        {/* Legend row */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-2">
          {data.map(({ subject, value }) => {
            const { label, color } = scoreLabel(value);
            return (
              <div key={subject} className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-muted-foreground">{subject}</span>
                <span className="font-semibold" style={{ color }}>{value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
