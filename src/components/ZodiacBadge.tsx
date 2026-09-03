import { getZodiacSymbol } from "@/lib/astro-engine";

interface ZodiacBadgeProps {
  label: string;
  sign: string;
  variant?: "cyan" | "magenta" | "purple";
}

const variantClasses = {
  cyan: "border-primary/30 text-primary glow-gold",
  magenta: "border-secondary/30 text-secondary glow-purple",
  purple: "border-secondary/30 text-secondary",
};

const ZodiacBadge = ({ label, sign, variant = "cyan" }: ZodiacBadgeProps) => (
  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-muted/30 backdrop-blur-sm ${variantClasses[variant]} transition-all duration-300 hover:scale-105`}>
    <span className="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center text-sm">
      {getZodiacSymbol(sign)}
    </span>
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{sign}</span>
    </div>
  </div>
);

export default ZodiacBadge;
