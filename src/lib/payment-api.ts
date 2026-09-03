/**
 * Payment API service module.
 * Orchestrates calls to the Supabase edge functions for payment flow.
 */

import { supabase } from "./supabase";
import { trackVisit } from "./visitor-tracking";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateOrderResponse {
  orderId: string;
  paymentSessionId: string;
  amount: string;
  currency: string;
  already_paid?: boolean;
}

export interface PaymentStatusResponse {
  orderId: string;
  status: "pending" | "completed" | "failed" | "expired";
  zohoPaymentId: string | null;
}

// ─── Create Payment Order ───────────────────────────────────────────────────

/**
 * Calls the create-payment-order edge function.
 * Returns order details and Zoho session ID for the widget.
 */
export async function createPaymentOrder(): Promise<CreateOrderResponse> {
  // Before the call, not after: an order that fails to create is still a
  // payment attempt worth having an IP for.
  trackVisit("payment_started");

  const { data, error } = await supabase.functions.invoke("create-payment-order", {
    method: "POST",
  });

  if (error) {
    throw new Error(error.message || "Failed to create payment order");
  }

  if (!data) {
    throw new Error("No response from payment order creation");
  }

  return data as CreateOrderResponse;
}

// ─── Poll Payment Status ────────────────────────────────────────────────────

export interface PollOptions {
  maxAttempts?: number;
  initialDelay?: number;
  backoffMultiplier?: number;
  maxTimeout?: number;
  onPoll?: (attempt: number, status: string) => void;
}

/**
 * Returns `base` ± up to 20% random jitter.
 * Spreads concurrent polls (background + foreground) so they don't slam the
 * edge function at the same instant, especially important on flaky mobile
 * connections where retries tend to cluster.
 */
function withJitter(base: number): number {
  const jitter = base * 0.2 * (Math.random() * 2 - 1); // [-20%, +20%]
  return Math.max(200, Math.round(base + jitter));
}

/**
 * Polls the payment-status edge function with exponential backoff + jitter.
 * Resolves when status is non-pending, or rejects on timeout.
 *
 * Defaults tuned for mobile:
 *   - 20 attempts (was 15) — more attempts with smaller delays keeps total
 *     coverage time similar while catching fast completions sooner.
 *   - 800 ms initial delay (was 2 000 ms) — avoids a guaranteed 2 s stall
 *     when the payment backend confirms quickly.
 *   - 1.3× backoff (was 1.5×) — gentler ramp so later polls on a slow
 *     mobile connection still land within a reasonable window.
 *   - ±20% jitter — prevents background + foreground polls from colliding.
 *   - 10 s delay cap (unchanged).
 *   - 2 min total timeout (unchanged).
 */
export async function pollPaymentStatus(
  orderId: string,
  options?: PollOptions
): Promise<PaymentStatusResponse> {
  const maxAttempts = options?.maxAttempts ?? 20;
  const initialDelay = options?.initialDelay ?? 800;
  const backoffMultiplier = options?.backoffMultiplier ?? 1.3;
  const maxTimeout = options?.maxTimeout ?? 120_000; // 2 minutes
  const onPoll = options?.onPoll;

  const startTime = Date.now();
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Check total timeout budget
    if (Date.now() - startTime > maxTimeout) {
      throw new Error("POLLING_TIMEOUT");
    }

    // Call payment-status edge function
    const { data, error } = await supabase.functions.invoke("payment-status", {
      method: "POST",
      body: { orderId },
    });

    if (error) {
      console.warn(`Poll attempt ${attempt} failed:`, error.message);
      // Continue polling on transient errors
    } else if (data) {
      const status = data as PaymentStatusResponse;
      onPoll?.(attempt, status.status);

      // Non-pending = resolved
      if (status.status !== "pending") {
        return status;
      }
    }

    // Wait before next attempt (with jitter, capped at 10 s)
    if (attempt < maxAttempts) {
      const cappedDelay = Math.min(delay, 10_000);
      await new Promise((resolve) => setTimeout(resolve, withJitter(cappedDelay)));
      delay = cappedDelay * backoffMultiplier;
    }
  }

  // Exhausted attempts
  throw new Error("POLLING_TIMEOUT");
}
