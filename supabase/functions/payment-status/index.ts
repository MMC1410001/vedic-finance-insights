import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getPaymentSessionStatus } from "../_shared/zoho.ts";

// How long to wait before falling back to a direct Zoho API status check.
// During this window we rely entirely on the webhook — no outbound Zoho calls.
// Set to 12 s: covers the first several fast polls without hitting Zoho at all.
const ZOHO_SYNC_GRACE_MS = 12_000;

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

    // Single admin client handles both JWT verification and DB access.
    // supabase-js admin client's auth.getUser(jwt) validates the token
    // server-side without an extra anon-key client round-trip.
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

    // ── 2. Extract orderId ───────────────────────────────────────────────────
    let orderId = "";
    if (req.method === "GET") {
      orderId = new URL(req.url).searchParams.get("orderId") || "";
    } else {
      try {
        orderId = (await req.json()).orderId || "";
      } catch {
        // empty body
      }
    }

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Missing orderId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Load order from DB ────────────────────────────────────────────────
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("payment_orders")
      .select("order_id, status, zoho_session_id, zoho_payment_id, user_id, amount, created_at")
      .eq("order_id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Terminal states — return immediately, no Zoho call needed ─────────
    const terminalStatuses = ["completed", "failed", "expired", "amount_mismatch"];
    if (terminalStatuses.includes(order.status)) {
      return new Response(
        JSON.stringify({
          orderId: order.order_id,
          status: order.status === "amount_mismatch" ? "failed" : order.status,
          zohoPaymentId: order.zoho_payment_id || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 5. Pending — conditionally sync with Zoho ────────────────────────────
    // Only call the Zoho API after the grace period has elapsed.
    // Early polls rely on the webhook arriving; the Zoho call is a fallback
    // for when the webhook is delayed or missed. This eliminates the outbound
    // HTTP fetch on all the fast initial polls and reduces Zoho API load.
    if (order.status === "pending" && order.zoho_session_id) {
      const orderAgeMs = Date.now() - new Date(order.created_at).getTime();
      const pastGracePeriod = orderAgeMs > ZOHO_SYNC_GRACE_MS;

      if (pastGracePeriod) {
        try {
          const zohoStatus = await getPaymentSessionStatus(order.zoho_session_id);
          const zohoState = (zohoStatus.status || "").toLowerCase();

          if (
            zohoState === "completed" ||
            zohoState === "succeeded" ||
            zohoState === "paid" ||
            zohoState === "success"
          ) {
            const paymentId = zohoStatus.payment_id || "";
            const paidAmount = parseFloat(
              (zohoStatus as Record<string, unknown>).amount as string || "0"
            );
            const expectedAmount = parseFloat(order.amount);

            // Reject on amount mismatch
            if (paidAmount > 0 && Math.abs(paidAmount - expectedAmount) > 0.01) {
              console.error(
                `payment-status: AMOUNT MISMATCH for ${orderId}. ` +
                `Expected ${expectedAmount}, got ${paidAmount}. Rejecting.`
              );

              await supabaseAdmin
                .from("payment_orders")
                .update({ status: "amount_mismatch", zoho_payment_id: paymentId })
                .eq("order_id", orderId);

              return new Response(
                JSON.stringify({ orderId: order.order_id, status: "failed", zohoPaymentId: paymentId }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }

            // Grant access
            await supabaseAdmin
              .from("payment_orders")
              .update({ status: "completed", zoho_payment_id: paymentId })
              .eq("order_id", orderId);

            await supabaseAdmin
              .from("user_profiles")
              .update({ has_paid: true })
              .eq("id", user.id);

            return new Response(
              JSON.stringify({ orderId: order.order_id, status: "completed", zohoPaymentId: paymentId }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (
            zohoState === "failed" ||
            zohoState === "cancelled" ||
            zohoState === "expired"
          ) {
            await supabaseAdmin
              .from("payment_orders")
              .update({ status: "failed" })
              .eq("order_id", orderId);

            return new Response(
              JSON.stringify({ orderId: order.order_id, status: "failed", zohoPaymentId: null }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch (err) {
          // Zoho API unavailable — fall through and return pending from DB
          console.error("payment-status: Zoho sync failed", err);
        }
      }
    }

    // ── 6. Still pending ─────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        orderId: order.order_id,
        status: order.status,
        zohoPaymentId: null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("payment-status error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
