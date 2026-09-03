/**
 * JobVsBusinessSection — "Job vs Business" analysis card.
 *
 * Visual comparison of employment vs entrepreneurship potential
 * based on Vedic chart analysis. Features:
 * - Animated tug-of-war bar showing Job vs Business score
 * - Verdict badge (Job / Business / Hybrid)
 * - Strengths & risks for each path
 * - Best business type, partnership advice, transition timing
 * - Key planet influence chips
 */

import { motion } from "framer-motion";
import {
  Briefcase,
  Rocket,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Handshake,
  Clock,
  Sparkles,
  TrendingUp,
  Building2,
} from "lucide-react";
import InsightInfoTooltip from "@/components/kundali/InsightInfoTooltip";
import type { JobVsBusinessInsight } from "@/lib/financial-kundali-engine";

interface Props {
  data: JobVsBusinessInsight | null;
}

/* ── Verdict config ── */
const VERDICT_CONFIG = {
  Job: {
    label: "Job Favored",
    emoji: "💼",
    gradient: "linear-gradient(135deg, #2FBF9F, #4FD1C5)",
    glow: "rgba(47,191,159,0.3)",
    color: "#4FD1C5",
  },
  Business: {
    label: "Business Favored",
    emoji: "🚀",
    gradient: "linear-gradient(135deg, #F2C572, #FFDFA3)",
    glow: "rgba(242,197,114,0.3)",
    color: "#F2C572",
  },
  Hybrid: {
    label: "Hybrid Path",
    emoji: "⚡",
    gradient: "linear-gradient(135deg, #C8A2FF, #E06BAA)",
    glow: "rgba(200,162,255,0.3)",
    color: "#C8A2FF",
  },
};

/* ── Planet emoji map ── */
const PLANET_EMOJI: Record<string, string> = {
  Sun: "☀️", Moon: "🌙", Mars: "♂️", Mercury: "☿️", Jupiter: "♃",
  Venus: "♀️", Saturn: "♄", Rahu: "🐍", Ketu: "🔮",
};

export default function JobVsBusinessSection({ data }: Props) {
  if (!data) return null;

  const vc = VERDICT_CONFIG[data.verdict];
  const jobPercent = Math.round((data.jobScore / (data.jobScore + data.businessScore)) * 100);
  const bizPercent = 100 - jobPercent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(242,197,114,0.12)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* ── Header ── */}
      <div className="px-5 sm:px-7 pt-6 sm:pt-8 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(242,197,114,0.12)", border: "1px solid rgba(242,197,114,0.18)" }}
          >
            <Briefcase className="h-4.5 w-4.5" style={{ color: "#F2C572" }} />
          </div>
          <h3
            className="font-bold"
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "clamp(17px, 2.5vw, 22px)",
              color: "#F5E9FF",
            }}
          >
            Job vs Business
          </h3>
          <InsightInfoTooltip explanation="Analysis based on your 6th house (service), 7th house (business partnerships), 10th house (career authority), and 3rd house (entrepreneurial courage). Dasha and transit influences are factored in." />
        </div>
        <p className="text-xs sm:text-sm mt-1" style={{ color: "#A89BC8" }}>
          Should you climb the corporate ladder or build your own empire?
        </p>
      </div>

      <div className="px-5 sm:px-7 pb-6 sm:pb-8 space-y-5">
        {/* ── Verdict Badge ── */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex items-center justify-center"
        >
          <div
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full"
            style={{
              background: vc.gradient,
              boxShadow: `0 8px 32px ${vc.glow}`,
            }}
          >
            <span className="text-lg">{vc.emoji}</span>
            <span
              className="text-sm font-bold uppercase tracking-wider"
              style={{ color: "#2A0E4A" }}
            >
              {vc.label}
            </span>
          </div>
        </motion.div>

        {/* ── Tug-of-War Bar ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" style={{ color: "#4FD1C5" }} />
              <span style={{ color: "#4FD1C5" }}>Job: {data.jobScore}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ color: "#F2C572" }}>Business: {data.businessScore}</span>
              <Rocket className="h-3.5 w-3.5" style={{ color: "#F2C572" }} />
            </div>
          </div>
          <div
            className="relative h-3 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${jobPercent}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
              className="absolute left-0 top-0 bottom-0 rounded-l-full"
              style={{
                background: "linear-gradient(90deg, #2FBF9F, #4FD1C5)",
                boxShadow: "0 0 12px rgba(47,191,159,0.4)",
              }}
            />
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${bizPercent}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
              className="absolute right-0 top-0 bottom-0 rounded-r-full"
              style={{
                background: "linear-gradient(90deg, #F2C572, #FFDFA3)",
                boxShadow: "0 0 12px rgba(242,197,114,0.4)",
              }}
            />
          </div>
        </div>

        {/* ── Summary ── */}
        <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "#D6C6F5" }}>
          {data.summary}
        </p>

        {/* ── Two-Column: Strengths & Risks ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Job Column */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "rgba(47,191,159,0.05)",
              border: "1px solid rgba(47,191,159,0.12)",
            }}
          >
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" style={{ color: "#4FD1C5" }} />
              <span className="text-sm font-semibold" style={{ color: "#4FD1C5" }}>
                Job / Employment
              </span>
            </div>
            <div className="space-y-1.5">
              {data.jobStrengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "#2FBF9F" }} />
                  <span className="text-xs leading-relaxed" style={{ color: "#D6C6F5" }}>{s}</span>
                </div>
              ))}
            </div>
            <div className="pt-1.5 border-t" style={{ borderColor: "rgba(47,191,159,0.1)" }}>
              {data.jobRisks.map((r, i) => (
                <div key={i} className="flex items-start gap-2 mt-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "rgba(224,107,170,0.7)" }} />
                  <span className="text-xs leading-relaxed" style={{ color: "#A89BC8" }}>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Business Column */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "rgba(242,197,114,0.05)",
              border: "1px solid rgba(242,197,114,0.12)",
            }}
          >
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4" style={{ color: "#F2C572" }} />
              <span className="text-sm font-semibold" style={{ color: "#F2C572" }}>
                Business / Entrepreneurship
              </span>
            </div>
            <div className="space-y-1.5">
              {data.businessStrengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "#F2C572" }} />
                  <span className="text-xs leading-relaxed" style={{ color: "#D6C6F5" }}>{s}</span>
                </div>
              ))}
            </div>
            <div className="pt-1.5 border-t" style={{ borderColor: "rgba(242,197,114,0.1)" }}>
              {data.businessRisks.map((r, i) => (
                <div key={i} className="flex items-start gap-2 mt-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "rgba(224,107,170,0.7)" }} />
                  <span className="text-xs leading-relaxed" style={{ color: "#A89BC8" }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom Info Row: Business Type + Partnership + Transition ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Best Business Type */}
          <div
            className="rounded-xl p-3.5 space-y-1.5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" style={{ color: "#F2C572" }} />
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#A89BC8" }}>
                Best Business Type
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#D6C6F5" }}>
              {data.bestBusinessType}
            </p>
          </div>

          {/* Partnership Advice */}
          <div
            className="rounded-xl p-3.5 space-y-1.5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-1.5">
              <Handshake className="h-3.5 w-3.5" style={{ color: "#C8A2FF" }} />
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#A89BC8" }}>
                Partnership
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#D6C6F5" }}>
              {data.partnershipAdvice}
            </p>
          </div>

          {/* Transition Timing */}
          <div
            className="rounded-xl p-3.5 space-y-1.5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" style={{ color: "#2FBF9F" }} />
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#A89BC8" }}>
                Best Transition Window
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#D6C6F5" }}>
              {data.idealTransitionPeriod}
            </p>
          </div>
        </div>

        {/* ── Key Planet Chips ── */}
        <div className="flex flex-wrap gap-2 pt-1">
          {data.keyPlanets.map((kp) => (
            <div
              key={kp.planet}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium"
              style={{
                background: kp.influence === "supports"
                  ? "rgba(47,191,159,0.08)"
                  : "rgba(224,107,170,0.08)",
                border: `1px solid ${kp.influence === "supports" ? "rgba(47,191,159,0.18)" : "rgba(224,107,170,0.18)"}`,
                color: kp.influence === "supports" ? "#4FD1C5" : "#E06BAA",
              }}
            >
              <span>{PLANET_EMOJI[kp.planet] ?? "⭐"}</span>
              <span>{kp.planet}</span>
              <span style={{ color: "#A89BC8" }}>·</span>
              <span style={{ color: "#A89BC8" }}>{kp.role}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
