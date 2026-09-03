import type { PredictorCard } from "@/lib/astro-engine";
import { TrendingUp, Gift, Wallet, AlertTriangle } from "lucide-react";

const icons = { salary: TrendingUp, bonus: Gift, income: Wallet };

const impactStyles = {
  favorable: "border-favorable/20",
  neutral: "border-secondary/20",
  challenging: "border-warning/20",
};

const impactBadge = {
  favorable: "bg-favorable/10 text-favorable",
  neutral: "bg-secondary/10 text-secondary",
  challenging: "bg-warning/10 text-warning",
};

interface PredictorCardsProps { cards: PredictorCard[] }

const PredictorCards = ({ cards }: PredictorCardsProps) => (
  <div className="space-y-3">
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Salary & Bonus Predictions</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {cards.map((card, i) => {
        const Icon = card.impact === "challenging" ? AlertTriangle : icons[card.category];
        return (
          <div key={i} className={`glass-card p-4 transition-all duration-200 hover:-translate-y-0.5 ${impactStyles[card.impact]}`}>
            <div className="flex items-start justify-between mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-muted/40 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-xs">{card.title}</h3>
                  <p className="text-[10px] text-muted-foreground">{card.dateRange}</p>
                </div>
              </div>
              <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${impactBadge[card.impact]}`}>
                {card.impact}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-2.5">{card.reasoning}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-muted/40 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${card.confidence}%`,
                    background: card.impact === "challenging"
                      ? "linear-gradient(90deg, hsl(32,90%,55%), hsl(0,72%,51%))"
                      : "linear-gradient(90deg, hsl(43,72%,52%), hsl(170,75%,45%))",
                  }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">{card.confidence}%</span>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default PredictorCards;
