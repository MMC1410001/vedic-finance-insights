/**
 * Market data fetcher — calls the market-data Supabase Edge Function.
 * Caches result for 5 minutes to avoid hammering the function.
 */

export interface MarketQuote {
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

export interface MarketData {
  quotes: MarketQuote[];
  fetchedAt: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cache: { data: MarketData; ts: number } | null = null;

export async function fetchMarketData(): Promise<MarketData> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.data;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/market-data`, {
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) throw new Error(`market-data fetch failed: ${res.status}`);
  const data: MarketData = await res.json();
  cache = { data, ts: Date.now() };
  return data;
}
