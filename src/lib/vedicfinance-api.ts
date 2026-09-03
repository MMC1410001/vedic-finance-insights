import { supabase } from "./supabase";
import { ensureSessionId } from "./visitor-tracking";
import type { ReportRequest, ReportResponse, LuxuryAnalysisResponse, InvestmentBasketResponse } from "./vedicfinance-types";

export async function generateReport(req: ReportRequest): Promise<ReportResponse> {
  const session_id = ensureSessionId();

  const { data, error } = await supabase.functions.invoke("generate-report", {
    body: { ...req, session_id },
  });

  if (error) throw new Error(error.message);
  return data as ReportResponse;
}

export async function getLastReport(session_id: string): Promise<ReportResponse | null> {
  const { data } = await supabase
    .from("kundli_reports")
    .select("*")
    .eq("session_id", session_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  return {
    summary: {
      financial_phase: data.financial_phase,
      confidence_level: data.confidence_lvl,
      time_window: data.time_window,
      primary_insight: data.primary_insight,
    },
    scores: data.scores,
    dashboard: data.dashboard,
    timeline: data.timeline,
    reasoning: data.reasoning,
    confidence: data.confidence,
    d1_chart: data.d1_chart,
    d9_chart: data.d9_chart,
    dasha: data.dasha,
    transits: data.transits,
  } as ReportResponse;
}

// ── Fallback dummy data for demo mode ───────────────────────────────────────
export const DUMMY_REPORT: ReportResponse = {
  summary: {
    financial_phase: "Growth Phase",
    confidence_level: "high",
    time_window: "Aug 2024 – Nov 2025",
    primary_insight: "Income outlook is strong. Jupiter Mahadasha with Venus Antardasha supports financial expansion.",
  },
  scores: { natal_wealth_score:74, income_score:78, savings_score:62, investment_score:68, risk_score:55, expense_score:48, timing_score:83 },
  dashboard: { income_outlook:"strong", wealth_accumulation:"strong", investment_climate:"moderate", speculation_risk:"moderate", expense_pressure:"moderate", volatility:"moderate" },
  timeline: {
    favorable_periods: [{ start:"2025-03-31", end:"2025-11-03", reason:"Venus Antardasha activates financial houses" }],
    caution_periods:   [{ start:"2026-08-01", end:"2027-02-01", reason:"Saturn Mahadasha transition" }],
  },
  reasoning: {
    natal_analysis: "2nd lord Venus strong in Taurus; Jupiter in house 11 (Dhana yoga).",
    dasha_analysis: "Jupiter Mahadasha (2016–2032), Venus Antardasha (Aug 2024 – Nov 2025).",
    transit_analysis: "Jupiter transiting house 11 (income boost). Saturn in house 8 (timing pressure).",
  },
  confidence: { score:85, level:"high", reason:"Birth time exact" },
  d1_chart: { lagna_sign:"Aquarius", lagna_degree:14.32, planets:[], houses:[] },
  d9_chart: { lagna_sign:"Gemini",   lagna_degree:14.32, planets:[], houses:[] },
  dasha: { mahadasha:"Jupiter Mahadasha", mahadasha_lord:"Jupiter", mahadasha_start:"2016-04-10", mahadasha_end:"2032-04-10", antardasha:"Venus Antardasha", antardasha_lord:"Venus", antardasha_start:"2024-08-12", antardasha_end:"2025-11-03", next_mahadasha:"Saturn Mahadasha", next_mahadasha_start:"2032-04-10" },
  transits: [
    { planet:"Jupiter", sign:"Taurus",   degree:14.22, retrograde:false, natal_house:11, moon_house:1,  impact:"favorable" },
    { planet:"Saturn",  sign:"Aquarius", degree:22.1,  retrograde:false, natal_house:8,  moon_house:10, impact:"challenging" },
  ],
};

// ── Luxury Asset Purchase Timing ────────────────────────────────────────────

export async function generateLuxuryAnalysis(req: ReportRequest): Promise<LuxuryAnalysisResponse> {
  const { data, error } = await supabase.functions.invoke("luxury-analysis", {
    body: req,
  });
  if (error) throw new Error(error.message);
  return data as LuxuryAnalysisResponse;
}

export const DUMMY_LUXURY: LuxuryAnalysisResponse = {
  assets: {
    property: {
      asset_type: "property",
      verdict: "yes",
      overall_score: 74,
      scores: { natal: 68, dasha: 78, transit: 72, muhurta: 60 },
      summary: "Venus Antardasha activates 4th house (property). Jupiter transiting 11th house supports financial gains. 4th lord strong in own sign.",
      reasoning: {
        natal: ["4th lord Venus is strong in Taurus", "Benefic aspect on 4th house", "Fixed sign Taurus on 4th cusp (stable property)"],
        dasha: ["Antardasha lord Venus rules 4th house (direct activation)", "Mahadasha lord Jupiter in house 11 (wealth support)"],
        transit: ["Jupiter transiting Taurus (house 11) supports purchase", "Saturn in upachaya house 11: disciplined gains"],
        muhurta: ["Prefer Rohini, Uttara Phalguni nakshatras", "Avoid Rahu Kaal, Amavasya, and malefic Moon days"],
      },
      time_window: { start: "2025-04-01", end: "2025-11-03", months: 7 },
      suggested_nakshatras: ["Rohini", "Mrigashira", "Uttara Phalguni", "Anuradha", "Hasta", "Swati", "Uttara Ashadha"],
      dasha_period: "Jupiter / Venus",
    },
    vehicle: {
      asset_type: "vehicle",
      verdict: "yes",
      overall_score: 79,
      scores: { natal: 72, dasha: 82, transit: 76, muhurta: 65 },
      summary: "Venus Antardasha directly activates vehicle purchase. Venus is karaka for luxury and comforts. Jupiter transit supports gains.",
      reasoning: {
        natal: ["Karaka Venus is strong in Taurus", "4th lord strong (vehicle house)", "Benefic aspect on 4th house"],
        dasha: ["Antardasha lord Venus rules 4th house (direct activation)", "Antardasha lord Venus is karaka for vehicle", "Mahadasha lord Jupiter in house 11 (wealth support)"],
        transit: ["Jupiter transiting house 11 supports purchase", "Venus strong in transit: luxury purchases favorable"],
        muhurta: ["Prefer Friday for vehicle purchase", "Avoid Rahu Kaal, Amavasya, and malefic Moon days"],
      },
      time_window: { start: "2025-04-01", end: "2025-11-03", months: 7 },
      suggested_nakshatras: ["Rohini", "Mrigashira", "Uttara Phalguni", "Anuradha", "Hasta", "Swati", "Uttara Ashadha"],
      dasha_period: "Jupiter / Venus",
    },
    gold: {
      asset_type: "gold",
      verdict: "delay",
      overall_score: 62,
      scores: { natal: 58, dasha: 65, transit: 60, muhurta: 55 },
      summary: "Jupiter Mahadasha supports wealth but 2nd house activation is moderate. Jupiter transit in 11th supports gains but not directly 2nd house.",
      reasoning: {
        natal: ["2nd lord Jupiter in house 11 (wealth support)", "Karaka Jupiter in Capricorn (debilitated)"],
        dasha: ["Mahadasha lord Jupiter is karaka for gold", "Antardasha lord Venus in house 11 (gains)"],
        transit: ["Jupiter transiting house 11, general support", "Saturn in 8th house, uncertainty"],
        muhurta: ["Prefer Thursday for gold purchase", "Avoid Rahu Kaal, Amavasya, and malefic Moon days"],
      },
      time_window: { start: "2025-11-03", end: "2026-05-03", months: 6 },
      suggested_nakshatras: ["Rohini", "Mrigashira", "Uttara Phalguni", "Anuradha", "Hasta", "Swati", "Uttara Ashadha"],
      dasha_period: "Jupiter / Venus",
    },
    loan: {
      asset_type: "loan",
      verdict: "avoid",
      overall_score: 41,
      scores: { natal: 45, dasha: 40, transit: 38, muhurta: 50 },
      summary: "Saturn transiting 8th house creates uncertainty. Rahu influence on loans is unfavorable. Avoid large debt commitments.",
      reasoning: {
        natal: ["6th lord Moon in 4th house", "Malefic occupation in 6th house"],
        dasha: ["Mahadasha lord Jupiter provides some protection", "No direct 6th house activation in current dasha"],
        transit: ["Saturn transiting 8th house, uncertainty", "Rahu transiting 2nd house: financial pressure on loans"],
        muhurta: ["Avoid Rahu Kaal, Amavasya, and malefic Moon days", "Prefer 2nd/5th/10th/11th tithi in waxing Moon"],
      },
      time_window: { start: "2026-02-14", end: "2026-08-14", months: 6 },
      suggested_nakshatras: ["Rohini", "Mrigashira", "Uttara Phalguni", "Anuradha", "Hasta", "Swati", "Uttara Ashadha"],
      dasha_period: "Jupiter / Venus",
    },
  },
  best_asset: "vehicle",
  ranked: ["vehicle", "property", "gold", "loan"],
  current_dasha: "Jupiter Mahadasha (Venus Antardasha)",
};


// ── Investment Basket Allocation ────────────────────────────────────────────

export async function generateInvestmentBaskets(req: ReportRequest): Promise<InvestmentBasketResponse> {
  const { data, error } = await supabase.functions.invoke("investment-baskets", {
    body: req,
  });
  if (error) throw new Error(error.message);
  return data as InvestmentBasketResponse;
}

export const DUMMY_BASKETS: InvestmentBasketResponse = {
  investor_type: "Balanced",
  investor_reasons: [
    "5th lord Mercury is strong, higher risk appetite",
    "Jupiter strong in Cancer: favors long-term growth",
    "Saturn in 2nd house: prefers stability",
  ],
  baskets: {
    stocks: {
      basket_type: "stocks",
      label: "Stocks / Equity",
      icon: "📈",
      overall_score: 68,
      suitability: "highly_suitable",
      is_active: true,
      scores: { natal: 72, dasha: 65, transit: 64 },
      summary: "5th lord Mercury strong in Virgo. Mercury Antardasha activates Stocks / Equity. Jupiter transiting house 5 activates Stocks / Equity.",
      reasoning: {
        natal: ["5th lord Mercury strong in Virgo", "Karaka Mercury strong in Virgo", "Mercury in 5th house: trading aptitude"],
        dasha: ["Mercury Antardasha activates Stocks / Equity", "Antardasha lord Mercury rules 5th house"],
        transit: ["Jupiter transiting house 5 activates Stocks / Equity", "Jupiter transit favorable (general support)"],
      },
      avoid: false,
      avoid_reason: "",
    },
    mutual_funds: {
      basket_type: "mutual_funds",
      label: "Mutual Funds",
      icon: "📊",
      overall_score: 74,
      suitability: "highly_suitable",
      is_active: true,
      scores: { natal: 78, dasha: 72, transit: 68 },
      summary: "9th lord Jupiter strong in Cancer. Jupiter Mahadasha activates Mutual Funds. Jupiter transiting house 9 activates Mutual Funds.",
      reasoning: {
        natal: ["9th lord Jupiter strong in Cancer", "Karaka Jupiter strong in Cancer", "11th lord strong: gains from investments"],
        dasha: ["Jupiter Mahadasha activates Mutual Funds", "Mahadasha lord Jupiter rules 9th house"],
        transit: ["Jupiter transiting house 9 activates Mutual Funds", "Saturn transit favorable (general support)"],
      },
      avoid: false,
      avoid_reason: "",
    },
    real_estate: {
      basket_type: "real_estate",
      label: "Real Estate",
      icon: "🏠",
      overall_score: 62,
      suitability: "suitable",
      is_active: false,
      scores: { natal: 65, dasha: 58, transit: 62 },
      summary: "4th lord Mars in Capricorn (exalted). Mars Dasha not currently active. Saturn in upachaya house supports disciplined gains.",
      reasoning: {
        natal: ["4th lord Mars strong in Capricorn", "Karaka Mars strong in Capricorn", "Fixed sign Scorpio on 4th cusp, stable property"],
        dasha: ["Mahadasha lord Jupiter in house 9 (wealth support)"],
        transit: ["Saturn transit favorable (general support)"],
      },
      avoid: false,
      avoid_reason: "",
    },
    gold: {
      basket_type: "gold",
      label: "Gold / Savings",
      icon: "🥇",
      overall_score: 70,
      suitability: "highly_suitable",
      is_active: true,
      scores: { natal: 74, dasha: 68, transit: 65 },
      summary: "2nd lord Venus strong in Pisces. Jupiter Mahadasha activates Gold / Savings. Jupiter transiting house 2 activates Gold / Savings.",
      reasoning: {
        natal: ["2nd lord Venus strong in Pisces", "Karaka Jupiter strong in Cancer", "Moon strong in Taurus, wealth preservation"],
        dasha: ["Jupiter Mahadasha activates Gold / Savings", "Mahadasha lord Jupiter in house 9 (wealth support)"],
        transit: ["Jupiter transiting house 2 activates Gold / Savings"],
      },
      avoid: false,
      avoid_reason: "",
    },
    fixed_income: {
      basket_type: "fixed_income",
      label: "Fixed Income / Bonds",
      icon: "🏦",
      overall_score: 58,
      suitability: "suitable",
      is_active: false,
      scores: { natal: 60, dasha: 55, transit: 58 },
      summary: "Saturn in 2nd house: disciplined long-term holding. Jupiter Mahadasha activates Fixed Income / Bonds. Saturn transit favorable.",
      reasoning: {
        natal: ["Saturn in 2nd house: disciplined long-term holding", "Karaka Saturn strong in Libra", "Empty 5th house: low speculation tendency, suits fixed income"],
        dasha: ["Jupiter Mahadasha activates Fixed Income / Bonds"],
        transit: ["Saturn transit favorable (general support)"],
      },
      avoid: false,
      avoid_reason: "",
    },
    high_risk: {
      basket_type: "high_risk",
      label: "High Risk / Speculative",
      icon: "⚡",
      overall_score: 42,
      suitability: "moderate",
      is_active: false,
      scores: { natal: 45, dasha: 40, transit: 38 },
      summary: "Rahu not in 5th house: limited speculative drive. No strong dasha activation for high-risk instruments. Saturn transit challenging.",
      reasoning: {
        natal: ["5th lord Mercury strong in Virgo", "Karaka Rahu in 8th house: caution needed"],
        dasha: ["Mahadasha lord Jupiter in house 9 (wealth support)"],
        transit: ["Saturn transit challenging: caution for High Risk / Speculative"],
      },
      avoid: false,
      avoid_reason: "",
    },
  },
  ranked: ["mutual_funds", "gold", "stocks", "real_estate", "fixed_income", "high_risk"],
  avoided: [],
  active_baskets: ["mutual_funds", "gold", "stocks"],
  allocation: { mutual_funds: 22, gold: 20, stocks: 19, real_estate: 17, fixed_income: 14, high_risk: 8 },
  current_dasha: "Jupiter Mahadasha (Mercury Antardasha)",
  dasha_period: "Jupiter / Mercury",
};


// ── AI Chat ─────────────────────────────────────────────────────────────────

export interface ChatMessagePayload {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  birth_date: string;
  birth_time: string;
  birth_place: string;
  latitude: number;
  longitude: number;
  timezone: number;
  birth_time_accuracy: string;
  message: string;
  history: ChatMessagePayload[];
}

export interface ChatResponseData {
  reply: string;
  chart_context?: {
    scores?: Record<string, number>;
    summary?: Record<string, string>;
    dasha?: Record<string, string>;
  };
}

export async function sendChatMessage(req: ChatRequest): Promise<ChatResponseData> {
  const { data, error } = await supabase.functions.invoke("chat", {
    body: req,
  });
  if (error) throw new Error(error.message);
  return data as ChatResponseData;
}

// ── Business Decision Query ─────────────────────────────────────────────────

export interface BusinessDecisionRequest {
  question: string;
  language: "en" | "hi";
  vedic_data: Record<string, unknown>;
}

export interface BusinessDecisionResponse {
  reply: string;
}

export async function sendBusinessDecisionQuery(
  req: BusinessDecisionRequest
): Promise<BusinessDecisionResponse> {
  const { data, error } = await supabase.functions.invoke("business-decision", {
    body: req,
  });
  if (error) throw new Error(error.message);
  return data as BusinessDecisionResponse;
}

// ── Personalized Financial Summary (AI-curated 2-liner) ─────────────────────

export interface FinancialSummaryRequest {
  scores: {
    natal_wealth_score: number;
    income_score: number;
    savings_score: number;
    investment_score: number;
    risk_score: number;
    expense_score: number;
    timing_score: number;
  };
  dasha_lord: string;
  antardasha_lord: string;
  archetype_name: string;
  lagna_sign: string;
  user_name?: string;
}

export interface FinancialSummaryResponse {
  summary: string;
}

export async function generateFinancialSummary(
  req: FinancialSummaryRequest,
): Promise<FinancialSummaryResponse> {
  const { data, error } = await supabase.functions.invoke("financial-summary", {
    body: req,
  });
  if (error) throw new Error(error.message);
  return data as FinancialSummaryResponse;
}
