// Investment Bonds Cosmic Engine
// Maps financial instruments to planetary essences and generates synastry data

export type InvestmentType = 'gold' | 'mf' | 'silver' | 'trading';

export interface InvestmentBond {
  id: InvestmentType;
  name: string;
  symbol: string;
  planetaryEssence: string[];
  icon: string;
  color: string;
  colorHsl: string;
}

export interface AspectData {
  aspect: string;
  type: 'conjunction' | 'trine' | 'sextile' | 'square' | 'opposition';
  strength: number; // 0-100
  label: 'Strongest' | 'Supportive' | 'Growth' | 'Challenge' | 'Tension';
  description: string;
}

export interface BondAnalysis {
  investment: InvestmentBond;
  overallScore: number;
  aspects: AspectData[];
  radarScores: {
    strength: number;
    stability: number;
    growth: number;
    risk: number; // inverted: higher = less risk = better
    harmony: number;
  };
  insight: string;
  advice: string;
  signal: 'buy' | 'hold' | 'sell';
  signalReason: string;
}

export const investments: InvestmentBond[] = [
  {
    id: 'gold',
    name: 'Gold',
    symbol: 'Au',
    planetaryEssence: ['Sun', 'Venus'],
    icon: '☀️',
    color: 'from-amber-400 to-yellow-600',
    colorHsl: '43 90% 55%',
  },
  {
    id: 'silver',
    name: 'Silver',
    symbol: 'Ag',
    planetaryEssence: ['Moon'],
    icon: '🌙',
    color: 'from-slate-300 to-slate-500',
    colorHsl: '220 15% 70%',
  },
  {
    id: 'mf',
    name: 'Mutual Funds',
    symbol: 'MF',
    planetaryEssence: ['Jupiter'],
    icon: '♃',
    color: 'from-indigo-400 to-purple-600',
    colorHsl: '239 70% 60%',
  },
  {
    id: 'trading',
    name: 'Trading',
    symbol: 'Tr',
    planetaryEssence: ['Mars', 'Mercury'],
    icon: '⚡',
    color: 'from-red-400 to-orange-600',
    colorHsl: '15 80% 55%',
  },
];

const aspectPool: Omit<AspectData, 'strength'>[] = [
  { aspect: 'Moon Conjunct Descendant', type: 'conjunction', label: 'Strongest', description: 'Deep emotional alignment with this asset energy: destiny-level bond.' },
  { aspect: 'Venus Trine Jupiter', type: 'trine', label: 'Supportive', description: 'Natural flow of abundance and value appreciation over time.' },
  { aspect: 'Sun Sextile Mercury', type: 'sextile', label: 'Growth', description: 'Intellectual clarity meets financial intuition: smart timing ahead.' },
  { aspect: 'Saturn Opposing Mars', type: 'opposition', label: 'Challenge', description: 'Discipline vs. impulse: caution needed during volatile phases.' },
  { aspect: 'Mars Square Uranus', type: 'square', label: 'Tension', description: 'Sudden shifts possible: avoid leveraged positions in this window.' },
  { aspect: 'Jupiter Conjunct Midheaven', type: 'conjunction', label: 'Strongest', description: 'Peak expansion energy: career gains flow into this asset class.' },
  { aspect: 'Venus Sextile Neptune', type: 'sextile', label: 'Growth', description: 'Creative wealth building: unconventional strategies favored.' },
  { aspect: 'Moon Trine Pluto', type: 'trine', label: 'Supportive', description: 'Transformative emotional clarity around money management.' },
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

export function generateBondAnalysis(investmentId: InvestmentType, birthDateSeed?: string): BondAnalysis {
  const investment = investments.find(i => i.id === investmentId)!;
  const seed = (birthDateSeed || 'default').split('').reduce((a, c) => a + c.charCodeAt(0), 0) + investmentId.charCodeAt(0) * 100;
  const rng = seededRandom(seed);

  const numAspects = 3 + Math.floor(rng() * 3);
  const shuffled = [...aspectPool].sort(() => rng() - 0.5).slice(0, numAspects);
  const aspects: AspectData[] = shuffled.map(a => ({
    ...a,
    strength: Math.round(40 + rng() * 55),
  })).sort((a, b) => b.strength - a.strength);

  const baseScores = {
    gold: { strength: 88, stability: 92, growth: 72, risk: 85, harmony: 90 },
    silver: { strength: 74, stability: 78, growth: 68, risk: 76, harmony: 72 },
    mf: { strength: 80, stability: 85, growth: 82, risk: 70, harmony: 78 },
    trading: { strength: 65, stability: 45, growth: 88, risk: 40, harmony: 55 },
  };

  const base = baseScores[investmentId];
  const radarScores = {
    strength: Math.min(100, Math.round(base.strength + (rng() - 0.5) * 10)),
    stability: Math.min(100, Math.round(base.stability + (rng() - 0.5) * 10)),
    growth: Math.min(100, Math.round(base.growth + (rng() - 0.5) * 10)),
    risk: Math.min(100, Math.round(base.risk + (rng() - 0.5) * 10)),
    harmony: Math.min(100, Math.round(base.harmony + (rng() - 0.5) * 10)),
  };

  const overallScore = Math.round(
    (radarScores.strength + radarScores.stability + radarScores.growth + radarScores.risk + radarScores.harmony) / 5
  );

  const insights: Record<InvestmentType, string> = {
    gold: "Your Venus trine Gold's solar energy indicates strong wealth accumulation potential. The Moon's conjunction with the Descendant suggests an intuitive bond with precious metals.",
    silver: "Your Moon harmonizes with Silver's lunar essence: emotional intuition guides your timing perfectly. Trust the cycles.",
    mf: "Jupiter's benevolent aspect on your wealth houses aligns beautifully with Mutual Funds' expansive nature. Steady growth is written in your stars.",
    trading: "Mars and Mercury fuel your Trading bond with quick reflexes, but Saturn's opposition demands discipline. Channel the fire wisely.",
  };

  const advices: Record<InvestmentType, string> = {
    gold: "Accumulate during Venus transits through your 2nd house. Current phase strongly supports gold investments.",
    silver: "Follow lunar cycles for entry points: New Moon phases favor silver accumulation this quarter.",
    mf: "SIP continuation recommended. Jupiter's current transit amplifies compounding energy through Q3.",
    trading: "Reduce position sizes during Mars retrograde. Focus on swing trades over intraday until Mercury stabilizes.",
  };

  const signals: Record<InvestmentType, 'buy' | 'hold' | 'sell'> = {
    gold: 'buy',
    silver: 'hold',
    mf: 'buy',
    trading: 'hold',
  };

  const signalReasons: Record<InvestmentType, string> = {
    gold: "Venus enters your 2nd house next week, optimal accumulation window",
    silver: "Moon phase neutral: wait for New Moon entry point",
    mf: "Jupiter direct motion supports continued SIP investments",
    trading: "Mars approaching retrograde, reduce exposure gradually",
  };

  return {
    investment,
    overallScore,
    aspects,
    radarScores,
    insight: insights[investmentId],
    advice: advices[investmentId],
    signal: signals[investmentId],
    signalReason: signalReasons[investmentId],
  };
}

export function generateAllBonds(birthDateSeed?: string): BondAnalysis[] {
  return investments.map(inv => generateBondAnalysis(inv.id, birthDateSeed));
}

// Synastry chart zodiac positions (for visual rendering)
export const zodiacSigns = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

export const zodiacSymbols: Record<string, string> = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋',
  Leo: '♌', Virgo: '♍', Libra: '♎', Scorpio: '♏',
  Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
};
