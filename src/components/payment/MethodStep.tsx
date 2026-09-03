import { Button } from "@/components/ui/button";
import { Lock, ShieldCheck, TrendingUp, Sparkles } from "lucide-react";
import type { PaymentMethod } from "@/lib/payment-storage";
import analytics from "@/lib/analytics";

import avatarAbhishek from "@/assets/testimonial-images/abhishek-shukla-avatar.webp";
import avatarAmitav from "@/assets/testimonial-images/amitav-avatar.webp";
import avatarHarsha from "@/assets/testimonial-images/harsha-gupta-avatar.webp";
import avatarShobha from "@/assets/testimonial-images/shoba-patil-avatar.webp";

const avatars = [avatarAbhishek, avatarAmitav, avatarHarsha, avatarShobha];

export const MethodStep = ({
  onPay,
  amount,
  onAlreadyPaid,
  requiresSignIn = false,
  signingIn = false,
}: {
  onPay: (method: PaymentMethod) => void;
  amount: number;
  onAlreadyPaid?: () => void;
  /** Caller has no account yet — clicking Pay starts Google sign-in first. */
  requiresSignIn?: boolean;
  signingIn?: boolean;
}) => {
  return (
    <div>
      {/* Heading */}
      <div className="text-center mb-8">
        <h1
          className="text-3xl md:text-4xl font-bold tracking-tight"
          style={{ color: "#1A0A2E" }}
        >
          Unlock AI Astrologer
        </h1>
        <p className="mt-3" style={{ color: "#6B5C7A" }}>
          One-time payment of ₹99. Get unlimited access to AI-powered financial astrology insights.
        </p>
      </div>

      {/* Amount card */}
      <div
        className="rounded-2xl p-5 mb-6 text-center"
        style={{
          border: "1px solid rgba(242,197,114,0.5)",
          background: "linear-gradient(135deg, rgba(242,197,114,0.16), rgba(255,255,255,0))",
        }}
      >
        <div className="text-xs" style={{ color: "#6B5C7A" }}>
          Amount payable
        </div>
        <div className="mt-1">
          <span
            className="text-4xl font-bold"
            style={{
              backgroundImage: "linear-gradient(135deg, #C9922F, #E0A93F)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            ₹{amount}
          </span>
        </div>
      </div>

      {/* Pay CTA */}
      <Button
        variant="hero"
        size="xl"
        className="w-full"
        disabled={signingIn}
        onClick={() => {
          analytics({ 'gtm.text': 'UnlockKndali_Pay99' });
          onPay("upi");
        }}
      >
        {/* Say what the click actually does. An unannounced redirect to Google
            from a button labelled "Pay ₹99" reads as a failed payment. */}
        {signingIn ? "Redirecting…" : requiresSignIn ? `Sign in to Pay ₹${amount}` : `Pay ₹${amount}`}
      </Button>
      <div className="flex items-center justify-center gap-1.5 text-[11px] mt-3" style={{ color: "#6B5C7A" }}>
        <Lock className="w-3 h-3" /> Secure payment via trusted gateways · No auto-renewals
      </div>

      {/* Trust factors */}
      <div
        className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-xs"
        style={{ color: "#4A3F5C" }}
      >
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: "#2FBF9F" }} />
          Birth data stays private
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <TrendingUp className="w-4 h-4 shrink-0" style={{ color: "#F2C572" }} />
          No Demat needed
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Sparkles className="w-4 h-4 shrink-0" style={{ color: "#7C4DBF" }} />
          Lifetime access
        </span>
      </div>

      {/* Social proof */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <div className="flex -space-x-2">
          {avatars.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className="w-7 h-7 rounded-full ring-2 ring-white object-cover"
            loading="lazy" decoding="async" />
          ))}
        </div>
        <span className="text-sm" style={{ color: "#4A3F5C" }}>
          <span className="font-semibold" style={{ color: "#1A0A2E" }}>2,400+</span> Kundalis generated
        </span>
      </div>

      {/* Already paid escape hatch — helps users whose cache is stale */}
      {onAlreadyPaid && (
        <div className="mt-8 text-center">
          <button
            onClick={onAlreadyPaid}
            className="text-xs underline underline-offset-2 transition-opacity hover:opacity-80"
            style={{ color: "#6B5C7A" }}
          >
            Already paid? Click here to access your Kundali
          </button>
        </div>
      )}
    </div>
  );
};
