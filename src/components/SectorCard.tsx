import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SectorResult } from "../lib/sector-scoring-engine";
import { labelConfig } from "../pages/SectorFavorability";
import DetailedReasoningPanel from "./DetailedReasoningPanel";

interface SectorCardProps {
  result: SectorResult;
  rank: number;
  isExpanded: boolean;
  onToggle: () => void;
}

const PLANET_GLYPH: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mars: "♂", Mercury: "☿",
  Jupiter: "♃", Venus: "♀", Saturn: "♄", Rahu: "☊", Ketu: "☋",
};

const RANK_COLOR = ["#fbbf24", "#94a3b8", "#cd7f32", "#64748b"];

export default function SectorCard({ result, rank, isExpanded, onToggle }: SectorCardProps) {
  const [hovered, setHovered] = useState(false);
  const pct = result.overallScore;
  const cfg = labelConfig[result.favorabilityLabel];

  const cardStyle: React.CSSProperties = {
    background: isExpanded
      ? "rgba(139,92,246,0.06)"
      : hovered
        ? "rgba(255,255,255,0.04)"
        : "rgba(255,255,255,0.025)",
    border: isExpanded
      ? "1px solid rgba(139,92,246,0.3)"
      : hovered
        ? "1px solid rgba(255,255,255,0.12)"
        : "1px solid rgba(255,255,255,0.06)",
    borderRadius: 18,
    overflow: "hidden",
    backdropFilter: "blur(20px)",
    boxShadow: isExpanded
      ? "0 0 30px rgba(139,92,246,0.1), inset 0 1px 0 rgba(139,92,246,0.1)"
      : "0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
    transition: "all 0.2s ease",
  };

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${result.sectorName}: expand Vedic analysis`}
        style={{ width: "100%", padding: "12px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
      >
        {/* Row 1: rank · icon · name · badges · score · chevron */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Rank */}
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: RANK_COLOR[Math.min(rank - 1, 3)] ?? "#64748b",
            width: 16, flexShrink: 0, textAlign: "center",
          }}>
            {rank}
          </span>

          {/* Icon */}
          <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{result.sectorIcon}</span>

          {/* Name */}
          <span style={{
            fontSize: 13, fontWeight: 600, color: "#f1f5f9",
            flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {result.sectorName}
          </span>

          {/* Dasha badge */}
          {result.timingActivated && (
            <span style={{
              fontSize: 9, background: "rgba(139,92,246,0.15)",
              border: "1px solid rgba(139,92,246,0.4)",
              color: "#a78bfa", borderRadius: 99, padding: "2px 7px",
              fontWeight: 600, flexShrink: 0, letterSpacing: "0.04em",
            }}>
              ✦ Dasha
            </span>
          )}

          {/* Label badge */}
          <span style={{
            fontSize: 9, background: cfg.bg, border: `1px solid ${cfg.border}`,
            color: cfg.text, borderRadius: 99, padding: "2px 7px",
            fontWeight: 600, flexShrink: 0,
          }}>
            {result.favorabilityLabel}
          </span>

          {/* Score */}
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", width: 28, textAlign: "right", flexShrink: 0 }}>
            {pct}
          </span>

          {/* Chevron */}
          <ChevronDown style={{
            width: 14, height: 14, color: "rgba(148,163,184,0.4)",
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease", flexShrink: 0,
          }} />
        </div>

        {/* Score bar */}
        <div style={{ marginTop: 8, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 99,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${cfg.dot}80, ${cfg.dot})`,
            transition: "width 0.7s ease",
          }} />
        </div>

        {/* Row 3: Graha glyphs + income + bala */}
        <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {result.score.supportingPlanets.slice(0, 5).map((planet) => (
            <span key={planet} style={{
              fontSize: 10, color: "rgba(148,163,184,0.7)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 99, padding: "1px 7px",
              fontWeight: 500,
            }}>
              {PLANET_GLYPH[planet] ?? planet} {planet}
            </span>
          ))}
          {result.score.incomeSupportScore > 0 && (
            <span style={{ fontSize: 9, color: "#4ade80", fontWeight: 600, marginLeft: 2 }}>
              ₹ Dhana
            </span>
          )}
          <span style={{ fontSize: 9, color: "rgba(100,116,139,0.6)", marginLeft: "auto" }}>
            {result.confidenceScore}% bala
          </span>
        </div>

        {/* Headline */}
        <p style={{
          marginTop: 7, fontSize: 11, color: "rgba(148,163,184,0.65)",
          lineHeight: 1.5,
          display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {result.explanation.headline}
        </p>
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div style={{ borderTop: "1px solid rgba(139,92,246,0.15)", padding: "0 14px 14px" }}>
          <DetailedReasoningPanel result={result} />
        </div>
      )}
    </div>
  );
}
