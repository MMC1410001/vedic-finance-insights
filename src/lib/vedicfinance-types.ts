// VedicFinance – Financial Kundli Analyzer types

export interface ReportRequest {
  full_name?: string;
  birth_date: string;
  birth_time: string;
  birth_place: string;
  latitude: number;
  longitude: number;
  timezone: number;
  birth_time_accuracy: "exact" | "approximate" | "unknown";
}

export interface ReportSummary {
  financial_phase: string;
  confidence_level: string;
  time_window: string;
  primary_insight: string;
}

export interface ReportScores {
  natal_wealth_score: number;
  income_score: number;
  savings_score: number;
  investment_score: number;
  risk_score: number;
  expense_score: number;
  timing_score: number;
}

export interface ReportDashboard {
  income_outlook: string;
  wealth_accumulation: string;
  investment_climate: string;
  speculation_risk: string;
  expense_pressure: string;
  volatility: string;
}

export interface TimelinePeriod {
  start: string;
  end: string;
  reason: string;
}

export interface ReportTimeline {
  favorable_periods: TimelinePeriod[];
  caution_periods: TimelinePeriod[];
}

export interface ReportReasoning {
  natal_analysis: string;
  dasha_analysis: string;
  transit_analysis: string;
}

export interface ReportConfidence {
  score: number;
  level: string;
  reason: string;
}

export interface PlanetData {
  planet: string;
  sign: string;
  sign_num: number;
  degree: number;
  house: number;
  retrograde: boolean;
  nakshatra: string;
  nakshatra_lord: string;
}

export interface HouseData {
  house: number;
  sign: string;
  sign_num: number;
  lord: string;
}

export interface ChartData {
  lagna_sign: string;
  lagna_degree: number;
  planets: PlanetData[];
  houses: HouseData[];
}

export interface DashaInfo {
  mahadasha: string;
  mahadasha_lord: string;
  mahadasha_start: string;
  mahadasha_end: string;
  antardasha: string;
  antardasha_lord: string;
  antardasha_start: string;
  antardasha_end: string;
  next_mahadasha: string;
  next_mahadasha_start: string;
}

export interface TransitPlanet {
  planet: string;
  sign: string;
  degree: number;
  retrograde: boolean;
  natal_house: number;
  moon_house: number;
  impact: "favorable" | "neutral" | "challenging";
}

export interface ReportResponse {
  summary: ReportSummary;
  scores: ReportScores;
  dashboard: ReportDashboard;
  timeline: ReportTimeline;
  reasoning: ReportReasoning;
  confidence: ReportConfidence;
  d1_chart: ChartData;
  d9_chart: ChartData;
  dasha: DashaInfo;
  transits: TransitPlanet[];
}

// ── Luxury Asset Purchase Timing Types ──────────────────────────────────────

export type AssetType = "property" | "vehicle" | "gold" | "loan";
export type AssetVerdict = "yes" | "delay" | "avoid";

export interface AssetScores {
  natal: number;
  dasha: number;
  transit: number;
  muhurta: number;
}

export interface AssetReasoning {
  natal: string[];
  dasha: string[];
  transit: string[];
  muhurta: string[];
}

export interface AssetTimeWindow {
  start: string;
  end: string;
  months: number;
}

export interface AssetAnalysis {
  asset_type: AssetType;
  verdict: AssetVerdict;
  overall_score: number;
  scores: AssetScores;
  summary: string;
  reasoning: AssetReasoning;
  time_window: AssetTimeWindow;
  suggested_nakshatras: string[];
  dasha_period: string;
}

export interface LuxuryAnalysisResponse {
  assets: Record<AssetType, AssetAnalysis>;
  best_asset: AssetType;
  ranked: AssetType[];
  current_dasha: string;
}

// ── Investment Basket Types ─────────────────────────────────────────────────

export type BasketType = "stocks" | "mutual_funds" | "real_estate" | "gold" | "fixed_income" | "high_risk";
export type BasketSuitability = "highly_suitable" | "suitable" | "moderate" | "low" | "avoid";

export interface BasketScores {
  natal: number;
  dasha: number;
  transit: number;
}

export interface BasketReasoning {
  natal: string[];
  dasha: string[];
  transit: string[];
}

export interface BasketAnalysis {
  basket_type: BasketType;
  label: string;
  icon: string;
  overall_score: number;
  suitability: BasketSuitability;
  is_active: boolean;
  scores: BasketScores;
  summary: string;
  reasoning: BasketReasoning;
  avoid: boolean;
  avoid_reason: string;
}

export interface InvestmentBasketResponse {
  investor_type: string;
  investor_reasons: string[];
  baskets: Record<BasketType, BasketAnalysis>;
  ranked: BasketType[];
  avoided: BasketType[];
  active_baskets: BasketType[];
  allocation: Record<BasketType, number>;
  current_dasha: string;
  dasha_period: string;
}
