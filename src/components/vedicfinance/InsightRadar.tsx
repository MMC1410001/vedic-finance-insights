import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import type { ReportScores } from "@/lib/vedicfinance-types";
import { useIsMobile } from "@/hooks/use-mobile";

const ITEMS = [
  { key: "income_score",        label: "Income Support",          short: "Income" },
  { key: "natal_wealth_score",  label: "Wealth Strength",         short: "Wealth" },
  { key: "savings_score",       label: "Savings Retention",       short: "Savings" },
  { key: "investment_score",    label: "Investment Favorability",  short: "Invest" },
  { key: "risk_score",          label: "Risk / Volatility",       short: "Risk" },
  { key: "expense_score",       label: "Expense Pressure",        short: "Expense" },
  { key: "timing_score",        label: "Timing Support",          short: "Timing" },
] as const;

interface Props { scores: ReportScores }

export default function InsightRadar({ scores }: Props) {
  const isMobile = useIsMobile();
  const data = ITEMS.map(({ key, label, short }) => ({ subject: isMobile ? short : label, value: scores[key] }));

  return (
    <div
      className="rounded-2xl p-3 lg:p-4"
      style={{ background: "rgba(10,18,14,0.75)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(16px)" }}
    >
      <p className="text-[8px] uppercase tracking-widest text-white/30 mb-0.5">Vedic Analysis</p>
      <p className="text-[10px] lg:text-xs font-semibold text-white mb-1">Vedic Based Financial Insights</p>
      <ResponsiveContainer width="100%" height={isMobile ? 180 : 220}>
        <RadarChart data={data} outerRadius={isMobile ? 50 : 60} margin={isMobile ? { top: 12, right: 20, bottom: 12, left: 20 } : { top: 16, right: 28, bottom: 16, left: 28 }}>
          <PolarGrid stroke="hsl(220,15%,18%)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "hsl(220,10%,50%)", fontSize: isMobile ? 7 : 9 }}
          />
          <Radar
            dataKey="value"
            stroke="hsl(43,72%,52%)"
            fill="hsl(43,72%,52%)"
            fillOpacity={0.15}
            strokeWidth={2}
            style={{ filter: "drop-shadow(0 0 6px hsl(43 72% 52% / 0.3))" }}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(220,18%,9%)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              fontSize: 11,
            }}
            labelStyle={{ color: "hsl(220,10%,90%)" }}
            formatter={(value: number) => [
              <span style={{ color: value < 50 ? "hsl(0,72%,60%)" : value < 65 ? "hsl(43,72%,52%)" : "hsl(170,75%,45%)" }}>
                {value}
              </span>,
              "Score",
            ]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
