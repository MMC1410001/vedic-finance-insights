import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { MonthForecast } from "@/lib/astro-engine";

interface IncomeTimelineProps {
  data: MonthForecast[];
}

const typeColors = {
  growth: "hsl(170, 75%, 45%)",
  stagnant: "hsl(32, 90%, 55%)",
  pressure: "hsl(0, 72%, 51%)",
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as MonthForecast;
  return (
    <div className="glass-card p-3 text-xs max-w-[200px]">
      <p className="font-semibold text-foreground mb-1">{d.month}</p>
      <p className="mb-1" style={{ color: typeColors[d.type] }}>
        {d.type === "growth" ? "📈 Growth" : d.type === "stagnant" ? "⏸ Stagnant" : "⚠️ Pressure"}, Score: {d.score}
      </p>
      <p className="text-muted-foreground">{d.insight}</p>
    </div>
  );
};

const IncomeTimeline = ({ data }: IncomeTimelineProps) => (
  <div className="glass-card p-5">
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Income Timeline</p>
    <p className="text-sm font-semibold tracking-tight mb-4">12-Month Wealth Forecast</p>
    <div className="flex gap-4 mb-3 text-[10px]">
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-favorable" /> Growth</span>
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" /> Stagnant</span>
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive" /> Pressure</span>
    </div>
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(43, 72%, 52%)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(220, 20%, 4%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tick={{ fontSize: 9, fill: "hsl(220,10%,45%)" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(220,10%,45%)" }} axisLine={false} tickLine={false} />
        <ReferenceLine y={50} stroke="hsl(220,15%,18%)" strokeDasharray="4 4" />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="score"
          stroke="hsl(43, 72%, 52%)"
          strokeWidth={2}
          fill="url(#scoreGrad)"
          style={{ filter: "drop-shadow(0 0 6px hsl(43 72% 52% / 0.4))" }}
          dot={(props: any) => {
            const d = data[props.index];
            if (!d) return <circle key={props.index} />;
            return (
              <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill={typeColors[d.type]} stroke="hsl(220,18%,9%)" strokeWidth={2} />
            );
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export default IncomeTimeline;
