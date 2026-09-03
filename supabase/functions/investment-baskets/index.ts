import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getReport } from "../_shared/get-report.ts";
import {
  type ChartData, type DashaInfo, type Transit,
  getPlanet, houseLord, planetHouse, planetsInHouse,
  planetStrength, hasBeneficAspect, clamp, MALEFICS,
} from "../_shared/vedic-helpers.ts";

const BH: Record<string,number[]> = { stocks:[5], mutual_funds:[5,9,11], real_estate:[4], gold:[2], fixed_income:[2], high_risk:[5] };
const BK: Record<string,string[]> = { stocks:["Mercury","Rahu"], mutual_funds:["Jupiter","Mercury"], real_estate:["Mars","Saturn"], gold:["Jupiter","Moon"], fixed_income:["Saturn","Jupiter"], high_risk:["Rahu","Mars"] };
const BS: Record<string,string[]> = { stocks:["Jupiter"], mutual_funds:["Venus"], real_estate:["Moon","Venus"], gold:["Venus","Sun"], fixed_income:["Moon"], high_risk:["Mercury"] };
const DA: Record<string,string[]> = { stocks:["Mercury","Rahu","Jupiter"], mutual_funds:["Jupiter","Mercury","Venus"], real_estate:["Mars","Saturn","Moon"], gold:["Jupiter","Venus","Moon"], fixed_income:["Saturn","Jupiter","Moon"], high_risk:["Rahu","Mars","Mercury"] };
const TR: Record<string,Record<string,number[]>> = {
  Jupiter:{stocks:[5,11],mutual_funds:[5,9,11],real_estate:[4,11],gold:[2,9],fixed_income:[2,11],high_risk:[5]},
  Saturn:{stocks:[],mutual_funds:[11],real_estate:[4,11],gold:[2],fixed_income:[2,3,11],high_risk:[]},
  Rahu:{stocks:[5,11],mutual_funds:[],real_estate:[],gold:[],fixed_income:[],high_risk:[5,11]},
};
const LBL: Record<string,string> = { stocks:"Stocks / Equity", mutual_funds:"Mutual Funds", real_estate:"Real Estate", gold:"Gold / Savings", fixed_income:"Fixed Income / Bonds", high_risk:"High Risk / Speculative" };
const ICO: Record<string,string> = { stocks:"📈", mutual_funds:"📊", real_estate:"🏠", gold:"🥇", fixed_income:"🏦", high_risk:"⚡" };

function investorType(d1: ChartData): [string, string[]] {
  let s = 50; const r: string[] = [];
  const l5 = houseLord(d1, 5); const p5 = getPlanet(d1.planets, l5);
  if (p5) { const st = planetStrength(l5, p5.sign); if (st >= 1) { s += 12; r.push(`5th lord ${l5} strong, higher risk appetite`); } else if (st === -1) { s -= 10; r.push(`5th lord ${l5} debilitated, lower risk tolerance`); } }
  if (planetHouse(d1, "Rahu") === 5) { s += 15; r.push("Rahu in 5th, speculative nature"); }
  const mh = planetHouse(d1, "Mars"); if ([1,5].includes(mh)) { s += 10; r.push(`Mars in ${mh}${mh===1?"st":"th"}, bold risk-taker`); }
  const sat = getPlanet(d1.planets, "Saturn");
  if (sat) { if (planetStrength("Saturn", sat.sign) >= 1) { s -= 12; r.push(`Saturn strong in ${sat.sign}, conservative`); } const sh = planetHouse(d1, "Saturn"); if ([2,4].includes(sh)) { s -= 8; r.push(`Saturn in ${sh}${sh===2?"nd":"th"}, prefers stability`); } }
  const jup = getPlanet(d1.planets, "Jupiter"); if (jup && planetStrength("Jupiter", jup.sign) >= 1) { s -= 6; r.push(`Jupiter strong, long-term growth`); }
  const m5 = planetsInHouse(d1, 5).filter(p => MALEFICS.has(p)); if (m5.length > 1) { s += 8; r.push("Multiple malefics in 5th, high-risk tendency"); }
  s = clamp(s);
  return [s >= 65 ? "Aggressive" : s >= 40 ? "Balanced" : "Conservative", r];
}

function natalB(d1: ChartData, b: string): [number, string[]] {
  let s = 50; const r: string[] = [];
  for (const h of BH[b]) {
    const lord = houseLord(d1, h); const p = getPlanet(d1.planets, lord);
    if (p) { const st = planetStrength(lord, p.sign); if (st >= 1) { s += 12; r.push(`${h}th lord ${lord} strong in ${p.sign}`); } else if (st === -1) { s -= 10; r.push(`${h}th lord ${lord} debilitated`); } }
    if (hasBeneficAspect(d1, h)) { s += 6; r.push(`Benefic aspect on ${h}th house`); }
    if (["gold","fixed_income"].includes(b) && planetsInHouse(d1, h).some(p => MALEFICS.has(p))) { s -= 6; r.push(`Malefic in ${h}th, instability for ${LBL[b]}`); }
  }
  for (const k of BK[b]) { const p = getPlanet(d1.planets, k); if (p) { const st = planetStrength(k, p.sign); if (st >= 1) { s += 10; r.push(`Karaka ${k} strong in ${p.sign}`); } else if (st === -1) { s -= 8; r.push(`Karaka ${k} debilitated`); } } }
  for (const sp of BS[b]) { if ([2,5,9,11].includes(planetHouse(d1, sp))) { s += 5; r.push(`${sp} in house ${planetHouse(d1, sp)} supports ${LBL[b]}`); } }
  if (["stocks","high_risk"].includes(b)) { if (planetHouse(d1, "Rahu") === 5) { s += 8; r.push("Rahu in 5th: speculative favored"); } const mh = planetHouse(d1, "Mercury"); if ([2,5,11].includes(mh)) { s += 6; r.push(`Mercury in ${mh}th: trading aptitude`); } }
  if (b === "real_estate") { if (planetHouse(d1, "Mars") === 4) { s += 10; r.push("Mars in 4th, strong real estate"); } const h4 = d1.houses.find(x => x.house === 4); if (h4 && ["Taurus","Leo","Scorpio","Aquarius"].includes(h4.sign)) { s += 5; r.push(`Fixed sign ${h4.sign} on 4th cusp`); } }
  if (b === "gold") { if (planetHouse(d1, "Jupiter") === 2) { s += 10; r.push("Jupiter in 2nd, gold indicator"); } const moon = getPlanet(d1.planets, "Moon"); if (moon && planetStrength("Moon", moon.sign) >= 1) { s += 6; r.push(`Moon strong, wealth preservation`); } }
  if (b === "fixed_income") { const sh = planetHouse(d1, "Saturn"); if ([2,4,11].includes(sh)) { s += 8; r.push(`Saturn in ${sh}th: disciplined holding`); } if (planetsInHouse(d1, 5).length === 0) { s += 5; r.push("Empty 5th: suits fixed income"); } }
  const l9 = houseLord(d1, 9); const p9 = getPlanet(d1.planets, l9); if (p9 && planetStrength(l9, p9.sign) >= 1) { s += 4; r.push(`9th lord ${l9} strong, luck`); }
  const l11 = houseLord(d1, 11); const p11 = getPlanet(d1.planets, l11); if (p11 && planetStrength(l11, p11.sign) >= 1) { s += 4; r.push(`11th lord ${l11} strong: gains`); }
  return [clamp(s), r];
}

function dashaB(d1: ChartData, da: DashaInfo, b: string): [number, string[]] {
  let s = 50; const r: string[] = [];
  const ml = da.mahadasha_lord, al = da.antardasha_lord;
  if (DA[b].includes(ml)) { s += 15; r.push(`${ml} Mahadasha activates ${LBL[b]}`); }
  if (DA[b].includes(al)) { s += 10; r.push(`${al} Antardasha activates ${LBL[b]}`); }
  for (const h of BH[b]) { if (houseLord(d1, h) === ml) { s += 12; r.push(`Mahadasha lord ${ml} rules ${h}th house`); } if (houseLord(d1, h) === al) { s += 8; r.push(`Antardasha lord ${al} rules ${h}th house`); } }
  const mh = planetHouse(d1, ml); if ([2,9,11].includes(mh)) { s += 6; r.push(`Mahadasha lord in house ${mh} (wealth)`); } if ([6,8,12].includes(mh)) { s -= 8; r.push(`Mahadasha lord in house ${mh} (expense)`); }
  return [clamp(s), r];
}

function transitB(transits: Transit[], b: string): [number, string[]] {
  let s = 50; const r: string[] = [];
  for (const t of transits) {
    const rules = TR[t.planet]?.[b] ?? [];
    if (rules.includes(t.natal_house)) { s += 10; r.push(`${t.planet} transiting house ${t.natal_house} activates ${LBL[b]}`); }
    else if (t.impact === "favorable" && ["Jupiter","Saturn"].includes(t.planet)) { s += 4; r.push(`${t.planet} transit favorable`); }
    else if (t.impact === "challenging" && ["Saturn","Rahu"].includes(t.planet)) { s -= 6; r.push(`${t.planet} transit challenging, caution for ${LBL[b]}`); }
  }
  return [clamp(s), r];
}

function shouldAvoid(ns: number, ds: number, it: string, b: string): [boolean, string] {
  if (ns < 35 && ds < 40) return [true, "Weak natal and dasha support"];
  if (it === "Conservative" && ["high_risk","stocks"].includes(b) && ns < 50) return [true, "Conservative profile with weak speculative houses"];
  if (it === "Aggressive" && b === "fixed_income" && ns < 45) return [true, "Aggressive profile: fixed income not suited"];
  return [false, ""];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const auth = req.headers.get("Authorization") ?? "";
    const report = await getReport(body, auth);
    const d1: ChartData = report.d1_chart;
    const da: DashaInfo = report.dasha;
    const transits: Transit[] = report.transits;

    const [it, ir] = investorType(d1);
    const baskets = ["stocks","mutual_funds","real_estate","gold","fixed_income","high_risk"];
    const results: Record<string, any> = {};

    for (const b of baskets) {
      const [ns, nr] = natalB(d1, b);
      const [ds, dr] = dashaB(d1, da, b);
      const [ts, tr] = transitB(transits, b);
      const ov = clamp(Math.round(ns * 0.40 + ds * 0.35 + ts * 0.25));
      const [av, avr] = shouldAvoid(ns, ds, it, b);
      const suit = av ? "avoid" : ov >= 65 ? "highly_suitable" : ov >= 50 ? "suitable" : ov >= 40 ? "moderate" : "low";
      const active = ds >= 55 && ts >= 50;
      const parts = [nr[0], dr[0], tr[0]].filter(Boolean);
      results[b] = {
        basket_type: b, label: LBL[b], icon: ICO[b],
        overall_score: ov, suitability: suit, is_active: active,
        scores: { natal: ns, dasha: ds, transit: ts },
        summary: parts.slice(0, 3).join(". ") + (parts.length ? "." : "Analysis pending."),
        reasoning: { natal: nr, dasha: dr, transit: tr },
        avoid: av, avoid_reason: avr,
      };
    }

    const all = Object.values(results).sort((a, b) => b.overall_score - a.overall_score);
    const ranked = all.filter(r => !r.avoid).map(r => r.basket_type);
    const avoided = all.filter(r => r.avoid).map(r => r.basket_type);
    const actives = all.filter(r => r.is_active).map(r => r.basket_type);

    const nonAv = all.filter(r => !r.avoid);
    const total = nonAv.reduce((s, r) => s + r.overall_score, 0) || 1;
    const alloc: Record<string, number> = {};
    for (const r of nonAv) alloc[r.basket_type] = Math.round((r.overall_score / total) * 100);
    const diff = 100 - Object.values(alloc).reduce((a, b) => a + b, 0);
    if (ranked.length && diff !== 0) alloc[ranked[0]] += diff;

    return new Response(JSON.stringify({
      investor_type: it, investor_reasons: ir, baskets: results,
      ranked, avoided, active_baskets: actives, allocation: alloc,
      current_dasha: `${da.mahadasha} (${da.antardasha})`,
      dasha_period: `${da.mahadasha_lord} / ${da.antardasha_lord}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ detail: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
