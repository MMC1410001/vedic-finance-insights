import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const STEPS = [
  "Calculating planetary positions…",
  "Analyzing financial houses…",
  "Evaluating Dasha & transits…",
  "Scoring wealth indicators…",
  "Building your Financial Kundli…",
];

export default function LoadingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
      setProgress((p) => Math.min(p + 20, 95));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4">
      {/* Animated orb */}
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <div className="absolute inset-2 rounded-full bg-primary/30 animate-pulse" />
        <div className="absolute inset-4 rounded-full bg-primary/50 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
      </div>

      <div className="text-center space-y-2 max-w-xs">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Financial Kundli</p>
        <p className="text-base font-medium tracking-tight transition-all duration-500">
          {STEPS[currentStep]}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-2">
          <span>Analyzing</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-2 w-full max-w-xs">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`flex items-center gap-2 text-xs transition-all duration-300 ${
              i < currentStep
                ? "text-primary"
                : i === currentStep
                ? "text-foreground"
                : "text-muted-foreground/40"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                i < currentStep ? "bg-primary" : i === currentStep ? "bg-primary animate-pulse" : "bg-white/10"
              }`}
            />
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
