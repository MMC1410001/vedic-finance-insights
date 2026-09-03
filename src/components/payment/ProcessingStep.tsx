import { Loader2 } from "lucide-react";

/**
 * `resumed` = this state came from a page refresh, not a live payment widget.
 * Telling someone who has already refreshed not to refresh is both useless and
 * alarming, so the copy changes (AF-082).
 */
export const ProcessingStep = ({ resumed = false }: { resumed?: boolean }) => (
  <div className="text-center py-10">
    <div className="relative inline-flex items-center justify-center">
      <div
        className="absolute inset-0 rounded-full blur-2xl animate-pulse"
        style={{ background: "rgba(242,197,114,0.35)" }}
      />
      <div
        className="relative w-20 h-20 rounded-full flex items-center justify-center"
        style={{
          background: "rgba(26,10,46,0.04)",
          border: "1px solid rgba(26,10,46,0.08)",
        }}
      >
        <Loader2 className="w-9 h-9 animate-spin" style={{ color: "#C9922F" }} />
      </div>
    </div>
    <h1
      className="text-2xl md:text-3xl font-bold mt-8"
      style={{ color: "#1A0A2E", fontFamily: "'Playfair Display', serif" }}
    >
      {resumed ? "Checking your payment…" : "Processing your payment…"}
    </h1>
    <p className="mt-3" style={{ color: "#6B5C7A" }}>
      {resumed
        ? "Looking up the status of your last attempt."
        : "We're preparing your Financial Kundli."}
    </p>
    {!resumed && (
      <p className="text-xs mt-6" style={{ color: "#6B5C7A" }}>
        Please don't close or refresh this page.
      </p>
    )}
  </div>
);
