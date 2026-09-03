/**
 * AuthGate — gates premium kundali features (download, share, upcoming insights, risk section).
 *
 * When an unauthenticated user interacts with a gated section:
 * - "overlay" mode: blurs content + shows a sign-in prompt that navigates to /kundali-auth
 * - "inline" mode: replaces a button with a "Sign in to [feature]" button
 *
 * Authenticated users see the content normally.
 */

import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Lock } from "lucide-react";

interface AuthGateProps {
  children?: React.ReactNode;
  /** Feature name shown in the prompt (e.g. "Download PDF", "Share Kundali") */
  feature: string;
  /** Use "overlay" for section-level gating, "inline" for button-level gating */
  mode?: "overlay" | "inline";
  /** Optional className for the wrapper */
  className?: string;
}

export default function AuthGate({ children, feature, mode = "overlay", className = "" }: AuthGateProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Authenticated users see content directly
  if (user) {
    return <>{children}</>;
  }

  const handleGoToAuth = () => {
    navigate("/kundali-auth");
  };

  if (mode === "inline") {
    // For button-level gating (download/share buttons) — replace the button with a sign-in prompt
    return (
      <button
        onClick={handleGoToAuth}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-300 hover:brightness-110 ${className}`}
        style={{
          background: "linear-gradient(135deg, #F2C572, #FFDFA3)",
          color: "#2A0E4A",
          boxShadow: "0 2px 10px rgba(242,197,114,0.4)",
        }}
        title={`Sign in to ${feature}`}
      >
        <Lock className="h-3.5 w-3.5" />
        <span>Sign in to {feature}</span>
      </button>
    );
  }

  // Overlay mode — show blurred content with a sign-in prompt on top
  return (
    <div className={`relative ${className}`}>
      {/* Blurred content */}
      <div className="pointer-events-none select-none" style={{ filter: "blur(6px)", opacity: 0.5 }}>
        {children}
      </div>

      {/* Sign-in overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div
          className="flex flex-col items-center gap-5 p-6 sm:p-8 rounded-2xl border max-w-sm mx-4 text-center"
          style={{
            background: "rgba(42, 14, 74, 0.97)",
            borderColor: "rgba(242, 197, 114, 0.25)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(242,197,114,0.15)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "rgba(242, 197, 114, 0.1)", border: "1px solid rgba(242, 197, 114, 0.3)" }}
          >
            <Lock className="h-5 w-5" style={{ color: "#F2C572" }} />
          </div>

          <div>
            <h3
              className="text-lg font-semibold mb-1"
              style={{ color: "#F5E9FF", fontFamily: "'Playfair Display', serif" }}
            >
              Sign in to unlock
            </h3>
            <p className="text-sm" style={{ color: "#A89BC8" }}>
              {feature} requires a Google account. Sign in to access this feature.
            </p>
          </div>

          <button
            onClick={handleGoToAuth}
            className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] hover:brightness-105"
            style={{
              backgroundImage: "linear-gradient(135deg, #F2C572, #FFDFA3)",
              color: "#2A0E4A",
              boxShadow: "0 10px 30px rgba(242,197,114,0.4)",
            }}
          >
            <Lock className="h-4 w-4" />
            Sign in / Sign up
          </button>
        </div>
      </div>
    </div>
  );
}
