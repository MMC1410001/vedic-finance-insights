import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CheckoutShell } from "@/components/payment/CheckoutShell";
import { MethodStep } from "@/components/payment/MethodStep";
import { ProcessingStep } from "@/components/payment/ProcessingStep";
import { SuccessStep } from "@/components/payment/SuccessStep";
import { FailedStep } from "@/components/payment/FailedStep";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { USER_STATUS_KEY } from "@/hooks/useUserStatus";
import { useAuth } from "@/lib/auth-context";
import { isHeatmapPreview } from "@/lib/tracking-scope";
import { createPaymentOrder, pollPaymentStatus, PaymentStatusResponse } from "@/lib/payment-api";
import { openPaymentWidget } from "@/lib/zoho-payments";
import type { PaymentMethod } from "@/lib/payment-storage";
import { supabase } from "@/lib/supabase";
import { persistGuestBirthDetails } from "@/lib/save-birth-details";
import analytics from "@/lib/analytics";
import { campaignParams } from "@/lib/utm";

const AMOUNT = 99;
const ORDER_ID_KEY = "vedicfinance:pendingOrderId";
/**
 * The last order a purchase event was reported for.
 *
 * localStorage, not a ref, because the duplicate this prevents is in ANOTHER
 * TAB. `redirectedRef` dedupes within one page load, but two /payment tabs each
 * run their own background poll against the same order id; when it completes,
 * both fire Purchase_Confirmed with the same transaction_id and GA4 reports two
 * purchases and twice the revenue for one ₹99 order.
 *
 * Holds the order id rather than a boolean so a genuine second purchase is still
 * counted. Cleared on sign-out beside ORDER_ID_KEY.
 */
const PURCHASE_TRACKED_KEY = "vedicfinance:purchaseTracked";

type Step = "method" | "processing" | "success" | "failed" | "timeout";

/**
 * A resumed order (page was refreshed) gets a deliberately short poll. The
 * order id is written the moment "Pay ₹99" is clicked, before the widget even
 * opens, so a refresh at that point resumes an order that will stay `pending`
 * forever. The full 2-minute budget used by the live flow would strand the
 * user on an un-cancellable spinner (AF-082); a few seconds is enough to catch
 * a payment that genuinely did complete.
 */
const RESUME_POLL_OPTIONS = {
  maxAttempts: 4,
  initialDelay: 800,
  backoffMultiplier: 1.5,
  maxTimeout: 5_000,
} as const;

const Payment = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPaid, refetch: refetchPaymentStatus } = usePaymentStatus();
  const [step, setStep] = useState<Step>("method");
  const [signingIn, setSigningIn] = useState(false);
  const [orderId, setOrderId] = useState<string>("");
  // What the SERVER said this order costs. AMOUNT is the price on the card; this
  // is the figure the purchase event reports, so a price change made server-side
  // cannot leave GA4 quietly reporting the old one. Falls back to AMOUNT for a
  // resumed order, where the response that carried it is long gone.
  //
  // A ref rather than state, for the same reason the transaction id falls back to
  // localStorage: startBackgroundPolling captures completeAndRedirect at the
  // moment it is called, which is before the order response arrives, so a state
  // value would still read AMOUNT on the path that most often wins the race.
  const orderAmountRef = useRef<number>(AMOUNT);
  const [zohoPaymentId, setZohoPaymentId] = useState<string>("");
  const inFlightRef = useRef(false);
  // Track whether we already redirected to prevent double navigation
  const redirectedRef = useRef(false);
  // Track if we've already done the fresh mount check to avoid repeat checks
  const mountCheckDoneRef = useRef(false);
  // True when this "processing" state came from a page refresh rather than a
  // live Zoho widget. Drives the copy and whether Back is allowed.
  const [resumed, setResumed] = useState(false);
  // `step` and `resumed` for the popstate listener. That listener is installed
  // once on mount, so reading either from its closure always saw the initial
  // value and the Back guard was unreliable.
  const stepRef = useRef<Step>("method");
  const resumedRef = useRef(false);
  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { resumedRef.current = resumed; }, [resumed]);

  // ── Helper: complete payment and redirect ─────────────────────────────────
  const completeAndRedirect = useCallback(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    // The revenue event. It has to sit AFTER the redirectedRef guard — this
    // function is reached from six paths — and BEFORE the removeItem below,
    // which is the only remaining handle on the transaction id when the page
    // was resumed rather than paid on. GTM's GA4 Ecommerce tag wants the fields
    // nested under `ecommerce`, preceded by a reset push so values cannot leak
    // between events; get the shape wrong and revenue reads ₹0 while the
    // purchase count looks healthy. See ANALYTICS.md → "These cannot be click
    // tags".
    const transactionId = orderId || localStorage.getItem(ORDER_ID_KEY) || "";

    // Cross-tab guard. Read and written before the pushes, so whichever tab wins
    // the race is the only one that reports. A transactionId of "" is not worth
    // latching on — it would suppress the next real purchase — so an order we
    // cannot name is reported and left unlatched.
    let alreadyReported = false;
    try {
      alreadyReported =
        !!transactionId && localStorage.getItem(PURCHASE_TRACKED_KEY) === transactionId;
      if (!alreadyReported && transactionId) {
        localStorage.setItem(PURCHASE_TRACKED_KEY, transactionId);
      }
    } catch {
      /* private mode: at worst this double-counts across tabs, as before */
    }

    if (!alreadyReported) {
      analytics({ ecommerce: null }, "Ecommerce_Clear");
      analytics(
        {
          ecommerce: {
            transaction_id: transactionId,
            value: orderAmountRef.current,
            currency: "INR",
            items: [{ item_id: "financial_kundali", item_name: "Financial Kundali", price: orderAmountRef.current, quantity: 1 }],
          },
          ...campaignParams(),
        },
        "Purchase_Confirmed",
      );
    }

    localStorage.removeItem(ORDER_ID_KEY);
    if (user) {
      // Prime the cache so route guards (PaidRoute, ProtectedRoute) see paid=true immediately
      queryClient.setQueryData([USER_STATUS_KEY, user.id], { onboardingDone: true, hasPaid: true });
    }
    toast.success("Payment successful! AI Astrologer unlocked.");
    navigate("/ai-chat", { replace: true });
  }, [user, queryClient, navigate, orderId]);

  // ── Quick single-shot status check (used by visibility listener) ──────────
  const checkPaymentStatusOnce = useCallback(async (oid: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("payment-status", {
        method: "POST",
        body: { orderId: oid },
      });
      if (!error && data && data.status === "completed") {
        return true;
      }
    } catch {
      // Ignore errors — this is a best-effort check
    }
    return false;
  }, []);

  // ── Resilient status check with retries (for post-widget-failure) ─────────
  // After a network interruption the widget promise may reject while the
  // payment actually succeeded server-side. This helper retries multiple times
  // with increasing delays to give the network time to stabilize before we
  // declare the payment failed.
  const checkPaymentStatusWithRetry = useCallback(
    async (oid: string, attempts = 5, baseDelay = 2000): Promise<boolean> => {
      for (let i = 0; i < attempts; i++) {
        // Bail early if another code path already redirected
        if (redirectedRef.current) return true;

        // Wait before each attempt (including the first — gives network time to recover)
        const delay = i === 0 ? baseDelay : baseDelay * Math.pow(1.5, i);
        await new Promise((r) => setTimeout(r, delay));

        if (redirectedRef.current) return true;

        try {
          const { data, error } = await supabase.functions.invoke("payment-status", {
            method: "POST",
            body: { orderId: oid },
          });
          if (!error && data) {
            if (data.status === "completed") return true;
            // If explicitly failed/expired on server, stop retrying
            if (data.status === "failed" || data.status === "expired") return false;
          }
        } catch {
          // Network still flaky — continue retrying
        }
      }
      return false;
    },
    []
  );

  // ── Visibility change listener: when tab regains focus, check status ──────
  useEffect(() => {
    const currentOrderId = orderId || localStorage.getItem(ORDER_ID_KEY);
    if (!currentOrderId) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && !redirectedRef.current) {
        const completed = await checkPaymentStatusOnce(currentOrderId);
        if (completed) {
          completeAndRedirect();
        }
      }
    };

    // Also handle window focus for cases where visibilitychange doesn't fire
    const handleFocus = async () => {
      if (!redirectedRef.current && currentOrderId) {
        const completed = await checkPaymentStatusOnce(currentOrderId);
        if (completed) {
          completeAndRedirect();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [orderId, checkPaymentStatusOnce, completeAndRedirect]);

  // ── On mount: force a fresh DB check to avoid stale cache redirecting paid
  //    users back to /payment (common on mobile where cache persists longer).
  useEffect(() => {
    if (!user || mountCheckDoneRef.current) return;
    mountCheckDoneRef.current = true;

    // Invalidate so the next hasPaid read hits the DB
    queryClient.invalidateQueries({ queryKey: [USER_STATUS_KEY, user.id] });
  }, [user, queryClient]);

  // ── On mount: check if user already paid, or resume polling ──────────────
  useEffect(() => {
    // The /admin heatmap renders this page in an iframe. Without this, a paid
    // admin's frame redirects to /ai-chat and the heatmap labelled "/payment"
    // showed the chat page. isHeatmapPreview() requires the page to be genuinely
    // framed as well as flagged, precisely so that skipping this redirect cannot
    // put a paid user back in front of the ₹99 offer in a normal tab.
    if (isHeatmapPreview()) return;

    // If user already paid (from DB, not stale cache), redirect to ai-chat
    if (hasPaid) {
      navigate("/ai-chat", { replace: true });
      return;
    }

    // Resume polling if there's a pending order from a page refresh
    const pendingOrderId = localStorage.getItem(ORDER_ID_KEY);
    if (pendingOrderId) {
      setOrderId(pendingOrderId);
      setResumed(true);
      setStep("processing");
      resumePolling(pendingOrderId);
    }

    document.title = "Checkout | VedicFinance";

    // Push dummy history entry so browser back doesn't leave mid-flow
    window.history.pushState({ payment: true }, "");
    const handlePopState = (e: PopStateEvent) => {
      // Only trap Back while a real payment is in flight. A resumed order has
      // no widget open and nothing to protect, so Back must work (AF-082).
      if (stepRef.current === "processing" && !resumedRef.current) {
        window.history.pushState({ payment: true }, "");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [hasPaid, navigate]);

  // ── Resume polling for a pending order (page refresh scenario) ────────────
  const resumePolling = async (oid: string) => {
    try {
      const result = await pollPaymentStatus(oid, RESUME_POLL_OPTIONS);
      if (result.status === "completed") {
        completeAndRedirect();
      } else if (result.status === "failed" || result.status === "expired") {
        localStorage.removeItem(ORDER_ID_KEY);
        setStep("failed");
      } else {
        // Still pending after the short budget — the order was almost certainly
        // abandoned mid-flow. Surface a recoverable state rather than spinning.
        localStorage.removeItem(ORDER_ID_KEY);
        setStep("timeout");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "POLLING_TIMEOUT") {
        // Clear the key so a second refresh doesn't repeat the wait (AF-082).
        localStorage.removeItem(ORDER_ID_KEY);
        setStep("timeout");
      } else {
        localStorage.removeItem(ORDER_ID_KEY);
        setStep("failed");
      }
    }
  };

  // ── Background polling that runs alongside the widget ─────────────────────
  // This polls server-side for completion even while the Zoho widget promise
  // is blocked (browser throttles cross-window messages in background tabs).
  const startBackgroundPolling = (oid: string): (() => void) => {
    let cancelled = false;
    const poll = async () => {
      let delay = 3000; // start at 3s
      while (!cancelled && !redirectedRef.current) {
        await new Promise((r) => setTimeout(r, delay));
        if (cancelled || redirectedRef.current) break;

        const completed = await checkPaymentStatusOnce(oid);
        if (completed) {
          completeAndRedirect();
          break;
        }
        // Increase delay up to 8s
        delay = Math.min(delay * 1.3, 8000);
      }
    };
    poll();
    return () => { cancelled = true; };
  };

  // ── "Already paid?" handler — force DB check and redirect if confirmed ────
  const handleAlreadyPaid = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("has_paid")
        .eq("id", user.id)
        .single();

      if (!error && data?.has_paid === true) {
        // Update cache so guards don't bounce them back
        queryClient.setQueryData([USER_STATUS_KEY, user.id], { onboardingDone: true, hasPaid: true });
        navigate("/ai-chat", { replace: true });
      } else {
        toast.error("No completed payment found for your account. Please pay to continue.");
      }
    } catch {
      toast.error("Could not verify payment status. Please try again or contact support.");
    }
  }, [user, queryClient, navigate]);
  // Signed in on this page (or arrived already signed in) with birth details
  // still only in sessionStorage — write them through, or /ai-chat will deny on
  // "onboarding" straight after a successful payment.
  useEffect(() => {
    if (!user) return;
    persistGuestBirthDetails(user.id).then((saved) => {
      if (saved) queryClient.invalidateQueries({ queryKey: [USER_STATUS_KEY, user.id] });
    });
  }, [user, queryClient]);

  const startPayment = async (_method: PaymentMethod) => {
    // Anonymous visitors are allowed to see this page and the ₹99 offer, but an
    // order cannot exist without an account: create-payment-order 401s without a
    // JWT and stamps user_id on the row, and payment-webhook sets has_paid keyed
    // to that id. So authentication happens here, at the point of paying,
    // rather than as a blind wall before the price is ever shown.
    if (!user) {
      setSigningIn(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/payment`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        setSigningIn(false);
        toast.error("Could not start sign-in. Please try again.");
      }
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;
    redirectedRef.current = false;
    setResumed(false);
    setStep("processing");

    let stopBackgroundPolling: (() => void) | null = null;

    try {
      // Step 1: Create payment order
      const orderData = await createPaymentOrder();

      // If user already paid (race condition), redirect
      if (orderData.already_paid) {
        refetchPaymentStatus();
        navigate("/ai-chat", { replace: true });
        return;
      }

      const currentOrderId = orderData.orderId;
      setOrderId(currentOrderId);

      // Save to localStorage for page refresh recovery
      localStorage.setItem(ORDER_ID_KEY, currentOrderId);

      // Step 2: Start background polling BEFORE opening the widget.
      // This ensures we detect payment completion server-side even if the
      // Zoho widget promise is blocked by browser tab throttling.
      stopBackgroundPolling = startBackgroundPolling(currentOrderId);

      // Step 3: Open Zoho payment widget
      // The amount comes from the server response and is required by the Zoho
      // SDK to open the charge form. The authoritative charge is enforced
      // server-side by Zoho — the client-supplied value is display-only.
      setStep("method"); // briefly go back so widget overlays from method view
      // Zoho SDK requires amount as a string — coerce regardless of what the
      // server returns (it may come back as a number from the JSON response).
      const amountStr = String(orderData.amount ?? AMOUNT);
      // Recorded for the purchase event, from the same response the widget is
      // charged from — never from the constant on the card.
      const serverAmount = Number(orderData.amount);
      if (Number.isFinite(serverAmount) && serverAmount > 0) orderAmountRef.current = serverAmount;
      const widgetResult = await openPaymentWidget(
        orderData.paymentSessionId,
        currentOrderId,
        amountStr
      );

      // Stop background polling — widget promise resolved
      stopBackgroundPolling();
      stopBackgroundPolling = null;

      // If we already redirected via background polling, bail out
      if (redirectedRef.current) return;

      if (widgetResult.cancelled) {
        // User closed the widget — go back to method selection
        localStorage.removeItem(ORDER_ID_KEY);
        setStep("method");
        inFlightRef.current = false;
        return;
      }

      if (!widgetResult.success) {
        // Widget reported an error — but this may be a transient network issue.
        // Show processing state while we retry server-side verification.
        setStep("processing");
        const serverCompleted = await checkPaymentStatusWithRetry(currentOrderId);
        if (redirectedRef.current) return;
        if (serverCompleted) {
          completeAndRedirect();
          return;
        }
        localStorage.removeItem(ORDER_ID_KEY);
        toast.error("Payment unsuccessful. Please try again.");
        setStep("failed");
        inFlightRef.current = false;
        return;
      }

      // Step 4: Widget succeeded — redirect immediately to kundali
      completeAndRedirect();

      // Fire-and-forget: poll to ensure backend is updated
      pollPaymentStatus(currentOrderId).catch(() => {
        // Silent — backend webhook will eventually update status
      });
    } catch (err: unknown) {
      // Stop background polling on error
      stopBackgroundPolling?.();

      // If we already redirected via background polling, don't show error
      if (redirectedRef.current) return;

      const msg = err instanceof Error ? err.message : "";
      if (msg === "POLLING_TIMEOUT") {
        setStep("timeout");
      } else {
        // The widget promise may throw on network interruption even though
        // the payment succeeded server-side. Retry verification before failing.
        const currentOid = orderId || localStorage.getItem(ORDER_ID_KEY) || "";
        if (currentOid) {
          setStep("processing");
          const serverCompleted = await checkPaymentStatusWithRetry(currentOid);
          if (redirectedRef.current) return;
          if (serverCompleted) {
            completeAndRedirect();
            return;
          }
        }
        localStorage.removeItem(ORDER_ID_KEY);
        toast.error("Payment unsuccessful. Please try again.");
        setStep("failed");
      }
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleBack = () => {
    if (step === "failed" || step === "timeout" || (step === "processing" && resumed)) {
      setResumed(false);
      setStep("method");
      return;
    }
    navigate("/home");
  };

  const handleRetry = () => {
    setResumed(false);
    setStep("method");
  };

  // "Check again" from the timeout screen — show the checking state while the
  // short poll runs instead of leaving the button looking inert.
  const handleCheckAgain = () => {
    if (!orderId) return;
    setResumed(true);
    setStep("processing");
    resumePolling(orderId);
  };

  return (
    <CheckoutShell
      onBack={handleBack}
      showBack={step === "failed" || step === "timeout" || (step === "processing" && resumed)}
    >
      {step === "method" && (
        <MethodStep
          amount={AMOUNT}
          onPay={startPayment}
          /* "I already paid" reconciles against the signed-in user's profile,
             so it is meaningless before there is an account. */
          onAlreadyPaid={user ? handleAlreadyPaid : undefined}
          requiresSignIn={!user}
          signingIn={signingIn}
        />
      )}
      {step === "processing" && <ProcessingStep resumed={resumed} />}
      {step === "success" && (
        <SuccessStep
          txnId={zohoPaymentId || orderId}
          amount={AMOUNT}
          onContinue={() => navigate("/ai-chat")}
        />
      )}
      {step === "failed" && (
        <FailedStep onRetry={handleRetry} />
      )}
      {step === "timeout" && (
        <TimeoutStep orderId={orderId} onRetry={handleCheckAgain} onRestart={handleRetry} />
      )}
    </CheckoutShell>
  );
};

// ── Timeout Step (polling exhausted) ──────────────────────────────────────────
const TimeoutStep = ({
  orderId,
  onRetry,
  onRestart,
}: {
  orderId: string;
  onRetry: () => void;
  onRestart: () => void;
}) => (
  <div className="text-center">
    <div className="relative inline-flex items-center justify-center mb-5">
      <div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ background: "rgba(242,197,114,0.35)" }}
      />
      <div
        className="relative w-16 h-16 rounded-full flex items-center justify-center"
        style={{
          background: "rgba(242,197,114,0.18)",
          border: "1px solid rgba(242,197,114,0.45)",
        }}
      >
        <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="#C9922F" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    </div>
    <h1
      className="text-2xl md:text-3xl font-bold"
      style={{ color: "#1A0A2E", fontFamily: "'Playfair Display', serif" }}
    >
      Confirmation pending
    </h1>
    <p className="mt-3 max-w-sm mx-auto" style={{ color: "#6B5C7A" }}>
      Your payment may still be processing. If money was deducted, your access will be activated automatically within a few minutes.
    </p>
    <div
      className="mt-5 p-3 rounded-xl text-xs"
      style={{
        background: "rgba(26,10,46,0.04)",
        border: "1px solid rgba(26,10,46,0.08)",
        color: "#4A3F5C",
      }}
    >
      Order ID: <span className="font-mono">{orderId}</span>
    </div>
    <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
      <button
        onClick={onRetry}
        className="px-6 py-3 rounded-xl font-medium text-sm transition-all"
        style={{
          background: "linear-gradient(135deg, #F2C572, #FFDFA3)",
          color: "#1A0A2E",
        }}
      >
        Check again
      </button>
      <button
        onClick={onRestart}
        className="px-6 py-3 rounded-xl font-medium text-sm transition-all"
        style={{
          background: "rgba(26,10,46,0.04)",
          border: "1px solid rgba(26,10,46,0.12)",
          color: "#4A3F5C",
        }}
      >
        Start a new payment
      </button>
      <a
        href="mailto:support@vedicfinance.app"
        className="px-6 py-3 rounded-xl font-medium text-sm transition-all"
        style={{
          background: "rgba(26,10,46,0.04)",
          border: "1px solid rgba(26,10,46,0.12)",
          color: "#4A3F5C",
        }}
      >
        Contact support
      </a>
    </div>
  </div>
);

export default Payment;
