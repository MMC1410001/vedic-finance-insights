import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const stages = [
  "Verifying payment",
  "Analyzing planetary positions",
  "Mapping financial patterns",
  "Preparing your insights",
];

export const SuccessStep = ({
  txnId,
  amount,
  onContinue,
}: {
  txnId: string;
  amount: number;
  onContinue: () => void;
}) => {
  const [stage, setStage] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (stage >= stages.length) {
      const t = setTimeout(() => setReady(true), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStage((s) => s + 1), 800);
    return () => clearTimeout(t);
  }, [stage]);

  // Auto-redirect after animation completes
  useEffect(() => {
    if (ready) {
      const t = setTimeout(() => onContinue(), 1500);
      return () => clearTimeout(t);
    }
  }, [ready, onContinue]);

  return (
    <div>
      <div className="text-center mb-8">
        <div className="relative inline-flex items-center justify-center mb-5">
          <div
            className="absolute inset-0 rounded-full blur-2xl"
            style={{ background: "rgba(47,191,159,0.25)" }}
          />
          <div
            className="relative w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(47,191,159,0.12)",
              border: "1px solid rgba(47,191,159,0.35)",
            }}
          >
            <CheckCircle2 className="w-9 h-9" style={{ color: "#2FBF9F" }} />
          </div>
        </div>
        <h1
          className="text-3xl md:text-4xl font-bold tracking-tight"
          style={{ color: "#1A0A2E", fontFamily: "'Playfair Display', serif" }}
        >
          Payment successful
        </h1>
        <p className="mt-3" style={{ color: "#6B5C7A" }}>
          Your Financial Kundli is being generated.
        </p>
      </div>

      <div
        className="rounded-2xl p-5 md:p-6"
        style={{
          background: "#ffffff",
          border: "1px solid rgba(26,10,46,0.08)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
        }}
      >
        <div
          className="flex items-center justify-between text-xs pb-4"
          style={{ borderBottom: "1px solid rgba(26,10,46,0.08)" }}
        >
          <div>
            <div style={{ color: "#6B5C7A" }}>Transaction ID</div>
            <div className="font-mono mt-0.5" style={{ color: "#1A0A2E" }}>
              {txnId}
            </div>
          </div>
          <div className="text-right">
            <div style={{ color: "#6B5C7A" }}>Amount paid</div>
            <div
              className="font-semibold mt-0.5"
              style={{ color: "#1A0A2E", fontFamily: "'Playfair Display', serif" }}
            >
              ₹{amount}
            </div>
          </div>
        </div>

        <ul className="mt-5 space-y-3">
          {stages.map((label, i) => {
            const done = i < stage;
            const active = i === stage;
            return (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors"
                  style={{
                    background: done
                      ? "rgba(47,191,159,0.15)"
                      : active
                        ? "rgba(242,197,114,0.25)"
                        : "rgba(26,10,46,0.05)",
                    color: done ? "#1E9C80" : active ? "#8A6220" : "#6B5C7A",
                  }}
                >
                  {done ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : active ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "currentColor" }}
                    />
                  )}
                </span>
                <span
                  style={{
                    color: done || active ? "#1A0A2E" : "#6B5C7A",
                  }}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>

        <Button
          variant="hero"
          size="xl"
          className="w-full mt-6"
          onClick={onContinue}
          disabled={!ready}
        >
          {ready ? "View My Financial Kundli" : "Almost there…"}
        </Button>
        <p className="text-center text-[11px] mt-3" style={{ color: "#6B5C7A" }}>
          {ready
            ? "Redirecting automatically…"
            : "A receipt is saved to this device. Lifetime access included."}
        </p>
      </div>
    </div>
  );
};
