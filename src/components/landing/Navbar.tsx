import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { useUserStatus } from "@/hooks/useUserStatus";
import { resolveDestination } from "@/lib/resolve-destination";
import { ZODIAC_IMAGES } from "@/lib/zodiac-images";
import analytics from "@/lib/analytics";

/**
 * Read moon sign — tries sessionStorage first (warm), then falls back to
 * localStorage (persists across page refreshes and new tabs).
 * Also writes through to localStorage whenever sessionStorage has fresh data,
 * so all future cold-starts resolve instantly.
 */
function getMoonSign(): { sign: string; signNum: number } | null {
  try {
    const raw = sessionStorage.getItem("kundliReport");
    if (raw) {
      const report = JSON.parse(raw);
      const moon = report?.d1_chart?.planets?.find(
        (p: any) => p.planet === "Moon"
      );
      if (moon?.sign && moon?.sign_num !== undefined) {
        const result = { sign: moon.sign as string, signNum: moon.sign_num as number };
        // Write-through so localStorage stays in sync for future refreshes
        try { localStorage.setItem("moonSign", JSON.stringify(result)); } catch { /* ignore */ }
        return result;
      }
    }
  } catch { /* ignore */ }

  // Fallback: localStorage survives page refreshes and new tabs
  try {
    const stored = localStorage.getItem("moonSign");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.sign && parsed?.signNum !== undefined) return parsed;
    }
  } catch { /* ignore */ }

  return null;
}

export const Navbar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isGuest = sessionStorage.getItem("guestMode") === "true";
  const isLoggedIn = !!user || isGuest;
  const { hasPaid } = usePaymentStatus();
  const paid = isLoggedIn && hasPaid;

  // Get user state for proper routing
  const { state } = useUserStatus();

  // Re-read moon sign when kundliReport becomes available in sessionStorage
  const [moonSign, setMoonSign] = useState(getMoonSign);
  const refresh = useCallback(() => setMoonSign(getMoonSign()), []);

  // Track if logo is over any red section
  const [isOverRedSection, setIsOverRedSection] = useState(false);

  // Show "Get Kundali" button only after scrolling past the stepper (#how) section
  const [showGetKundali, setShowGetKundali] = useState(false);

  useEffect(() => {
    // Cache DOM queries outside the scroll handler to prevent layout thrashing
    let astroSpecialtiesSection: Element | null = null;
    let footerSection: Element | null = null;
    let howSection: HTMLElement | null = null;
    let rafId: number | null = null;
    
    // Initialize cached references
    const initRefs = () => {
      astroSpecialtiesSection = document.querySelector('section[style*="#a22c1c"]');
      footerSection = document.querySelector('footer[style*="#a22c1c"]');
      howSection = document.getElementById("how");
      
      // Fallback: find by computed styles
      if (!astroSpecialtiesSection || !footerSection) {
        const allSections = document.querySelectorAll('section, footer');
        allSections.forEach(el => {
          const bg = window.getComputedStyle(el).backgroundColor;
          if (bg === 'rgb(162, 44, 28)' || bg === '#a22c1c') {
            if (el.tagName === 'SECTION') astroSpecialtiesSection = el;
            if (el.tagName === 'FOOTER') footerSection = el;
          }
        });
      }
    };

    const checkLogoPosition = () => {
      // Debounce using requestAnimationFrame to prevent excessive calculations
      if (rafId !== null) return;
      
      rafId = requestAnimationFrame(() => {
        rafId = null;
        
        // The navbar band, in viewport coordinates. On md+ the header is fixed
        // at top-[40px] (below the 40px AstroTicker) and is h-16 (64px) tall
        // with mt-3 (12px) of lead-in. On mobile it shares the 40px ticker row.
        const mobile = window.innerWidth < 768;
        const navbarTop = mobile ? 0 : 40;
        const navbarBottom = mobile ? 40 : 40 + 64 + 12;

        let isOverRed = false;

        // Check AstroSpecialties section
        if (astroSpecialtiesSection) {
          const rect = astroSpecialtiesSection.getBoundingClientRect();
          if (rect.top <= navbarBottom && rect.bottom >= navbarTop) {
            isOverRed = true;
          }
        }

        // Check Footer section
        if (footerSection) {
          const rect = footerSection.getBoundingClientRect();
          if (rect.top <= navbarBottom && rect.bottom >= navbarTop) {
            isOverRed = true;
          }
        }
        
        setIsOverRedSection(isOverRed);

        // Show "Get Kundali" once the stepper (#how) section reaches the top of the viewport
        if (howSection) {
          const howRect = howSection.getBoundingClientRect();
          setShowGetKundali(howRect.top <= navbarBottom);
        }
      });
    };

    // Initialize cached references
    initRefs();
    
    // Run check immediately
    checkLogoPosition();
    
    // Add scroll and resize listeners
    window.addEventListener('scroll', checkLogoPosition, { passive: true });
    window.addEventListener('resize', checkLogoPosition, { passive: true });
    
    // Re-resolve once the rest of the page has mounted. This used to be three
    // setTimeouts at 100/500/1000ms, each running initRefs() — which walks every
    // section calling getComputedStyle — so it forced three full style/layout
    // passes at exactly the moments the browser was trying to finish first
    // paint. One pass after the first frame does the same job.
    let settleRaf: number | null = null;
    const settle = setTimeout(() => {
      settleRaf = requestAnimationFrame(() => {
        initRefs();
        checkLogoPosition();
      });
    }, 0);
    
    return () => {
      window.removeEventListener('scroll', checkLogoPosition);
      window.removeEventListener('resize', checkLogoPosition);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (settleRaf !== null) cancelAnimationFrame(settleRaf);
      clearTimeout(settle);
    };
  }, []);

  useEffect(() => {
    // Listen for cross-tab storage changes
    window.addEventListener("storage", refresh);
    // Listen for custom event dispatched in the same tab
    window.addEventListener("kundliReportReady", refresh);

    // There used to be a setInterval(..., 1000) here "until we find the data".
    // For a visitor with no report — every first-time and anonymous visitor —
    // that never succeeded, so it was a permanent 1 Hz timer doing a
    // sessionStorage read plus a JSON.parse of the entire kundali report, on the
    // landing page, forever. The two listeners above already cover both cases
    // that can produce the data: "kundliReportReady" for a same-tab write (it is
    // dispatched in report-store.ts right after the report is cached) and
    // "storage" for another tab.

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("kundliReportReady", refresh);
    };
  }, [refresh]);

  return (
    <header
      // Mobile: sits in the 40px AstroTicker row (logo beside the red band).
      // md+: unchanged — below the ticker, h-16 (64px) + mt-3 (12px) = 76px.
      // pointer-events-none: on mobile this band overlaps the ticker, and its
      // full-width inner div would otherwise swallow taps meant for the ticker's
      // sign selector. Only the interactive groups below opt back in.
      className="fixed top-0 md:top-[40px] inset-x-0 z-50 h-[40px] md:h-[76px] pointer-events-none"
    >
      <div className="container px-3 md:px-8 flex items-center justify-between h-[40px] mt-0 md:h-16 md:mt-3">
        {/* Full-width pill card wrapping logo and nav — transparent on mobile, pill on md+ */}
        <div
          className="relative flex items-center justify-start md:justify-between w-full md:rounded-full px-0 md:px-6 py-0 md:py-2.5"
        >
          {/* md+ pill background */}
          <div
            className="hidden md:block absolute inset-0 rounded-full"
            style={{
              background: "rgba(255,255,255,0.9)",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
            }}
          />
          
          {/* Logo — on mobile has its own pill bg, on md+ inherits from parent pill */}
          <div
            className="relative z-10 pointer-events-auto flex items-center gap-3 cursor-pointer rounded-full px-3 py-1 md:px-0 md:py-0 md:bg-transparent md:border-0 md:shadow-none navbar-logo-pill"
            onClick={() => {
              analytics({ 'gtm.text': 'VedicFinance_Logo' });
              navigate("/home");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <span className="flex items-baseline select-none">
              <span
                className="text-[1.05rem] md:text-2xl"
                style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: "#2A0E4A", letterSpacing: "-0.5px" }}
              >
                Astro
              </span>
              <span
                className="text-[1.05rem] md:text-2xl"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  color: isOverRedSection ? "#FFDFA3" : "#a22c1c",
                  transition: "color 0.3s ease"
                }}
              >
                Fin
              </span>
            </span>
          </div>

          {/* Nav links — absolutely centred so their position depends only on the
              pill's width. In flow they sat in a justify-between group, so the
              scroll-triggered "Get Kundali" CTA and the async moon-sign badge
              (both in the actions group on the right) pushed them sideways. */}
          <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 pointer-events-auto items-center gap-1 text-sm">
            <a href="#insights" onClick={() => analytics({ 'gtm.text': 'Header_Insights' })} className="px-4 py-1.5 rounded-full transition-colors hover:bg-black/5" style={{ color: "#a22c1c" }}>
              Insights
            </a>
            <a href="#testimonials" onClick={() => analytics({ 'gtm.text': 'Header_Testimonials' })} className="px-4 py-1.5 rounded-full transition-colors hover:bg-black/5" style={{ color: "#a22c1c" }}>
              Testimonials
            </a>
            <a href="#faq" onClick={() => analytics({ 'gtm.text': 'Header_FAQ' })} className="px-4 py-1.5 rounded-full transition-colors hover:bg-black/5" style={{ color: "#a22c1c" }}>
              FAQ
            </a>
          </nav>

          {/* Actions */}
          <div className="absolute right-3 md:relative md:right-auto pointer-events-auto flex items-center gap-2">
            {/* Mobile: show a compact CTA button — only after scrolling past stepper */}
            {showGetKundali && (
              <button
                onClick={() => {
                  analytics({ 'gtm.text': 'VedicFinance_Nav_Kundali_Mobile' });
                  const destination = resolveDestination(state, "kundali");
                  navigate(destination);
                }}
                className="md:hidden h-8 px-3 rounded-full text-xs font-semibold flex items-center gap-1 transition-all hover:brightness-110 active:scale-95 animate-fade-up"
                style={{
                  backgroundImage: "linear-gradient(135deg, #F2C572, #FFDFA3)",
                  color: "#2A0E4A",
                  boxShadow: "0 4px 12px rgba(242,197,114,0.35)",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Get Kundali
              </button>
            )}

            {isLoggedIn ? (
              <>
                {/* Moon sign badge */}
                {(() => {
                  if (!moonSign) return null;
                  return (
                    <button
                      onClick={() => navigate("/kundali")}
                      className="hidden sm:flex items-center gap-1 rounded-full px-3 py-2 cursor-pointer transition-all hover:scale-105"
                      style={{ background: "rgba(42,14,74,0.06)", border: "1px solid rgba(42,14,74,0.15)" }}
                      title={`Moon in ${moonSign.sign}: View Kundali`}
                    >
                      <img
                        src={ZODIAC_IMAGES[moonSign.signNum]}
                        alt={moonSign.sign}
                        className="w-4 h-4 object-contain"
                      decoding="async" fetchpriority="high" />
                      <span className="text-xs font-medium" style={{ color: "#2A0E4A" }}>
                        {moonSign.sign.slice(0, 3)}
                      </span>
                    </button>
                  );
                })()}

              </>
            ) : (
              /* Desktop CTA for non-logged-in users — only after scrolling past stepper */
              showGetKundali && (
                <button
                  onClick={() => {
                    analytics({ 'gtm.text': 'VedicFinance_Nav_GetKundali_Desktop' });
                    const destination = resolveDestination(state, "kundali");
                    navigate(destination);
                  }}
                  className="hidden md:flex h-9 px-5 rounded-full text-sm font-semibold items-center gap-1.5 transition-all hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.98] animate-fade-up"
                  style={{
                    backgroundImage: "linear-gradient(135deg, #F2C572, #FFDFA3)",
                    color: "#2A0E4A",
                    boxShadow: "0 4px 16px rgba(242,197,114,0.35)",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Get Kundali
                </button>
              )
            )}

          </div>
        </div>
      </div>
    </header>
  );
};
