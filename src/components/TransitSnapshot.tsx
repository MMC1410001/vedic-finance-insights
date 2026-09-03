import type { TransitInfo } from "@/lib/astro-engine";
import { getZodiacSymbol } from "@/lib/astro-engine";

const impactDot = {
  favorable: "bg-favorable",
  neutral: "bg-secondary",
  challenging: "bg-warning",
};

const impactText = {
  favorable: "text-favorable",
  neutral: "text-secondary",
  challenging: "text-warning",
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

interface TransitSnapshotProps { transits: TransitInfo[] }

const TransitSnapshot = ({ transits }: TransitSnapshotProps) => (
  <div className="glass-card p-5">
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Current Transits</p>
    <p className="text-sm font-semibold tracking-tight mb-4">Active Planetary Positions</p>
    <div className="space-y-2">
      {transits.map((t, i) => (
        <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
          <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-lg shrink-0">
            {PLANET_EMOJI[t.planet] ?? getZodiacSymbol(t.sign)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-foreground">{t.planet}</span>
              <span className="text-[10px] text-muted-foreground">in {t.sign} • H{t.house}</span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>
          </div>
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${impactDot[t.impact]}`} />
            <span className={`text-[10px] font-medium capitalize ${impactText[t.impact]}`}>{t.impact}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default TransitSnapshot;
