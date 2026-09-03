import { AlertTriangle } from "lucide-react";
import type { SectorResult } from "../lib/sector-scoring-engine";

interface DetailedReasoningPanelProps {
  result: SectorResult;
}

const SCORE_ROWS = [
  { label: "Karma Bhava",       sub: "10th house",           max: 30, key: "tenthHouseScore",    color: "#fbbf24" },
  { label: "Dashamesh",         sub: "10th lord",            max: 25, key: "tenthLordScore",     color: "#a78bfa" },
  { label: "Graha Yoga",        sub: "Conjunction",          max: 20, key: "conjunctionScore",   color: "#60a5fa" },
  { label: "Dhana–Labha",       sub: "2nd & 11th",           max: 15, key: "incomeSupportScore", color: "#4ade80" },
  { label: "Navamsa (D9)",      sub: "D9 confirmation",      max: 5,  key: "d9Score",            color: "#f472b6" },
  { label: "Vimshottari",       sub: "Mahadasha",            max: 5,  key: "dashaScore",         color: "#a78bfa" },
  { label: "Atmakaraka",        sub: "Soul karaka",          max: 5,  key: "directionalScore",   color: "#fbbf24" },
] as const;

const REASONING_ROWS = [
  { key: "tenthHouseLogic",    title: "Karma Bhava",       sub: "10th house"        },
  { key: "tenthLordLogic",     title: "Dashamesh",         sub: "10th lord"         },
  { key: "incomeSupportLogic", title: "Dhana–Labha Bhava", sub: "2nd & 11th houses" },
  { key: "d9Logic",            title: "Navamsa (D9)",      sub: "Divisional chart"  },
  { key: "dashaLogic",         title: "Vimshottari Dasha", sub: "Timing period"     },
] as const;

export default function DetailedReasoningPanel({ result }: DetailedReasoningPanelProps) {
  const { score, explanation } = result;

  return (
    <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Timing note */}
      {explanation.timingNote && (
        <div style={{
          background: "rgba(139,92,246,0.08)",
          border: "1px solid rgba(139,92,246,0.25)",
          borderRadius: 12, padding: "10px 14px",
        }}>
          <p style={{ fontSize: 11, color: "#c4b5fd", lineHeight: 1.6 }}>✦ {explanation.timingNote}</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        className="grid-cols-1 md:grid-cols-2">

        {/* Score breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(148,163,184,0.5)", textTransform: "uppercase", fontWeight: 600 }}>
            Graha Bala Breakdown
          </p>
          {SCORE_ROWS.map(({ label, sub, max, key, color }) => {
            const value = score[key];
            const pct = max > 0 ? (value / max) * 100 : 0;
            return (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <div>
                    <span style={{ fontSize: 10, color: "#cbd5e1", fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", marginLeft: 5 }}>{sub}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: pct > 0 ? color : "rgba(100,116,139,0.5)" }}>
                    {value}<span style={{ color: "rgba(100,116,139,0.4)", fontWeight: 400 }}>/{max}</span>
                  </span>
                </div>
                <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    width: `${pct}%`,
                    background: pct > 0 ? `linear-gradient(90deg, ${color}60, ${color})` : "transparent",
                    transition: "width 0.7s ease",
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Jyotish reasoning */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(148,163,184,0.5)", textTransform: "uppercase", fontWeight: 600 }}>
            Jyotish Reasoning
          </p>
          {REASONING_ROWS.map(({ key, title, sub }) => (
            <div key={key}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#e2e8f0" }}>{title}</span>
                <span style={{ fontSize: 9, color: "rgba(100,116,139,0.5)" }}>{sub}</span>
              </div>
              <p style={{ fontSize: 11, color: "rgba(148,163,184,0.65)", lineHeight: 1.55 }}>
                {explanation[key]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Opportunity themes */}
      {explanation.opportunityThemes.length > 0 && (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12, padding: "12px 14px",
        }}>
          <p style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(148,163,184,0.5)", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
            Karma Phala: Opportunity Themes
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {explanation.opportunityThemes.map((theme, i) => (
              <span key={i} style={{
                fontSize: 10, color: "rgba(167,139,250,0.85)",
                background: "rgba(139,92,246,0.08)",
                border: "1px solid rgba(139,92,246,0.2)",
                borderRadius: 99, padding: "3px 10px",
              }}>
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Risk tendency */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <AlertTriangle style={{ width: 12, height: 12, color: "#fbbf24", flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 11, color: "rgba(251,191,36,0.7)", lineHeight: 1.55 }}>
          {explanation.riskTendency}
        </p>
      </div>

      {/* Low confidence */}
      {explanation.lowConfidenceQualifier && (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10, padding: "8px 12px",
        }}>
          <p style={{ fontSize: 10, color: "rgba(100,116,139,0.7)", lineHeight: 1.5 }}>
            {explanation.lowConfidenceQualifier}
          </p>
        </div>
      )}
    </div>
  );
}
