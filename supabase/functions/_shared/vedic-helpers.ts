// Shared Vedic astrology helpers

export interface Planet { planet: string; sign: string; sign_num: number; degree: number; house: number; retrograde: boolean; nakshatra: string; nakshatra_lord: string; }
export interface House { house: number; sign: string; sign_num: number; lord: string; }
export interface ChartData { lagna_sign: string; lagna_degree: number; planets: Planet[]; houses: House[]; }
export interface DashaInfo { mahadasha: string; mahadasha_lord: string; mahadasha_start: string; mahadasha_end: string; antardasha: string; antardasha_lord: string; antardasha_start: string; antardasha_end: string; next_mahadasha: string; next_mahadasha_start: string; }
export interface Transit { planet: string; sign: string; degree: number; retrograde: boolean; natal_house: number; moon_house: number; impact: string; }

const EXALTATION: Record<string, string> = { Sun:"Aries", Moon:"Taurus", Mars:"Capricorn", Mercury:"Virgo", Jupiter:"Cancer", Venus:"Pisces", Saturn:"Libra", Rahu:"Gemini", Ketu:"Sagittarius" };
const DEBILITATION: Record<string, string> = { Sun:"Libra", Moon:"Scorpio", Mars:"Cancer", Mercury:"Pisces", Jupiter:"Capricorn", Venus:"Virgo", Saturn:"Aries", Rahu:"Sagittarius", Ketu:"Gemini" };
const OWN_SIGNS: Record<string, string[]> = { Sun:["Leo"], Moon:["Cancer"], Mars:["Aries","Scorpio"], Mercury:["Gemini","Virgo"], Jupiter:["Sagittarius","Pisces"], Venus:["Taurus","Libra"], Saturn:["Capricorn","Aquarius"], Rahu:[], Ketu:[] };

export const MALEFICS = new Set(["Saturn","Mars","Rahu","Ketu"]);

export function getPlanet(planets: Planet[], name: string): Planet | undefined { return planets.find(p => p.planet === name); }
export function houseLord(chart: ChartData, h: number): string { return chart.houses.find(x => x.house === h)?.lord ?? ""; }
export function planetHouse(chart: ChartData, name: string): number { return getPlanet(chart.planets, name)?.house ?? 0; }
export function planetsInHouse(chart: ChartData, h: number): string[] { return chart.planets.filter(p => p.house === h).map(p => p.planet); }

export function planetStrength(name: string, sign: string): number {
  if (sign === EXALTATION[name]) return 2;
  if ((OWN_SIGNS[name] ?? []).includes(sign)) return 1;
  if (sign === DEBILITATION[name]) return -1;
  return 0;
}

export function hasBeneficAspect(chart: ChartData, h: number): boolean {
  for (const n of ["Jupiter","Venus"]) {
    const ph = planetHouse(chart, n);
    if (ph === 0) continue;
    if ([0,4,7,10].includes(Math.abs(ph - h))) return true;
  }
  return false;
}

export function hasMaleficInHouse(chart: ChartData, h: number): boolean {
  return planetsInHouse(chart, h).some(p => MALEFICS.has(p));
}

export function clamp(v: number): number { return Math.max(0, Math.min(100, v)); }
