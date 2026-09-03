/**
 * BusinessDecisionQuery — Interactive decision query panel
 * User selects a decision area, describes their situation, picks language,
 * and gets a personalized Vedic timing response powered by OpenAI.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  TrendingUp, BarChart3, Zap, Activity, Layers, Send,
  Loader2, Globe, Star, ChevronDown, Info, Sparkles,
  CheckCircle2, AlertTriangle, Shield,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { BusinessTimingResult, DecisionArea } from "@/lib/business-timing-engine";
import { sendBusinessDecisionQuery } from "@/lib/vedicfinance-api";

// ─── Decision area config ─────────────────────────────────────────────────────

const DECISION_AREAS: {
  area: DecisionArea;
  icon: typeof TrendingUp;
  label: string;
  hint: string;
  examples: string[];
}[] = [
  {
    area: "Business Expansion",
    icon: TrendingUp,
    label: "Business Expansion",
    hint: "Opening new branches, entering new markets, scaling operations",
    examples: [
      "Should I open a second restaurant branch this quarter?",
      "Is this a good time to expand into the Pune market?",
      "I'm planning to hire 20 more people. Is the timing right?",
    ],
  },
  {
    area: "Large Investment",
    icon: BarChart3,
    label: "Large Investment",
    hint: "Major capital deployment, property purchase, equipment",
    examples: [
      "Should I invest ₹50L in commercial property now?",
      "Is this a good time to buy heavy machinery for my factory?",
      "Planning a large SIP increase. Should I wait?",
    ],
  },
  {
    area: "Transaction (Buy/Sell)",
    icon: Zap,
    label: "Transaction (Buy/Sell)",
    hint: "Buying or selling assets, closing deals, signing contracts",
    examples: [
      "Should I sell my equity portfolio and move to FDs?",
      "Is this a good time to sell my old office space?",
      "I have a deal closing next week. Should I proceed?",
    ],
  },
  {
    area: "Cash Flow",
    icon: Activity,
    label: "Cash Flow Management",
    hint: "Managing inflows/outflows, debt decisions, liquidity",
    examples: [
      "Should I take a business loan right now?",
      "Is this a good time to clear my outstanding debts?",
      "Should I increase my working capital reserves?",
    ],
  },
  {
    area: "Scaling vs Holding",
    icon: Layers,
    label: "Scale vs Hold",
    hint: "Strategic decision: grow aggressively or consolidate",
    examples: [
      "Should I aggressively scale my startup or conserve cash?",
      "Is this the right phase to raise funding?",
      "Should I focus on profitability or growth right now?",
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildVedicPayload(result: BusinessTimingResult, selectedArea: DecisionArea) {
  const signal = result.decisionSignals.find(s => s.area === selectedArea);
  return {
    phase: result.phase,
    action: result.action,
    intensity: result.intensity,
    overallScore: result.overallScore,
    broadTimingWindow: result.broadTimingWindow,
    dasha: {
      mahadasha: result.dashaLayer.mahadasha,
      antardasha: result.dashaLayer.antardasha,
      mahaHouses: result.dashaLayer.mahaHouses,
      antarHouses: result.dashaLayer.antarHouses,
      verdict: result.dashaLayer.verdict,
      reason: result.dashaLayer.reason,
      mahadasha_end: result.dashaLayer.mahadasha_end.toISOString(),
      antardasha_end: result.dashaLayer.antardasha_end.toISOString(),
    },
    transits: result.transitLayer.map(t => ({
      planet: t.planet,
      sign: t.sign,
      house: t.transitHouse,
      retrograde: t.isRetrograde,
      verdict: t.verdict,
      note: t.note,
      score: t.score,
    })),
    decisionSignal: signal ? {
      area: signal.area,
      signal: signal.signal,
      reason: signal.reason,
      activatingHouses: signal.activatingHouses,
    } : null,
    muhurtaToday: {
      score: result.muhurtaToday.score,
      label: result.muhurtaToday.label,
      tara: result.muhurtaToday.taraName,
      tithi: result.muhurtaToday.tithiName,
      paksha: result.muhurtaToday.paksha,
      gandanta: result.muhurtaToday.isGandanta,
      rahuKaal: result.muhurtaToday.isRahuKaal,
    },
    topMuhurtaDates: result.topMuhurtaDates.map(w => ({
      date: w.date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" }),
      score: w.score,
      label: w.label,
      tara: w.taraName,
      tithi: w.tithiName,
      paksha: w.paksha,
    })),
  };
}

const SIGNAL_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  Go:      { color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  Caution: { color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20" },
  Hold:    { color: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/20" },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  result: BusinessTimingResult;
}

export default function BusinessDecisionQuery({ result }: Props) {
  const [selectedArea, setSelectedArea] = useState<DecisionArea>("Business Expansion");
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [isLoading, setIsLoading] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const responseRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close area picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowAreaPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll to response when it appears
  useEffect(() => {
    if (aiReply && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [aiReply]);

  const currentAreaConfig = DECISION_AREAS.find(d => d.area === selectedArea)!;
  const currentSignal = result.decisionSignals.find(s => s.area === selectedArea);
  const signalStyle = currentSignal ? SIGNAL_STYLES[currentSignal.signal] : SIGNAL_STYLES.Hold;

  const handleSubmit = useCallback(async () => {
    const q = question.trim();
    if (!q || isLoading) return;

    setIsLoading(true);
    setError(null);
    setAiReply(null);

    try {
      const vedic_data = buildVedicPayload(result, selectedArea);
      const response = await sendBusinessDecisionQuery({
        question: `[Decision Area: ${selectedArea}]\n\nUser's question: ${q}`,
        language,
        vedic_data,
      });
      setAiReply(response.reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [question, selectedArea, language, result, isLoading]);

  const handleExampleClick = (example: string) => {
    setQuestion(example);
  };

  return (
    <div className="space-y-5">

      {/* ── Section Header ── */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center border border-violet-500/20">
          <Sparkles className="h-4 w-4 text-violet-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-tight">Ask Your Business Question</h2>
          <p className="text-[10px] text-muted-foreground">
            Get personalized Vedic timing advice for your specific decision
          </p>
        </div>
      </div>

      {/* ── Decision Area Selector + Language Toggle ── */}
      <div className="flex flex-col sm:flex-row gap-3">

        {/* Area selector */}
        <div className="relative flex-1" ref={pickerRef}>
          <button
            onClick={() => setShowAreaPicker(!showAreaPicker)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl glass-card border border-white/[0.08] hover:border-white/[0.15] transition-all"
          >
            <div className={`h-8 w-8 rounded-lg ${signalStyle.bg} flex items-center justify-center shrink-0`}>
              <currentAreaConfig.icon className={`h-4 w-4 ${signalStyle.color}`} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-semibold text-foreground">{currentAreaConfig.label}</p>
              <p className="text-[10px] text-muted-foreground">{currentAreaConfig.hint}</p>
            </div>
            {currentSignal && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${signalStyle.bg} ${signalStyle.color} border ${signalStyle.border}`}>
                {currentSignal.signal}
              </span>
            )}
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showAreaPicker ? "rotate-180" : ""}`} />
          </button>

          {showAreaPicker && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1.5 rounded-xl glass-card border border-white/[0.1] overflow-hidden shadow-2xl">
              {DECISION_AREAS.map((d) => {
                const sig = result.decisionSignals.find(s => s.area === d.area);
                const sStyle = sig ? SIGNAL_STYLES[sig.signal] : SIGNAL_STYLES.Hold;
                const isActive = d.area === selectedArea;
                return (
                  <button
                    key={d.area}
                    onClick={() => { setSelectedArea(d.area); setShowAreaPicker(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-white/[0.04] ${
                      isActive ? "bg-white/[0.06]" : ""
                    }`}
                  >
                    <div className={`h-7 w-7 rounded-lg ${sStyle.bg} flex items-center justify-center shrink-0`}>
                      <d.icon className={`h-3.5 w-3.5 ${sStyle.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{d.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{d.hint}</p>
                    </div>
                    {sig && (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${sStyle.bg} ${sStyle.color} shrink-0`}>
                        {sig.signal}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Language toggle */}
        <div className="flex items-center gap-1.5 glass-card border border-white/[0.08] rounded-xl px-2 py-1.5 self-start sm:self-center">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <button
            onClick={() => setLanguage("en")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              language === "en"
                ? "bg-primary/15 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLanguage("hi")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              language === "hi"
                ? "bg-primary/15 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            हिन्दी
          </button>
        </div>
      </div>

      {/* ── Current Signal Summary ── */}
      {currentSignal && (
        <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${signalStyle.border} ${signalStyle.bg}`}>
          {currentSignal.signal === "Go"
            ? <CheckCircle2 className={`h-4 w-4 ${signalStyle.color} mt-0.5 shrink-0`} />
            : currentSignal.signal === "Hold"
            ? <Shield className={`h-4 w-4 ${signalStyle.color} mt-0.5 shrink-0`} />
            : <AlertTriangle className={`h-4 w-4 ${signalStyle.color} mt-0.5 shrink-0`} />
          }
          <div>
            <p className={`text-xs font-semibold mb-0.5 ${signalStyle.color}`}>
              {currentAreaConfig.label}: {currentSignal.signal}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{currentSignal.reason}</p>
          </div>
        </div>
      )}

      {/* ── Example Questions ── */}
      <div className="flex flex-wrap gap-2">
        {currentAreaConfig.examples.map((ex) => (
          <button
            key={ex}
            onClick={() => handleExampleClick(ex)}
            className="px-3 py-1.5 rounded-full text-[10px] text-muted-foreground border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/[0.15] hover:text-foreground transition-all"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* ── Question Input ── */}
      <div className="glass-card border border-white/[0.08] rounded-xl overflow-hidden focus-within:border-primary/30 transition-colors">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={
            language === "en"
              ? "Describe your specific business decision or question..."
              : "अपना विशिष्ट व्यापार निर्णय या प्रश्न यहाँ लिखें..."
          }
          rows={3}
          className="w-full px-4 py-3.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none"
          disabled={isLoading}
        />
        <div className="flex items-center justify-between px-4 pb-3">
          <p className="text-[10px] text-muted-foreground">
            {language === "en" ? "Press Enter to send" : "भेजने के लिए Enter दबाएं"}
          </p>
          <button
            onClick={handleSubmit}
            disabled={!question.trim() || isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground text-xs font-semibold disabled:opacity-30 hover:opacity-90 transition-opacity"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {language === "en" ? "Consulting stars..." : "ग्रहों से परामर्श..."}
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                {language === "en" ? "Get Vedic Advice" : "वैदिक सलाह लें"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-400/5 border border-red-400/20">
          <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-red-400 mb-0.5">Unable to get response</p>
            <p className="text-[11px] text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* ── AI Response ── */}
      {aiReply && (
        <div ref={responseRef} className="glass-card-glow p-5 border border-primary/15 space-y-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-amber-500/20 flex items-center justify-center border border-violet-500/20">
              <Star className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                {language === "en" ? "Vedic Astrologer's Advice" : "वैदिक ज्योतिषी की सलाह"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {language === "en"
                  ? `Based on your Dasha, Transit & Muhurta for ${currentAreaConfig.label}`
                  : `आपकी दशा, गोचर और मुहूर्त के आधार पर, ${currentAreaConfig.label}`
                }
              </p>
            </div>
          </div>

          <div className="text-[13px] text-foreground/85 leading-relaxed">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="text-primary font-semibold">{children}</strong>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-foreground/80">{children}</li>,
                h3: ({ children }) => <h3 className="text-sm font-bold text-primary mt-3 mb-1.5">{children}</h3>,
                h4: ({ children }) => <h4 className="text-xs font-semibold text-primary/80 mt-2 mb-1">{children}</h4>,
              }}
            >
              {aiReply}
            </ReactMarkdown>
          </div>

          {/* Vedic data summary badges */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
            <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
              {result.dashaLayer.mahadasha}–{result.dashaLayer.antardasha} Dasha
            </span>
            {result.transitLayer.map(t => (
              <span key={t.planet} className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {t.planet} in H{t.transitHouse}
              </span>
            ))}
            <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Score: {result.overallScore}/100
            </span>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 pt-1">
            <Info className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              {language === "en"
                ? "This advice is based on strict Vedic Muhurta principles applied to your birth chart. No financial amounts or ROI are predicted. Consult a qualified astrologer for critical decisions."
                : "यह सलाह आपकी जन्म कुंडली पर लागू कड़े वैदिक मुहूर्त सिद्धांतों पर आधारित है। कोई वित्तीय राशि या ROI की भविष्यवाणी नहीं की गई है।"
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
