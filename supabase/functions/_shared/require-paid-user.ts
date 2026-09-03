/**
 * Server-side caller verification for edge functions.
 *
 * The browser guards (`PaidRoute`, `chat-access.ts`) decide which React page to
 * render. They cannot stop a direct HTTP request to the function URL, which is
 * public and — with `verify_jwt = false` — was reachable with no credential at
 * all. Anything that spends money (OpenAI) or gates a paid feature must repeat
 * the check here, where the caller cannot skip it.
 *
 * Extracted from payment-status/index.ts, which already did this correctly.
 *
 * Usage — the guard returns either a ready-to-send rejection Response or the
 * verified identity, never both:
 *
 *   const gate = await requireUser(req, { requirePaid: true });
 *   if (gate.response) return gate.response;
 *   // gate.user / gate.authHeader are now trustworthy
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";

/** Mirrors CHAT_DENIAL_MESSAGE.payment in src/lib/chat-access.ts. */
const PAYMENT_REQUIRED_MESSAGE = "Payment required to access the AI Astrologer";

export interface GateResult {
  /** Non-null when the caller was rejected — return it verbatim. */
  response: Response | null;
  /** The verified Supabase user. Only set when `response` is null. */
  user: { id: string; email?: string } | null;
  /** The caller's original Authorization header, safe to forward onward. */
  authHeader: string;
}

function deny(status: number, error: string): GateResult {
  return {
    response: new Response(JSON.stringify({ error }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
    user: null,
    authHeader: "",
  };
}

/**
 * Verify the caller is signed in, and optionally that they have paid or are an
 * admin.
 *
 * @param requirePaid   true for paid-only features (the AI Astrologer). Leave
 *                      false for features behind ProtectedRoute — /business-timing
 *                      is auth-only, so demanding payment there would break it.
 * @param requireAdmin  true for admin-only functions. Checks user_profiles.is_admin
 *                      server-side; replaces the shared password that used to ship
 *                      in the client bundle.
 */
export async function requireUser(
  req: Request,
  { requirePaid = false, requireAdmin = false }:
    { requirePaid?: boolean; requireAdmin?: boolean } = {},
): Promise<GateResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return deny(401, "Missing Authorization header");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Single admin client handles both JWT verification and the profile read.
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  // A bare anon key is a syntactically valid JWT but carries no user, so
  // getUser rejects it — which is exactly what we want. Passing the anon key
  // must not count as being signed in.
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);

  if (authError || !user) {
    return deny(401, "Invalid or expired token");
  }

  if (requirePaid || requireAdmin) {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("has_paid, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return deny(500, "Could not verify account status");
    }

    // Admin first: an admin without a payment should still reach admin tools.
    if (requireAdmin && !profile?.is_admin) {
      return deny(403, "Admin access required");
    }

    if (requirePaid && !profile?.has_paid) {
      return deny(402, PAYMENT_REQUIRED_MESSAGE);
    }
  }

  return { response: null, user, authHeader };
}
