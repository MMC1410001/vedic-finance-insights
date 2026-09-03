import type { TransitPlanet } from "@/lib/vedicfinance-types";

const IMPACT_CONFIG = {
  favorable: { label: "Favorable", color: "text-emerald-400", dot: "bg-emerald-400" },
  neutral: { label: "Neutral", color: "text-muted-foreground", dot: "bg-muted-foreground" },
  challenging: { label: "Challenging", color: "text-red-400", dot: "bg-red-400" },
};

const PLANET_EMOJI: Record<string, string> = {
  Sun: "☀️",
  Moon: "🌙",
  Mercury: "☿️",
  Venus: "♀️",
  Mars: "♂️",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  Pluto: "♇",
  Rahu: "☊",
  Ketu: "☋",
  Ascendant: "⬆️",
};

interface Props {
  transits: TransitPlanet[];
}

export default function TransitSnapshot({ transits }: Props) {
  return (
    <div className="glass-card p-5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Current Transits</p>
      <div className="space-y-2">
        {transits.map((t) => {
          const cfg = IMPACT_CONFIG[t.impact];
          return (
            <div key={t.planet} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-base flex-shrink-0 bg-white/[0.06] border border-white/10 ${cfg.dot.replace('bg-', 'shadow-[0_0_8px_-2px_var(--tw-shadow-color)] shadow-')}`}>
                  {PLANET_EMOJI[t.planet] ?? "⭐"}
                </div>
                <div>
                  <span className="text-sm font-medium">{t.planet}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {t.sign} {t.degree.toFixed(1)}°{t.retrograde ? " ℞" : ""}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>H{t.natal_house}</span>
                <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
