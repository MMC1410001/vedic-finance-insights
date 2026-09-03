import { TrendingUp, TrendingDown, Minus, DollarSign, BarChart2, Shield, Zap, CreditCard, Activity } from "lucide-react";
import type { ReportDashboard } from "@/lib/vedicfinance-types";

const RATING_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  strong: { label: "Strong", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  moderate: { label: "Moderate", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20" },
  weak: { label: "Weak", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" },
  high: { label: "High", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" },
  low: { label: "Low", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
};

function RatingIcon({ rating }: { rating: string }) {
  if (rating === "strong" || rating === "low") return <TrendingUp className="w-3.5 h-3.5" />;
  if (rating === "weak" || rating === "high") return <TrendingDown className="w-3.5 h-3.5" />;
  return <Minus className="w-3.5 h-3.5" />;
}

interface DashCardProps {
  icon: React.ReactNode;
  title: string;
  rating: string;
  description: string;
  tags: string[];
}

function DashCard({ icon, title, rating, description, tags }: DashCardProps) {
  const cfg = RATING_CONFIG[rating.toLowerCase()] ?? RATING_CONFIG.moderate;
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
            {icon}
          </div>
          <p className="text-sm font-medium">{title}</p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${cfg.color} ${cfg.bg} ${cfg.border}`}>
          <RatingIcon rating={rating} />
          {cfg.label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="px-2 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

interface Props {
  dashboard: ReportDashboard;
}

export default function DashboardCards({ dashboard }: Props) {
  const cards: DashCardProps[] = [
    {
      icon: <DollarSign className="w-4 h-4" />,
      title: "Income Outlook",
      rating: dashboard.income_outlook,
      description: "Current planetary alignment supports income generation and new earning opportunities.",
      tags: ["Salary", "Business", "Cash Flow"],
    },
    {
      icon: <BarChart2 className="w-4 h-4" />,
      title: "Wealth Accumulation",
      rating: dashboard.wealth_accumulation,
      description: "Wealth-building indicators show favourable conditions for asset growth and retention.",
      tags: ["Assets", "Net Worth", "Savings"],
    },
    {
      icon: <TrendingUp className="w-4 h-4" />,
      title: "Investment Climate",
      rating: dashboard.investment_climate,
      description: "Market timing and planetary support for deploying capital into investments.",
      tags: ["Equities", "Mutual Funds", "Timing"],
    },
    {
      icon: <Zap className="w-4 h-4" />,
      title: "Speculation Risk",
      rating: dashboard.speculation_risk,
      description: "Planetary indicators for high-risk trades, F&O, and speculative positions.",
      tags: ["Trading", "F&O", "Crypto"],
    },
    {
      icon: <CreditCard className="w-4 h-4" />,
      title: "Expense Pressure",
      rating: dashboard.expense_pressure,
      description: "Likelihood of unexpected outflows, liabilities, or increased spending cycles.",
      tags: ["Outflows", "Liabilities", "Spending"],
    },
    {
      icon: <Activity className="w-4 h-4" />,
      title: "Volatility",
      rating: dashboard.volatility,
      description: "Overall financial turbulence and unpredictability in the current period.",
      tags: ["Stability", "Fluctuation", "Risk"],
    },
  ];

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Financial Dashboard</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => (
          <DashCard key={c.title} {...c} />
        ))}
      </div>
    </div>
  );
}
