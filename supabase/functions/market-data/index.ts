/**
 * market-data edge function
 * Fetches real-time quotes for Indian market indices and key instruments
 * using Alpha Vantage (free tier: 25 req/day).
 *
 * Symbols:
 *   ^NSEI   — Nifty 50
 *   ^BSESN  — BSE Sensex
 *   USDINR=X — USD/INR
 *   GC=F    — Gold Futures (USD)
 *
 * We use Yahoo Finance's unofficial v8 chart endpoint via a server-side fetch
 * (no CORS issues from Deno), which is free and requires no API key.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface Quote {
  symbol: string;
  label: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  prevClose: number | null;
  currency: string;
  marketState: string;
  error?: string;
}

const SYMBOLS: { symbol: string; label: string; currency: string }[] = [
  { symbol: "^NSEI",   label: "Nifty 50",  currency: "INR" },
  { symbol: "^BSESN",  label: "Sensex",    currency: "INR" },
  { symbol: "USDINR=X",label: "USD/INR",   currency: "INR" },
  { symbol: "GC=F",    label: "Gold",      currency: "USD" },
  { symbol: "CL=F",    label: "Crude Oil", currency: "USD" },
];

async function fetchQuote(symbol: string, label: string, currency: string): Promise<Quote> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VedicFinance/1.0)",
        "Accept": "application/json",
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error("No meta in response");

    const price = meta.regularMarketPrice ?? null;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const open = meta.regularMarketOpen ?? null;
    const high = meta.regularMarketDayHigh ?? null;
    const low = meta.regularMarketDayLow ?? null;
    const change = price != null && prevClose != null ? price - prevClose : null;
    const changePct = change != null && prevClose ? (change / prevClose) * 100 : null;
    const marketState = meta.marketState ?? "CLOSED";

    return { symbol, label, price, change, changePct, high, low, open, prevClose, currency, marketState };
  } catch (e) {
    return { symbol, label, price: null, change: null, changePct: null, high: null, low: null, open: null, prevClose: null, currency, marketState: "UNKNOWN", error: e.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const quotes = await Promise.all(
      SYMBOLS.map(s => fetchQuote(s.symbol, s.label, s.currency))
    );

    return new Response(JSON.stringify({ quotes, fetchedAt: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
