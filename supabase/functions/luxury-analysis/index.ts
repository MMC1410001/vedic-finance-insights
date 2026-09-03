import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getReport } from "../_shared/get-report.ts";
import {
  type ChartData, type DashaInfo, type Transit,
  getPlanet, houseLord, planetHouse,
  planetStrength, hasBeneficAspect, hasMaleficInHouse, clamp,
} from "../_shared/vedic-helpers.ts";

const ASSET_HOUSES: Record<string, number[]> = {
  property: [4], vehicle: [4], gold: [2], loan: [6],
};
const SUPPORT = new Set([2, 9, 11]);
const EXPENSE = new Set([6, 8, 12]);
const KARAKAS: Record<string, string[]> = {
  property: ["Mars", "Moon"], vehicle: ["Venus"],
  gold: ["Jupiter"], loan: ["Jupiter"],
};
const NAK = [
  "Rohini", "Mrigashira", "Uttara Phalguni",
  "Anuradha", "Hasta", "Swati", "Uttara Ashadha",
];
const FIXED = ["Taurus", "Leo", "Scorpio", "Aquarius"];
const RED: Record<string, string[]> = {
  property: ["Rahu", "Saturn"], vehicle: ["Ketu"],
  gold: ["Mercury"], loan: ["Rahu", "Saturn"],
};

function natalS(d1: ChartData, a: string): [number, string[]] {
  let s = 50; const r: string[] = [];
  for (const h of ASSET_HOUSES[a]) {
    const lord = houseLord(d1, h);
    const p = getPlanet(d1.planets, lord);
    if (p) {
      const st = planetStrength(lord, p.sign);
      if (st >= 1) { s += 15; r.push(`${h}th lord ${lord} is strong in ${p.sign}`); }
      else if (st === -1) { s -= 12; r.push(`${h}th lord ${lord} debilitated in ${p.sign}`); }
    }
    if (hasMaleficInHouse(d1, h)) { s -= 8; r.push(`Malefic in ${h}th house`); }
    if (hasBeneficAspect(d1, h)) { s += 8; r.push(`Benefic aspect on ${h}th house`); }
  }
  for (const k of KARAKAS[a]) {
    const p = getPlanet(d1.planets, k);
    if (p) {
      const st = planetStrength(k, p.sign);
      if (st >= 1) { s += 10; r.push(`Karaka ${k} strong in ${p.sign}`); }
      else if (st === -1) { s -= 8; r.push(`Karaka ${k} debilitated in ${p.sign}`); }
    }
  }
  if (a === "property") {
    const h4 = d1.houses.find(x => x.house === 4);
    if (h4 && FIXED.includes(h4.sign)) { s += 6; r.push(`Fixed sign ${h4.sign} on 4th cusp`); }
  }
  for (const h of [2, 11]) {
    const lord = houseLord(d1, h);
    const p = getPlanet(d1.planets, lord);
    if (p && planetStrength(lord, p.sign) >= 1) { s += 5; r.push(`${h}th lord ${lord} strong`); }
  }
  return [clamp(s), r];
}

function dashaS(d1: ChartData, da: DashaInfo, a: string): [number, string[]] {
  let s = 50; const r: string[] = [];
  const ml = da.mahadasha_lord, al = da.antardasha_lord;
  const mh = planetHouse(d1, ml);
  for (const h of ASSET_HOUSES[a]) {
    if (houseLord(d1, h) === ml) { s += 18; r.push(`Mahadasha lord ${ml} rules ${h}th house`); }
  }
  if (SUPPORT.has(mh)) { s += 12; r.push(`Mahadasha lord ${ml} in house ${mh} (wealth)`); }
  else if (EXPENSE.has(mh)) { s -= 10; r.push(`Mahadasha lord ${ml} in house ${mh} (expense)`); }
  if (KARAKAS[a].includes(ml)) { s += 10; r.push(`Mahadasha lord ${ml} is karaka for ${a}`); }
  for (const h of ASSET_HOUSES[a]) {
    if (houseLord(d1, h) === al) { s += 12; r.push(`Antardasha lord ${al} rules ${h}th house`); }
  }
  const ah = planetHouse(d1, al);
  if (SUPPORT.has(ah)) { s += 8; r.push(`Antardasha lord ${al} in house ${ah} (gains)`); }
  if (KARAKAS[a].includes(al)) { s += 6; r.push(`Antardasha lord ${al} is karaka for ${a}`); }
  if ((RED[a] ?? []).includes(ml)) { s -= 15; r.push(`Mahadasha lord ${ml} red flag for ${a}`); }
  if ((RED[a] ?? []).includes(al)) { s -= 10; r.push(`Antardasha lord ${al} red flag for ${a}`); }
  if (a === "loan") {
    const l6 = houseLord(d1, 6);
    if (ml === l6 || al === l6) { s += 8; r.push(`6th lord ${l6} activated (debt period)`); }
  }
  return [clamp(s), r];
}

function transitS(d1: ChartData, tr: Transit[], a: string): [number, string[]] {
  let s = 50; const r: string[] = [];
  const jup = tr.find(t => t.planet === "Jupiter");
  const sat = tr.find(t => t.planet === "Saturn");
  if (jup) {
    if ([4,2,11,9].includes(jup.natal_house)) { s += 15; r.push(`Jupiter transiting ${jup.sign} (house ${jup.natal_house}) supports purchase`); }
    else if ([1,5].includes(jup.natal_house)) { s += 8; r.push(`Jupiter in house ${jup.natal_house}, general support`); }
    if (jup.impact === "favorable") s += 5;
  }
  if (sat) {
    if (sat.natal_house === 4) { s -= 12; r.push("Saturn transiting 4th, delay"); }
    else if (sat.natal_house === 2) { s -= 10; r.push("Saturn transiting 2nd, pressure"); }
    else if (sat.natal_house === 8) { s -= 8; r.push("Saturn transiting 8th, uncertainty"); }
    else if ([3,6,11].includes(sat.natal_house)) { s += 6; r.push(`Saturn in upachaya ${sat.natal_house}`); }
  }
  if (a === "gold" && jup?.natal_house === 2) { s += 8; r.push("Jupiter over 2nd: gold supported"); }
  if (a === "loan") {
    const rahu = tr.find(t => t.planet === "Rahu");
    if (rahu && [6,8,12].includes(rahu.natal_house)) { s -= 10; r.push(`Rahu in ${rahu.natal_house}, loan risk`); }
    if (sat && [6,8].includes(sat.natal_house)) { s -= 8; r.push(`Saturn in ${sat.natal_house}, loan burden`); }
  }
  return [clamp(s), r];
}

function muhurta(d1: ChartData, a: string): [number, string[], string[]] {
  let s = 50; const r: string[] = [];
  const moon = getPlanet(d1.planets, "Moon");
  if (moon && NAK.includes(moon.nakshatra)) { s += 10; r.push(`Moon in ${moon.nakshatra}`); }
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const wd: Record<string, number|null> = { property:null, vehicle:4, gold:3, loan:null };
  if (wd[a] !== null) r.push(`Prefer ${days[wd[a]!]} for ${a}`);
  r.push("Avoid Rahu Kaal, Amavasya"); r.push("Prefer waxing Moon tithis");
  return [clamp(s), r, [...NAK]];
}

function verdict(sc: number) { return sc >= 70 ? "yes" : sc >= 50 ? "delay" : "avoid"; }

function timeWin(da: DashaInfo, ov: number) {
  const now = Date.now();
  let ae: number; try { ae = new Date(da.antardasha_end).getTime(); } catch { ae = now + 180*864e5; }
  let st: number, en: number;
  if (ov >= 60) { st = now; const cap = now + 365*864e5; en = ae < cap ? ae : cap; }
  else { st = ae; en = ae + 180*864e5; }
  const m = Math.max(1, Math.floor((en - st) / (30*864e5)));
  return { start: new Date(st).toISOString().slice(0,10), end: new Date(en).toISOString().slice(0,10), months: m };
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

    const types = ["property", "vehicle", "gold", "loan"] as const;
    const results: Record<string, unknown> = {};
    for (const a of types) {
      const [ns, nr] = natalS(d1, a);
      const [ds, dr] = dashaS(d1, da, a);
      const [ts, tr] = transitS(d1, transits, a);
      const [ms, mr, naks] = muhurta(d1, a);
      const ov = clamp(Math.round(ds * 0.50 + ts * 0.30 + ns * 0.15 + ms * 0.05));
      const parts = [dr[0], tr[0], nr[0]].filter(Boolean);
      results[a] = {
        asset_type: a, verdict: verdict(ov), overall_score: ov,
        scores: { natal: ns, dasha: ds, transit: ts, muhurta: ms },
        summary: parts.slice(0, 3).join(". ") + (parts.length ? "." : "Analysis pending."),
        reasoning: { natal: nr, dasha: dr, transit: tr, muhurta: mr },
        time_window: timeWin(da, ov), suggested_nakshatras: naks,
        dasha_period: `${da.mahadasha_lord} / ${da.antardasha_lord}`,
      };
    }
    const ranked = Object.values(results).sort((a: any, b: any) => b.overall_score - a.overall_score);
    return new Response(JSON.stringify({
      assets: results,
      best_asset: (ranked[0] as any)?.asset_type ?? "property",
      ranked: ranked.map((r: any) => r.asset_type),
      current_dasha: `${da.mahadasha} (${da.antardasha})`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ detail: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
