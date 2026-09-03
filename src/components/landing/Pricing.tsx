import { Button } from "@/components/ui/button";
import { BarChart3, Check, Clock4, Flame, Lock, Orbit, ShieldAlert } from "lucide-react";

const unlocks = [
  { icon: Orbit, title: "Your financial personality", desc: "Wealth tendencies mapped from your chart." },
  { icon: Clock4, title: "Best & worst time periods", desc: "Personal windows to act or pause." },
  { icon: ShieldAlert, title: "Risk alerts", desc: "Caution periods flagged in advance." },
  { icon: BarChart3, title: "Decision clarity", desc: "Move with confidence, not guesswork." },
];

const trust = [
  "One-time payment, no subscription",
  "No hidden charges",
  "No bank account access required",
  "256-bit secure payment",
];

export const Pricing = ({ onCta, paid = false }: { onCta: () => void; paid?: boolean }) => (
  <section id="pricing" className="py-24 md:py-32">
    <div className="container">
      <div className="max-w-2xl mx-auto text-center mb-10">
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] uppercase tracking-widest mb-5"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#F2C572",
          }}
        >
          <Flame className="w-3 h-3" /> Limited to first 10,000 users
        </div>
        <h2
          className="text-3xl md:text-5xl font-bold tracking-tight"
          style={{ color: "#F5E9FF", fontFamily: "'Playfair Display', serif" }}
        >
          Your{" "}
          <span
            style={{
              backgroundImage: "linear-gradient(135deg, #F2C572, #FFDFA3)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Financial Kundli
          </span>{" "}
          is ready
        </h2>
        <p className="mt-3" style={{ color: "#A89BC8" }}>
          Unlock personalized insights generated for you.
        </p>
      </div>

      <div className="max-w-xl mx-auto">
        <div
          className="rounded-2xl p-6 md:p-7"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
        >
          {/* Feature cards grid */}
          <div className="grid sm:grid-cols-2 gap-3">
            {unlocks.map((u) => (
              <div
                key={u.title}
                className="flex gap-3 p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(242,197,114,0.15)" }}
                >
                  <u.icon className="w-4 h-4" style={{ color: "#F2C572" }} />
                </div>
                <div>
                  <div className="text-sm font-medium leading-tight" style={{ color: "#F5E9FF" }}>
                    {u.title}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#A89BC8" }}>
                    {u.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Price banner */}
          <div
            className="mt-6 rounded-2xl p-5 flex items-center justify-between"
            style={{
              border: "1px solid rgba(242,197,114,0.3)",
              background: "linear-gradient(135deg, rgba(242,197,114,0.1), transparent)",
            }}
          >
            <div>
              <div className="text-xs" style={{ color: "#A89BC8" }}>
                Total today
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className="text-4xl font-bold"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    backgroundImage: "linear-gradient(135deg, #F2C572, #FFDFA3)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  ₹99
                </span>
                <span className="line-through text-sm" style={{ color: "#A89BC8" }}>
                  ₹999
                </span>
              </div>
            </div>
            <span
              className="text-[11px] font-semibold uppercase tracking-wider rounded-full px-3 py-1"
              style={{ color: "#F2C572", background: "rgba(242,197,114,0.1)" }}
            >
              90% off
            </span>
          </div>

          {/* Trust points */}
          <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {trust.map((t) => (
              <li key={t} className="flex items-center gap-2 text-xs" style={{ color: "#A89BC8" }}>
                <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#F2C572" }} />
                {t}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <Button variant="hero" size="xl" className="w-full mt-6" onClick={onCta}>
            {paid ? "View Your Financial Kundli" : "Unlock My Financial Kundli"}
          </Button>
          <div className="flex items-center justify-center gap-1.5 text-[11px] mt-3" style={{ color: "#A89BC8" }}>
            <Lock className="w-3 h-3" /> Secure payment · Instant access
          </div>
        </div>
      </div>
    </div>
  </section>
);
