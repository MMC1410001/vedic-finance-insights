import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { createCheckoutSession } from "../_shared/zoho.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Verify JWT ────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Single admin client for both JWT verification and all DB operations.
    // auth.getUser(jwt) validates the token server-side — no anon-key client needed.
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: authError } =
      await supabaseAdmin.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Build idempotency key + run DB lookups in parallel ────────────────
    // SHA-256 of user_id + "kundali" + minute_bucket
    const minuteBucket = Math.floor(Date.now() / 60_000).toString();
    const rawKey = `${user.id}:kundali:${minuteBucket}`;
    const keyBytes = new TextEncoder().encode(rawKey);

    // Start all three async operations concurrently:
    //   a) SHA-256 hash (CPU)
    //   b) user_profiles.has_paid lookup (DB read)
    // The idempotency key lookup (c) needs the hash result, so it follows.
    const [hashBuffer, profileResult] = await Promise.all([
      crypto.subtle.digest("SHA-256", keyBytes),
      supabaseAdmin
        .from("user_profiles")
        .select("has_paid")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    // ── 3. Short-circuit if already paid ─────────────────────────────────────
    if (profileResult.data?.has_paid) {
      return new Response(
        JSON.stringify({ already_paid: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const idempotencyKey = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // ── 4. Check for existing pending order with this idempotency key ─────────
    const { data: existingOrder } = await supabaseAdmin
      .from("payment_orders")
      .select("order_id, zoho_session_id, amount, currency")
      .eq("idempotency_key", idempotencyKey)
      .eq("status", "pending")
      .maybeSingle();

    if (existingOrder?.zoho_session_id) {
      return new Response(
        JSON.stringify({
          orderId: existingOrder.order_id,
          paymentSessionId: existingOrder.zoho_session_id,
          amount: Number(existingOrder.amount).toFixed(2),
          currency: existingOrder.currency,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 5. Create new order row ───────────────────────────────────────────────
    const orderId = `ORD-${crypto.randomUUID()}`;
    const amount = 99;
    const currency = "INR";

    const { error: insertError } = await supabaseAdmin
      .from("payment_orders")
      .insert({
        order_id: orderId,
        user_id: user.id,
        amount,
        currency,
        status: "pending",
        idempotency_key: idempotencyKey,
      });

    if (insertError) {
      // Unique constraint on idempotency_key — a concurrent request beat us
      if (
        insertError.code === "23505" &&
        insertError.message?.includes("idempotency_key")
      ) {
        const { data: raceOrder } = await supabaseAdmin
          .from("payment_orders")
          .select("order_id, zoho_session_id, amount, currency")
          .eq("idempotency_key", idempotencyKey)
          .eq("status", "pending")
          .maybeSingle();

        if (raceOrder?.zoho_session_id) {
          return new Response(
            JSON.stringify({
              orderId: raceOrder.order_id,
              paymentSessionId: raceOrder.zoho_session_id,
              amount: Number(raceOrder.amount).toFixed(2),
              currency: raceOrder.currency,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      throw new Error(`Failed to insert order: ${insertError.message}`);
    }

    // ── 6. Create Zoho checkout session ───────────────────────────────────────
    const zohoSession = await createCheckoutSession({
      orderId,
      amount,
      currency,
      description: "VedicFinance Financial Kundali: Lifetime Access",
    });

    console.log("Zoho session response:", JSON.stringify(zohoSession));

    // Zoho returns: { payments_session: { payments_session_id: "...", url: "..." } }
    const paymentsSession = (zohoSession as Record<string, unknown>)
      .payments_session as Record<string, unknown> | undefined;

    const sessionId =
      (paymentsSession?.payments_session_id as string) ||
      (paymentsSession?.payment_session_id as string) ||
      (paymentsSession?.session_id as string) ||
      zohoSession.payments_session_id ||
      zohoSession.session_id ||
      zohoSession.payment_session_id ||
      ((zohoSession.data as Record<string, unknown>)?.payments_session_id as string) ||
      "";

    // ── 7. Persist Zoho session ID ────────────────────────────────────────────
    await supabaseAdmin
      .from("payment_orders")
      .update({ zoho_session_id: sessionId })
      .eq("order_id", orderId);

    // ── 8. Return ─────────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        orderId,
        paymentSessionId: sessionId,
        amount: amount.toFixed(2),
        currency,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("create-payment-order error:", message, err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
