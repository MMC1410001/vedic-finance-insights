/**
 * Zoho Payments SDK wrapper.
 * Provides typed access to the global ZPayments constructor loaded via script tag.
 */

// ─── Type declarations for Zoho ZPayments global ────────────────────────────

interface ZPaymentsOptions {
  account_id: string;
  domain?: string;
  otherOptions?: {
    api_key?: string;
  };
}

interface PaymentMethodOptions {
  payments_session_id: string;
  amount?: string;
  currency_code?: string;
  order_id?: string;
  transaction_type?: string;
}

interface ZPaymentsResult {
  status: string;
  error_code?: string;
  message?: string;
  payment_id?: string;
}

interface ZPaymentsInstance {
  requestPaymentMethod(options: PaymentMethodOptions): Promise<ZPaymentsResult>;
}

interface ZPaymentsConstructor {
  new (options: ZPaymentsOptions): ZPaymentsInstance;
}

declare global {
  interface Window {
    ZPayments?: ZPaymentsConstructor;
  }
}

// ─── Eager SDK warm-up ───────────────────────────────────────────────────────
// Start polling for the SDK as soon as this module is imported (i.e. when the
// payment page component tree loads), not only when the user taps "Pay".
// On slow mobile connections this can save up to 5 seconds of widget-open delay.
// The promise is shared so multiple callers never spin duplicate loops.
let _sdkReadyPromise: Promise<boolean> | null = null;

function getSDKReadyPromise(timeoutMs = 8000): Promise<boolean> {
  if (_sdkReadyPromise) return _sdkReadyPromise;

  _sdkReadyPromise = (async () => {
    if (window.ZPayments) return true;

    const start = Date.now();
    // Poll every 150 ms — tighter than the old 200 ms, and we keep the same
    // total timeout budget (extended to 8s for slow mobile networks).
    while (Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (window.ZPayments) return true;
    }

    console.warn(
      "Zoho ZPayments SDK not ready after waiting. " +
      "Check that zpayments.js is not blocked by an ad-blocker or Content Security Policy."
    );
    return false;
  })();

  return _sdkReadyPromise;
}

// Kick off the warm-up immediately at module-load time.
// This runs in the background and does not block anything.
void getSDKReadyPromise();

// ─── SDK helpers ────────────────────────────────────────────────────────────

/**
 * Creates a ZPayments instance. Returns null if SDK is not loaded.
 * Reuses the shared warm-up promise so we never wait longer than necessary.
 */
export async function createZohoInstance(): Promise<ZPaymentsInstance | null> {
  const sdkReady = await getSDKReadyPromise();
  if (!sdkReady || !window.ZPayments) {
    console.error(
      "Zoho ZPayments SDK not loaded. " +
      "Check if zpayments.js script tag is in index.html and not blocked."
    );
    return null;
  }

  const accountId = import.meta.env.VITE_ZOHO_ACCOUNT_ID as string;
  const apiKey = import.meta.env.VITE_ZOHO_API_KEY as string;

  if (!accountId) {
    console.error("Missing VITE_ZOHO_ACCOUNT_ID env var");
    return null;
  }

  return new window.ZPayments({
    account_id: accountId,
    domain: "IN",
    otherOptions: {
      api_key: apiKey || undefined,
    },
  });
}

export interface PaymentWidgetResult {
  success: boolean;
  cancelled: boolean;
  paymentId?: string;
  error?: string;
}

/**
 * Opens the Zoho payment widget for the given session.
 * Resolves with success/cancelled/error state.
 *
 * NOTE: `amount` is required by the Zoho SDK to open the charge form, but the
 * authoritative amount is locked inside the server-created Zoho session. The
 * widget uses this value only for display — the actual charge cannot be altered
 * from the client side because it is enforced server-side by Zoho.
 */
export async function openPaymentWidget(
  sessionId: string,
  orderId: string,
  amount: string = "99"
): Promise<PaymentWidgetResult> {
  console.log("openPaymentWidget called with:", { sessionId, orderId, amount });

  const instance = await createZohoInstance();
  if (!instance) {
    return {
      success: false,
      cancelled: false,
      error: "Payment SDK not available. Please refresh the page and try again.",
    };
  }

  try {
    console.log("Calling requestPaymentMethod with session:", sessionId);
    const result = await instance.requestPaymentMethod({
      payments_session_id: sessionId,
      amount,
      currency_code: "INR",
      order_id: orderId,
      transaction_type: "charge",
    });

    console.log("ZPayments widget result:", JSON.stringify(result));

    if (result.status === "success" || result.status === "completed") {
      return {
        success: true,
        cancelled: false,
        paymentId: result.payment_id,
      };
    }

    // User closed the widget
    if (result.error_code === "widget_closed" || result.status === "closed") {
      return {
        success: false,
        cancelled: true,
      };
    }

    // Other failure — use a user-friendly message
    return {
      success: false,
      cancelled: false,
      error: "Payment could not be processed. Please try again or use a different method.",
    };
  } catch (err: unknown) {
    console.error("ZPayments widget error:", err);
    console.error("ZPayments widget error JSON:", JSON.stringify(err, null, 2));

    const rawMessage =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null
        ? JSON.stringify(err)
        : String(err);

    // Handle widget_closed as cancellation
    if (rawMessage.includes("widget_closed") || rawMessage.includes("closed")) {
      return { success: false, cancelled: true };
    }

    // Never expose raw backend/technical errors to the user
    return {
      success: false,
      cancelled: false,
      error: "Something went wrong with the payment. Please try again or use a different method.",
    };
  }
}
