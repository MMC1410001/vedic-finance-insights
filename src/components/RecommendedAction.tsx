import type { RecommendedAction as ActionType } from "@/lib/astro-engine";
import { Sparkles, Clock, ArrowRight } from "lucide-react";

const urgencyStyles = {
  "act-now": "border-primary/20 glow-gold",
  "plan-ahead": "border-secondary/20",
  wait: "border-warning/20",
};

const urgencyBadge = {
  "act-now": "bg-primary/10 text-primary",
  "plan-ahead": "bg-secondary/10 text-secondary",
  wait: "bg-warning/10 text-warning",
};

interface Props { action: ActionType }

const RecommendedAction = ({ action }: Props) => (
  <div className={`glass-card-glow p-5 ${urgencyStyles[action.urgency]} animate-float`}>
    <div className="flex items-center gap-2 mb-2.5">
      <Sparkles className="w-4 h-4 text-primary animate-pulse-glow" />
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Recommended Action</p>
    </div>
    <p className="text-base font-semibold text-foreground mb-2 tracking-tight">{action.action}</p>
    <div className="flex items-center gap-2 mb-2">
      <Clock className="w-3 h-3 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{action.timing}</span>
      <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ml-auto ${urgencyBadge[action.urgency]}`}>
        {action.urgency.replace("-", " ")}
      </span>
    </div>
    <p className="text-xs text-muted-foreground leading-relaxed">{action.reasoning}</p>
    <button className="mt-3 flex items-center gap-2 text-xs font-semibold text-primary hover:gap-3 transition-all duration-300">
      Learn more <ArrowRight className="w-3.5 h-3.5" />
    </button>
  </div>
);

export default RecommendedAction;
