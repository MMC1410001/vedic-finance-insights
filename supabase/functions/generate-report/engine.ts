// Financial scoring + dasha + chart builder
import {
  ZODIAC, SIGN_LORDS, DASHA_SEQ, DASHA_YRS,
  toJulianDay, sunLongitude, moonLongitude, planetLongitude, rahuLongitude,
  lonToSign, getNakshatra, houseFromSign,
  computeAllPlanets, computeLagna,
} from "./astro.ts";

const EXALTATION: Record<string,string> = {
  Sun:"Aries", Moon:"Taurus", Mars:"Capricorn", Mercury:"Virgo",
  Jupiter:"Cancer", Venus:"Pisces", Saturn:"Libra"
};
const DEBILITATION: Record<string,string> = {
  Sun:"Libra", Moon:"Scorpio", Mars:"Cancer", Mercury:"Pisces",
  Jupiter:"Capricorn", Venus:"Virgo", Saturn:"Aries"
};
const OWN_SIGNS: Record<string,string[]> = {
  Sun:["Leo"], Moon:["Cancer"], Mars:["Aries","Scorpio"],
  Mercury:["Gemini","Virgo"], Jupiter:["Sagittarius","Pisces"],
  Venus:["Taurus","Libra"], Saturn:["Capricorn","Aquarius"]
};

function planetStrength(planet: string, sign: string): number {
  if (sign === EXALTATION[planet]) return 2;
  if ((OWN_SIGNS[planet]||[]).includes(sign)) return 1;
  if (sign === DEBILITATION[planet]) return -1;
  return 0;
}

export function buildChart(birthDate: string, birthTime: string, tz: number, lat: number = 28.6139, lon: number = 77.209) {
  const jd = toJulianDay(birthDate, birthTime, tz);

  // High-precision planetary positions via astronomy-engine
  const { positions } = computeAllPlanets(birthDate, birthTime, tz);

  // Raw sidereal longitudes for downstream use
  const rawPlanets: Record<string, number> = {};
  for (const [name, pos] of Object.entries(positions)) {
    rawPlanets[name] = pos.siderealLon;
  }

  // Proper Lagna (Ascendant) from lat/lon + local sidereal time
  const lagna = computeLagna(birthDate, birthTime, tz, lat, lon);
  const lagnaLon = lagna.siderealLon;
  const lagnaInfo = lonToSign(lagnaLon);

  const planets = Object.entries(positions).map(([name, pos]) => {
    const { sign, signNum, degree } = lonToSign(pos.siderealLon);
    const house = houseFromSign(signNum, lagnaInfo.signNum);
    const { nakshatra, lord: nakLord } = getNakshatra(pos.siderealLon);
    return {
      planet: name, sign, sign_num: signNum,
      degree: Math.round(degree * 10000) / 10000,
      house, retrograde: pos.retrograde,
      nakshatra, nakshatra_lord: nakLord,
    };
  });

  const houses = Array.from({ length: 12 }, (_, i) => {
    const signNum = (lagnaInfo.signNum + i) % 12;
    const sign = ZODIAC[signNum];
    return { house: i + 1, sign, sign_num: signNum, lord: SIGN_LORDS[sign] };
  });

  return {
    jd,
    rawPlanets,
    lagnaSignNum: lagnaInfo.signNum,
    d1: {
      lagna_sign: lagnaInfo.sign,
      lagna_degree: Math.round(lagnaInfo.degree * 10000) / 10000,
      planets,
      houses,
    },
  };
}

export function buildD9(rawPlanets: Record<string,number>, lagnaSignNum: number) {
  function navamsaSign(lon: number): number {
    const signIdx = Math.floor(lon / 30) % 12;
    const degInSign = lon % 30;
    const navNum = Math.floor(degInSign / (30/9));
    const starts = [0,9,6,3]; // fire,earth,air,water
    const elem = [0,4,8].includes(signIdx) ? 0 : [1,5,9].includes(signIdx) ? 1
               : [2,6,10].includes(signIdx) ? 2 : 3;
    return (starts[elem] + navNum) % 12;
  }

  const d9LagnaSignNum = navamsaSign(lagnaSignNum * 30 + 15);
  const planets = Object.entries(rawPlanets).map(([name, lon]) => {
    const d9SignNum = navamsaSign(lon);
    const sign = ZODIAC[d9SignNum];
    const house = houseFromSign(d9SignNum, d9LagnaSignNum);
    const { nakshatra, lord: nakLord } = getNakshatra(lon);
    const { degree } = lonToSign(lon);
    return { planet: name, sign, sign_num: d9SignNum, degree: Math.round(degree*10000)/10000,
             house, retrograde: false, nakshatra, nakshatra_lord: nakLord };
  });

  const houses = Array.from({length:12}, (_,i) => {
    const signNum = (d9LagnaSignNum + i) % 12;
    const sign = ZODIAC[signNum];
    return { house: i+1, sign, sign_num: signNum, lord: SIGN_LORDS[sign] };
  });

  return { lagna_sign: ZODIAC[d9LagnaSignNum], lagna_degree: 0, planets, houses };
}

export function computeDasha(moonLon: number, birthDate: string, birthTime: string) {
  const nakIdx = Math.floor(moonLon / (360/27)) % 27;
  const dashaLord = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"][nakIdx % 9];
  const nakSpan = 360/27;
  const nakStart = nakIdx * nakSpan;
  const elapsed = (moonLon - nakStart) / nakSpan;
  const dashaYrs = DASHA_YRS[dashaLord];
  const elapsedDays = elapsed * dashaYrs * 365.25;

  const [y,m,d] = birthDate.split("-").map(Number);
  const [h,min] = birthTime.split(":").map(Number);
  const birthMs = Date.UTC(y,m-1,d,h,min);
  const dashaStartMs = birthMs - elapsedDays * 86400000;
  const now = Date.now();

  let seqIdx = DASHA_SEQ.indexOf(dashaLord);
  let curStart = dashaStartMs;
  let mahaLord = dashaLord;

  while (true) {
    const mahaEnd = curStart + DASHA_YRS[mahaLord] * 365.25 * 86400000;
    if (mahaEnd > now) break;
    seqIdx = (seqIdx + 1) % 9;
    mahaLord = DASHA_SEQ[seqIdx];
    curStart = mahaEnd;
  }

  const mahaEnd = curStart + DASHA_YRS[mahaLord] * 365.25 * 86400000;
  const nextMahaLord = DASHA_SEQ[(seqIdx+1)%9];

  // Antardasha
  let aIdx = seqIdx;
  let aLord = mahaLord;
  let aStart = curStart;
  for (let i=0; i<9; i++) {
    const aYrs = (DASHA_YRS[mahaLord] * DASHA_YRS[aLord]) / 120;
    const aEnd = aStart + aYrs * 365.25 * 86400000;
    if (aEnd > now) break;
    aIdx = (aIdx+1)%9; aLord = DASHA_SEQ[aIdx]; aStart = aEnd;
  }
  const aYrs = (DASHA_YRS[mahaLord] * DASHA_YRS[aLord]) / 120;
  const aEnd = aStart + aYrs * 365.25 * 86400000;

  const fmt = (ms: number) => new Date(ms).toISOString().split("T")[0];
  return {
    mahadasha: `${mahaLord} Mahadasha`, mahadasha_lord: mahaLord,
    mahadasha_start: fmt(curStart), mahadasha_end: fmt(mahaEnd),
    antardasha: `${aLord} Antardasha`, antardasha_lord: aLord,
    antardasha_start: fmt(aStart), antardasha_end: fmt(aEnd),
    next_mahadasha: `${nextMahaLord} Mahadasha`, next_mahadasha_start: fmt(mahaEnd),
  };
}

export function computeTransits(rawPlanets: Record<string,number>, lagnaSignNum: number) {
  const jdNow = toJulianDay(
    new Date().toISOString().split("T")[0],
    new Date().toTimeString().slice(0,5), 0
  );
  const moonSignNum = lonToSign(rawPlanets["Moon"]).signNum;

  const IMPACT: Record<string,Record<number,string>> = {
    Jupiter: {2:"favorable",5:"favorable",9:"favorable",11:"favorable",1:"favorable",8:"challenging",12:"challenging"},
    Saturn:  {3:"favorable",6:"favorable",11:"favorable",1:"challenging",4:"challenging",8:"challenging"},
    Rahu:    {2:"favorable",11:"favorable",8:"challenging",12:"challenging"},
    Ketu:    {12:"favorable",2:"challenging",11:"challenging"},
    Mars:    {3:"favorable",6:"favorable",10:"favorable",11:"favorable",4:"challenging",8:"challenging"},
  };

  const transitPlanets = ["Jupiter","Saturn","Rahu","Mars","Sun"];
  const transits = transitPlanets.map(name => {
    const lon = name === "Sun" ? sunLongitude(jdNow)
              : name === "Rahu" ? rahuLongitude(jdNow)
              : planetLongitude(name, jdNow);
    const { sign, signNum, degree } = lonToSign(lon);
    const natalHouse = houseFromSign(signNum, lagnaSignNum);
    const moonHouse  = houseFromSign(signNum, moonSignNum);
    const impact = (IMPACT[name]||{})[natalHouse] ?? "neutral";
    return { planet: name, sign, degree: Math.round(degree*10000)/10000,
             retrograde: false, natal_house: natalHouse, moon_house: moonHouse, impact };
  });

  const rahuT = transits.find(t => t.planet === "Rahu")!;
  const ketuSignNum = (lonToSign(rahuLongitude(jdNow)).signNum + 6) % 12;
  const ketuSign = ZODIAC[ketuSignNum];
  transits.push({
    planet:"Ketu", sign: ketuSign, degree: rahuT.degree,
    retrograde: false,
    natal_house: houseFromSign(ketuSignNum, lagnaSignNum),
    moon_house:  houseFromSign(ketuSignNum, moonSignNum),
    impact: (IMPACT["Ketu"]||{})[houseFromSign(ketuSignNum, lagnaSignNum)] ?? "neutral"
  });

  return transits;
}

export function computeScores(d1: ReturnType<typeof buildChart>["d1"], dasha: ReturnType<typeof computeDasha>, transits: ReturnType<typeof computeTransits>) {
  const scores: Record<string,number> = {
    natal_wealth_score:50, income_score:50, savings_score:50,
    investment_score:50, risk_score:50, expense_score:50, timing_score:50
  };
  const log: Record<string,string[]> = Object.fromEntries(Object.keys(scores).map(k=>[k,[]]));

  const pMap = Object.fromEntries(d1.planets.map(p=>[p.planet, p]));
  const hMap = Object.fromEntries(d1.houses.map(h=>[h.house, h]));
  const ph = (name: string) => pMap[name]?.house ?? 0;
  const hl = (h: number) => hMap[h]?.lord ?? "";

  // Natal wealth
  const l2 = hl(2); const p2 = pMap[l2];
  if (p2) { const s = planetStrength(l2, p2.sign); if(s>=1){scores.natal_wealth_score+=10;log.natal_wealth_score.push(`2nd lord ${l2} strong`);} else if(s<0){scores.natal_wealth_score-=8;} }
  if ([2,5,9,11].includes(ph("Jupiter"))) { scores.natal_wealth_score+=8; log.natal_wealth_score.push(`Jupiter in house ${ph("Jupiter")}`); }
  if (ph(l2)===11) { scores.natal_wealth_score+=10; log.natal_wealth_score.push("2nd lord in 11th (Dhana yoga)"); }
  if ([2,11].includes(ph("Venus"))) { scores.natal_wealth_score+=6; log.natal_wealth_score.push(`Venus in house ${ph("Venus")}`); }

  // Income
  const l11 = hl(11); const p11 = pMap[l11];
  const beneficsIn11 = d1.planets.filter(p=>p.house===11 && ["Jupiter","Venus","Mercury","Moon"].includes(p.planet));
  if (beneficsIn11.length) { scores.income_score+=10; log.income_score.push(`Benefics in 11th: ${beneficsIn11.map(p=>p.planet).join(",")}`); }
  if (p11) { const s=planetStrength(l11,p11.sign); if(s>=1){scores.income_score+=8;} else if(s<0){scores.income_score-=6;} }
  const jupT = transits.find(t=>t.planet==="Jupiter");
  if (jupT?.natal_house===11) { scores.income_score+=12; log.income_score.push("Jupiter transiting 11th"); }

  // Savings
  const l4=hl(4); const p4=pMap[l4];
  if (p4) { const s=planetStrength(l4,p4.sign); if(s>=1){scores.savings_score+=8;} else if(s<0){scores.savings_score-=6;} }
  const moon=pMap["Moon"]; if(moon){const s=planetStrength("Moon",moon.sign); if(s>=1){scores.savings_score+=8;} else if(s<0){scores.savings_score-=6;}}
  if ([2,4].includes(ph("Saturn"))) { scores.savings_score+=6; }

  // Investment
  const l5=hl(5); const p5=pMap[l5];
  if (p5) { const s=planetStrength(l5,p5.sign); if(s>=1){scores.investment_score+=10;} else if(s<0){scores.investment_score-=8;} }
  if ([5,9].includes(ph("Jupiter"))) { scores.investment_score+=10; }
  if (jupT && [5,9].includes(jupT.natal_house)) { scores.investment_score+=8; }
  if (ph("Rahu")===5) { scores.investment_score-=8; }

  // Risk
  if (ph("Rahu")===5) { scores.risk_score+=15; log.risk_score.push("Rahu in 5th"); }
  if (ph("Mars")===8) { scores.risk_score+=10; }
  const jup=pMap["Jupiter"]; if(jup){const s=planetStrength("Jupiter",jup.sign); if(s>=1){scores.risk_score-=8;}}

  // Expense
  const malIn12 = d1.planets.filter(p=>p.house===12 && ["Saturn","Mars","Rahu","Ketu","Sun"].includes(p.planet));
  if (malIn12.length) { scores.expense_score+=10; log.expense_score.push(`Malefics in 12th: ${malIn12.map(p=>p.planet).join(",")}`); }
  const satT = transits.find(t=>t.planet==="Saturn");
  if (satT?.natal_house===12) { scores.expense_score+=8; }

  // Timing
  const mahaHouse = ph(dasha.mahadasha_lord);
  if ([2,9,11].includes(mahaHouse)) { scores.timing_score+=15; log.timing_score.push(`Mahadasha lord ${dasha.mahadasha_lord} in house ${mahaHouse}`); }
  const antarHouse = ph(dasha.antardasha_lord);
  if ([2,9,11].includes(antarHouse)) { scores.timing_score+=10; }
  if (["Jupiter","Venus","Mercury","Moon","Sun"].includes(dasha.mahadasha_lord)) { scores.timing_score+=8; }
  if (jupT?.impact==="favorable") { scores.timing_score+=10; }
  if (satT?.impact==="challenging") { scores.timing_score-=8; }

  for (const k of Object.keys(scores)) scores[k] = Math.max(0, Math.min(100, scores[k]));
  return { scores, log };
}

function label(s: number) { return s>=65?"strong":s>=45?"moderate":"weak"; }
function riskLabel(s: number) { return s>=65?"high":s>=45?"moderate":"low"; }

export function buildReport(
  d1: ReturnType<typeof buildChart>["d1"],
  d9: ReturnType<typeof buildD9>,
  dasha: ReturnType<typeof computeDasha>,
  transits: ReturnType<typeof computeTransits>,
  scores: Record<string,number>,
  log: Record<string,string[]>,
  accuracy: string
) {
  const dashboard = {
    income_outlook: label(scores.income_score),
    wealth_accumulation: label(scores.natal_wealth_score),
    investment_climate: label(scores.investment_score),
    speculation_risk: riskLabel(scores.risk_score),
    expense_pressure: riskLabel(scores.expense_score),
    volatility: riskLabel(scores.risk_score),
  };

  const natalRules = [...(log.natal_wealth_score||[]), ...(log.income_score||[])].slice(0,4);
  const natal_analysis = natalRules.length
    ? "Natal chart: " + natalRules.join("; ") + "."
    : "Balanced natal chart with no dominant wealth yogas.";

  const dasha_analysis = `Running ${dasha.mahadasha} (${dasha.mahadasha_start} to ${dasha.mahadasha_end}), `
    + `sub-period ${dasha.antardasha} (ends ${dasha.antardasha_end}). `
    + (log.timing_score||[]).slice(0,2).join(". ") + ".";

  const jupT = transits.find(t=>t.planet==="Jupiter");
  const satT = transits.find(t=>t.planet==="Saturn");
  const transit_analysis = [
    jupT ? `Jupiter in ${jupT.sign} (house ${jupT.natal_house}, ${jupT.impact})` : "",
    satT ? `Saturn in ${satT.sign} (house ${satT.natal_house}, ${satT.impact})` : "",
  ].filter(Boolean).join(". ") + ".";

  // Timeline
  const now = new Date().toISOString().split("T")[0];
  const favorable_periods = [];
  const caution_periods = [];
  if (scores.timing_score >= 60) {
    favorable_periods.push({ start: now, end: dasha.antardasha_end, reason: `${dasha.antardasha} activates financial houses` });
  } else {
    caution_periods.push({ start: now, end: dasha.antardasha_end, reason: `${dasha.antardasha} does not strongly support wealth houses` });
  }
  if (jupT?.impact==="favorable") {
    const yr = new Date(); yr.setFullYear(yr.getFullYear()+1);
    favorable_periods.push({ start: now, end: yr.toISOString().split("T")[0], reason: `Jupiter in ${jupT.sign} (house ${jupT.natal_house}) supports growth` });
  }

  // Confidence
  let confScore = 85;
  const confReasons: string[] = [];
  if (accuracy==="approximate") { confScore-=20; confReasons.push("birth time approximate"); }
  else if (accuracy==="unknown") { confScore-=35; confReasons.push("birth time unknown"); }
  const totalRules = Object.values(log).flat().length;
  if (totalRules < 4) { confScore-=10; confReasons.push("few strong combinations"); }
  confScore = Math.max(10, Math.min(100, confScore));

  const avg = Math.floor((scores.natal_wealth_score + scores.income_score + scores.timing_score)/3);
  const phase = avg>=65?"Growth Phase":avg>=45?"Consolidation Phase":"Caution Phase";

  return {
    summary: {
      financial_phase: phase,
      confidence_level: confScore>=70?"high":confScore>=45?"medium":"low",
      time_window: `${dasha.antardasha_start} to ${dasha.antardasha_end}`,
      primary_insight: `Income outlook is ${dashboard.income_outlook} and wealth accumulation is ${dashboard.wealth_accumulation}. `
        + `Speculation risk is ${dashboard.speculation_risk}. Running ${dasha.mahadasha} with ${dasha.antardasha} (ends ${dasha.antardasha_end}).`,
    },
    scores,
    dashboard,
    timeline: { favorable_periods, caution_periods },
    reasoning: { natal_analysis, dasha_analysis, transit_analysis },
    confidence: {
      score: confScore,
      level: confScore>=70?"high":confScore>=45?"medium":"low",
      reason: confReasons.length ? confReasons.join("; ") : "birth time exact and chart well-defined",
    },
    d1_chart: d1,
    d9_chart: d9,
    dasha,
    transits,
  };
}
