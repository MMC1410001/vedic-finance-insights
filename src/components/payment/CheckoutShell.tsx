import { Link } from "react-router-dom";
import { Lock, ShieldCheck, Sparkles } from "lucide-react";
import vedicfinanceLogo from "@/assets/vedicfinance-logo.webp";

export const CheckoutShell = ({
  children,
  onBack,
  showBack = true,
}: {
  children: React.ReactNode;
  onBack?: () => void;
  showBack?: boolean;
}) => (
  <div
    className="min-h-screen flex flex-col"
    style={{ background: "#f6f4f2" }}
  >
    <header className="border-b border-[#1A0A2E]/[0.08]">
      <div className="container flex items-center justify-between h-16">
        <Link to="/home" className="flex items-center gap-2.5">
          <img src={vedicfinanceLogo} alt="VedicFinance" className="h-7 w-7" loading="lazy" decoding="async" />
          <span className="flex items-baseline select-none">
            <span
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 700,
                color: "#1A0A2E",
                letterSpacing: "-0.5px",
              }}
            >
              Astro
            </span>
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                color: "#a22c1c",
              }}
            >
              Fin
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#6B5C7A" }}>
          <Lock className="w-3.5 h-3.5" style={{ color: "#F2C572" }} />
          Secure checkout
        </div>
      </div>
    </header>

    <main className="flex-1 flex items-start md:items-center justify-center py-10 md:py-14">
      <div className="container max-w-xl">
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="text-sm transition-opacity mb-6 hover:opacity-70"
            style={{ color: "#6B5C7A" }}
          >
            ← Back
          </button>
        )}
        <div className="animate-fade-up">{children}</div>
      </div>
    </main>

    <footer className="border-t border-[#1A0A2E]/[0.08] py-4">
      <div
        className="container flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs"
        style={{ color: "#6B5C7A" }}
      >
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#F2C572" }} /> Secure payment via trusted gateways
        </span>
        <span>No auto-renewals</span>
        <span>Instant access</span>
      </div>
    </footer>
  </div>
);
