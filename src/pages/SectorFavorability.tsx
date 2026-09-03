import { useState, useMemo } from "react";
import { computeSectorFavorability, deriveChartInput } from "../lib/sector-scoring-engine";
import type { FavorabilityLabel } from "../lib/sector-scoring-engine";
import type { SectorId } from "../lib/sectorMappings";
import type { BirthDetails } from "../lib/astro-engine";
import SectorCard from "../components/SectorCard";
import { SectorRadarChart } from "../components/SectorRadarChart";

export const labelConfig: Record<FavorabilityLabel, { bg: string; text: string; border: string; dot: string }> = {
  "Highly Favorable": { bg: "rgba(74,222,128,0.08)",  text: "#4ade80", border: "rgba(74,222,128,0.25)",  dot: "#4ade80" },
  "Favorable":        { bg: "rgba(251,191,36,0.08)",  text: "#fbbf24", border: "rgba(251,191,36,0.25)",  dot: "#fbbf24" },
  "Emerging":         { bg: "rgba(139,92,246,0.08)",  text: "#a78bfa", border: "rgba(139,92,246,0.25)",  dot: "#a78bfa" },
  "Neutral":          { bg: "rgba(148,163,184,0.08)", text: "#94a3b8", border: "rgba(148,163,184,0.2)",  dot: "#94a3b8" },
  "Weak":             { bg: "rgba(100,116,139,0.06)", text: "#64748b", border: "rgba(100,116,139,0.15)", dot: "#64748b" },
};

const ROLE_META = [
  { key: "primarySector",   label: "Karma Bhava",  sub: "Primary",   accent: "#fbbf24" },
  { key: "secondarySector", label: "Sahayaka",      sub: "Secondary", accent: "#a78bfa" },
  { key: "incomeSector",    label: "Dhana–Labha",   sub: "Income",    accent: "#4ade80" },
] as const;

const SectorFavorability = () => {
  const storedDetails = sessionStorage.getItem("birthDetails");
  const details: BirthDetails = storedDetails ? JSON.parse(storedDetails) : {
    name: "Cosmic User",
    dateOfBirth: "1990-01-15",
    timeOfBirth: "06:30",
    placeOfBirth: "Mumbai, India",
  };

  const [expandedId, setExpandedId] = useState<SectorId | null>(null);
  const output = useMemo(() => computeSectorFavorability(details), [details]);
  useMemo(() => deriveChartInput(details), [details]);

  return (
    <div className="min-h-screen lg:h-screen flex flex-col overflow-auto lg:overflow-hidden relative"
      style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 40%, #0a0f1a 100%)" }}>

      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", top: "20%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(251,191,36,0.07) 0%, transparent 70%)", filter: "blur(60px)" }} />
        {[...Array(20)].map((_, i) => (
          <div key={i} style={{ position: "absolute", width: i % 5 === 0 ? 2 : 1, height: i % 5 === 0 ? 2 : 1, borderRadius: "50%", background: "rgba(255,255,255,0.4)", top: `${(i * 37 + 11) % 100}%`, left: `${(i * 53 + 7) % 100}%`, opacity: 0.3 + (i % 4) * 0.15 }} />
        ))}
      </div>

      {/* ── Header ── */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
        {/* Background planet image */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img
            src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80&fm=webp"
            alt="Earth from space"
            className="absolute right-0 top-0 h-full w-1/2 object-cover object-left opacity-15"
            style={{ maskImage: "linear-gradient(to left, rgba(0,0,0,0.6), transparent)" }}
          loading="lazy" decoding="async" />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl"
            style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)" }}>
            <span style={{ fontSize: 18 }}>🔮</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Sector Favorability</h1>
            <p style={{ fontSize: 9, letterSpacing: "0.1em", color: "rgba(148,163,184,0.6)" }}>
              KARMA BHAVA · DASHAMESH · VIMSHOTTARI
            </p>
          </div>
        </div>
        {/* Summary pill */}
        <div className="hidden md:block max-w-xs" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "6px 12px" }}>
          <p style={{ color: "rgba(203,213,225,0.65)", fontSize: 10, lineHeight: 1.5, fontStyle: "italic" }} className="line-clamp-2">
            {output.summaryParagraph}
          </p>
        </div>
      </div>

      {/* ── Top cards row ── */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-2 px-3 md:px-5 pb-2 shrink-0">
        {ROLE_META.map(({ key, label, sub, accent }) => {
          const sector = output[key];
          const cfg = labelConfig[sector.favorabilityLabel];
          return (
            <div key={key} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "10px 10px 8px", textAlign: "center", backdropFilter: "blur(20px)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: `linear-gradient(90deg, transparent, ${accent}60, transparent)` }} />
              <p style={{ fontSize: 8, letterSpacing: "0.1em", color: accent, textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>{label}</p>
              <p style={{ fontSize: 20, lineHeight: 1, marginBottom: 4 }}>{sector.sectorIcon}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#f1f5f9", marginBottom: 4, lineHeight: 1.2 }}>{sector.sectorName}</p>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 99, padding: "1px 6px", fontSize: 8, color: cfg.text, fontWeight: 600 }}>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
                {sector.favorabilityLabel}
              </span>
            </div>
          );
        })}

        {/* Active / Dasha card */}
        {output.activeSector ? (
          <div style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 14, padding: "10px 10px 8px", textAlign: "center", backdropFilter: "blur(20px)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.8), transparent)" }} />
            <p style={{ fontSize: 8, letterSpacing: "0.1em", color: "#a78bfa", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>Vimshottari</p>
            <p style={{ fontSize: 20, lineHeight: 1, marginBottom: 4 }}>{output.activeSector.sectorIcon}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#c4b5fd", marginBottom: 4, lineHeight: 1.2 }}>{output.activeSector.sectorName}</p>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.4)", borderRadius: 99, padding: "1px 6px", fontSize: 8, color: "#a78bfa", fontWeight: 600 }}>✦ Dasha</span>
          </div>
        ) : (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, padding: "10px 10px 8px", textAlign: "center", opacity: 0.5 }}>
            <p style={{ fontSize: 8, letterSpacing: "0.1em", color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Vimshottari</p>
            <p style={{ fontSize: 20, lineHeight: 1, marginBottom: 4 }}>—</p>
            <p style={{ fontSize: 11, color: "#64748b" }}>No Match</p>
          </div>
        )}
      </div>

      {/* ── Main body: radar + ranked list ── */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 px-3 md:px-5 pb-4 min-h-0">

        {/* Radar */}
        <div className="flex flex-col min-h-0" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "14px 16px", backdropFilter: "blur(24px)" }}>
          <p style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(148,163,184,0.6)", textTransform: "uppercase", fontWeight: 600, marginBottom: 8, flexShrink: 0 }}>
            Graha Bala Radar
          </p>
          <div className="flex-1 min-h-0">
            <SectorRadarChart sectors={output.sectors} />
          </div>
        </div>

        {/* Ranked list — scrollable */}
        <div className="flex flex-col min-h-0">
          <p style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(148,163,184,0.6)", textTransform: "uppercase", fontWeight: 600, marginBottom: 6, flexShrink: 0 }}>
            Karma Phala: Rankings
          </p>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.3) transparent" }}>
            {output.sectors.map((sector, i) => (
              <SectorCard
                key={sector.sectorId}
                result={sector}
                rank={i + 1}
                isExpanded={expandedId === sector.sectorId}
                onToggle={() => setExpandedId(expandedId === sector.sectorId ? null : sector.sectorId)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SectorFavorability;
