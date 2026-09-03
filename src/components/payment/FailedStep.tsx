import { XCircle } from "lucide-react";

export const FailedStep = ({
  onRetry,
}: {
  onRetry: () => void;
}) => (
  <div className="text-center">
    <div className="relative inline-flex items-center justify-center mb-5">
      <div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ background: "rgba(239,68,68,0.22)" }}
      />
      <div
        className="relative w-16 h-16 rounded-full flex items-center justify-center"
        style={{
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.35)",
        }}
      >
        <XCircle className="w-9 h-9" style={{ color: "#ef4444" }} />
      </div>
    </div>
    <h1
      className="text-2xl md:text-3xl font-bold"
      style={{ color: "#1A0A2E", fontFamily: "'Playfair Display', serif" }}
    >
      Payment didn't go through
    </h1>
    <p className="mt-3 max-w-sm mx-auto" style={{ color: "#6B5C7A" }}>
      No money was deducted. Tap below to try again.
    </p>
    <div className="flex justify-center mt-8">
      <button
        onClick={onRetry}
        className="px-8 py-3 rounded-xl font-semibold text-sm transition-all hover:brightness-110"
        style={{
          background: "linear-gradient(135deg, #F2C572, #FFDFA3)",
          color: "#1A0A2E",
          boxShadow: "0 8px 24px rgba(242,197,114,0.35)",
        }}
      >
        Retry payment
      </button>
    </div>
  </div>
);
