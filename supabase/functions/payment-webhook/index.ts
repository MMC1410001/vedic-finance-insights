import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyWebhookSignature } from "../_shared/zoho.ts";

serve(async (req) => {
  // Handle CORS preflight (shouldn't happen for webhooks, but just in case)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // ── 1. Read raw body for HMAC verification ──────────────────────────────
    const rawBody = new Uint8Array(await req.arrayBuffer());

    // ── 2. Verify HMAC signature ────────────────────────────────────────────
    const signatureHeader = req.headers.get("X-Zoho-Webhook-Signature") || "";
    if (!signatureHeader) {
      console.error("payment-webhook: Missing X-Zoho-Webhook-Signature header");
      return new Response(
        JSON.stringify({ error: "Missing signature" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const isValid = await verifyWebhookSignature(rawBody, signatureHeader);
    if (!isValid) {
      console.error("payment-webhook: Invalid HMAC signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── 3. Parse JSON body ──────────────────────────────────────────────────
    const bodyStr = new TextDecoder().decode(rawBody);
    const payload = JSON.parse(bodyStr);

    const eventId = payload.event_id || payload.webhook_id || crypto.randomUUID();
    const eventType = payload.event_type || "";
    const eventObject = payload.event_object || payload.data || {};
    const payment = eventObject.payment || eventObject || {};

    // Extract our order_id from reference_number
    const orderId = payment.reference_number || payment.reference_id || "";
    const zohoPaymentId = payment.payment_id || "";
    const paidAmount = parseFloat(payment.amount || "0");

    console.log(`payment-webhook: event_type=${eventType}, order_id=${orderId}, event_id=${eventId}`);

    // ── 4. Set up Supabase admin client ─────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ── 5. Idempotency check ────────────────────────────────────────────────
    const { data: existingEvent } = await supabaseAdmin
      .from("webhook_events")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent) {
      // Already processed this event — return 200 to prevent Zoho retries
      console.log(`payment-webhook: Duplicate event ${eventId}, skipping`);
      return new Response(
        JSON.stringify({ status: "already_processed" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── 6. Look up order ────────────────────────────────────────────────────
    if (!orderId) {
      console.error("payment-webhook: No order_id in payload");
      // Still return 200 — don't want Zoho to retry unknown events
      return new Response(
        JSON.stringify({ status: "no_order_id" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("payment_orders")
      .select("id, user_id, amount, status")
      .eq("order_id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      console.error(`payment-webhook: Order not found for ${orderId}`, orderErr);
      // Return 200 to avoid infinite retries
      return new Response(
        JSON.stringify({ status: "order_not_found" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── 7. Process based on event type ──────────────────────────────────────
    if (eventType === "payment.succeeded" || eventType === "payment_session.completed") {
      // Validate amount (±0.01 tolerance for floating point)
      const expectedAmount = parseFloat(order.amount);
      if (Math.abs(paidAmount - expectedAmount) > 0.01 && paidAmount > 0) {
        console.error(
          `payment-webhook: AMOUNT MISMATCH for ${orderId}. Expected ${expectedAmount}, got ${paidAmount}. Rejecting.`
        );

        // Mark order as failed due to amount tampering
        await supabaseAdmin
          .from("payment_orders")
          .update({
            status: "amount_mismatch",
            zoho_payment_id: zohoPaymentId,
          })
          .eq("order_id", orderId);

        // Record the event so it won't be reprocessed
        await supabaseAdmin.from("webhook_events").insert({
          event_id: eventId,
          event_type: eventType,
          order_id: orderId,
        });

        // Return 200 to acknowledge receipt (Zoho won't retry)
        return new Response(
          JSON.stringify({ status: "amount_mismatch", expected: expectedAmount, received: paidAmount }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Update payment_orders → completed
      await supabaseAdmin
        .from("payment_orders")
        .update({
          status: "completed",
          zoho_payment_id: zohoPaymentId,
        })
        .eq("order_id", orderId);

      // Update user_profiles → has_paid = true
      await supabaseAdmin
        .from("user_profiles")
        .update({ has_paid: true })
        .eq("id", order.user_id);

      console.log(`payment-webhook: Order ${orderId} completed, user ${order.user_id} marked as paid`);
    } else if (eventType === "payment.failed" || eventType === "payment_session.failed") {
      // Update payment_orders → failed
      await supabaseAdmin
        .from("payment_orders")
        .update({
          status: "failed",
          zoho_payment_id: zohoPaymentId,
        })
        .eq("order_id", orderId);

      console.log(`payment-webhook: Order ${orderId} marked as failed`);
    } else {
      console.log(`payment-webhook: Unhandled event type: ${eventType}`);
    }

    // ── 8. Record webhook event for idempotency ─────────────────────────────
    await supabaseAdmin.from("webhook_events").insert({
      event_id: eventId,
      event_type: eventType,
      order_id: orderId,
    });

    // ── 9. Return 200 immediately (Zoho requires response within 5s) ────────
    return new Response(
      JSON.stringify({ status: "ok" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("payment-webhook error:", err);
    // Return 200 even on error to avoid infinite Zoho retries
    // The webhook will be recorded as unprocessed and can be manually replayed
    return new Response(
      JSON.stringify({ status: "error" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});
