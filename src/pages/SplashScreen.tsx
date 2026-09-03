import { useEffect, useState } from "react";
import uniqueFont from "@/assets/fonts/runtime-font/RuntimeRegular-m2Odx.otf?url";
import vedicfinanceLogo from "@/assets/vedicfinance-logo.webp";

const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  const [phase, setPhase] = useState<"logo" | "text" | "exit">("logo");

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `@font-face { font-family: 'Unique'; src: url('${uniqueFont}') format('opentype'); }`;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // Retimed from 800/2400/3100. The old sequence held an opaque sheet over a
  // fully-mounted Landing for 3.1s, and the last animation finished at 1.6s —
  // so ~1.5s of it was the user looking at a finished, static screen. Same
  // animation, same order, without the wait.
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("text"), 300);
    const t2 = setTimeout(() => setPhase("exit"), 900);
    // Must outlast the fade-out below, or the sheet is yanked mid-transition.
    const t3 = setTimeout(onFinish, 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ease-out ${
        phase === "exit" ? "opacity-0" : "opacity-100"
      }`}
      style={{ background: '#f6f4f2' }}
    >
      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Logo */}
        <div
          className={`transition-all duration-[400ms] ${
            phase === "logo" ? "scale-100 opacity-100" : "scale-110 opacity-100"
          }`}
        >
          <img src={vedicfinanceLogo} alt="VedicFinance" className="h-20 w-20 object-contain" decoding="async" fetchpriority="high" />
        </div>

        {/* Brand name reveal */}
        <div className="overflow-hidden">
          <h1
            className={`text-4xl md:text-5xl tracking-tight transition-all duration-[400ms] ${
              phase === "logo"
                ? "translate-y-full opacity-0"
                : "translate-y-0 opacity-100"
            }`}
            style={{ fontFamily: "'Unique', sans-serif" }}
          >
            <span style={{ color: '#C8962E' }}>Astro</span>
            <span style={{ color: '#2A0E4A' }}>Fin</span>
          </h1>
        </div>

        {/* Tagline */}
        <p
          className={`text-sm tracking-widest uppercase transition-all duration-[250ms] delay-150 ${
            phase === "text" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
          style={{ color: '#6B5C7A' }}
        >
          Stars guide your wealth
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
