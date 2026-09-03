// Calls the existing generate-report edge function to get real chart data
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getReport(body: Record<string, unknown>, authHeader: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

  // Previously this fell back to `Bearer ${supabaseKey}` when the caller sent no
  // Authorization header — i.e. a missing credential was silently upgraded to
  // service-role. Callers must forward a real header; every client path does,
  // because supabase.functions.invoke always attaches one.
  if (!authHeader) {
    throw new Error("getReport called without an Authorization header");
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/generate-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader,
      "apikey": supabaseKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`generate-report failed (${res.status}): ${text}`);
  }

  return await res.json();
}
