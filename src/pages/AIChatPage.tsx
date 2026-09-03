import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AstroChat from "./AstroChat";
import { Starfield } from "@/components/ui/starfield-1";
import { KundaliThemeProvider, useKundaliTheme } from "@/lib/kundali-theme-context";
import vedicKundaliSquare from "@/assets/vedic-kundali-square.svg";
import vedicCornerOrnament from "@/assets/vedic-corner-ornament.svg";

function AIChatPageInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, colors } = useKundaliTheme();
  const isVedic = theme === "vedic";
  // Carried in router state by the dashboard's "Ask about fin-astrology…" input,
  // so what the user typed there survives the navigation into the chat.
  const initialMessage = (location.state as { initialMessage?: string } | null)?.initialMessage;

  // Where the back arrow goes. Deliberately not navigate(-1): sign-in is a
  // full-page Google redirect and /payment + /kundali-auth land here with
  // `replace`, so the previous history entry is the OAuth URL — going back one
  // step dumped users on the Google login page.
  const from = (location.state as { from?: string } | null)?.from;
  const backTo =
    from &&
    from.startsWith("/") &&
    !from.startsWith("//") && // no protocol-relative URLs
    !/^\/(auth|kundali-auth|payment)/.test(from) // never back into the auth flow
      ? from
      // Anyone here cleared PaidRoute, so /kundali is always valid for them.
      : "/kundali";

  return (
    <div className={`relative flex flex-col h-screen overflow-hidden ${isVedic ? "vedic-theme" : ""}`}
      style={{ background: isVedic ? "#FFFCF5" : "black" }}
    >
      {/* ── Canvas starfield background ── */}
      {!isVedic && (
        <div className="absolute inset-0 z-0">
          <Starfield
            starColor="rgba(255,255,255,0.8)"
            bgColor="black"
            speed={0.3}
            quantity={600}
            mouseAdjust
            easing={8}
          />
        </div>
      )}

      {/* Vedic subtle background pattern */}
      {isVedic && (
        <div className="absolute inset-0 z-0" style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(198,147,10,0.03) 0%, transparent 60%), radial-gradient(ellipse at 0% 0%, rgba(212,160,18,0.05) 0%, transparent 40%), radial-gradient(ellipse at 100% 0%, rgba(212,160,18,0.05) 0%, transparent 40%), radial-gradient(ellipse at 100% 100%, rgba(198,147,10,0.04) 0%, transparent 40%), radial-gradient(ellipse at 0% 100%, rgba(198,147,10,0.04) 0%, transparent 40%), linear-gradient(180deg, #FFFDF7 0%, #FFF9EC 30%, #FFFCF5 60%, #FFF8E8 100%)",
        }} />
      )}

      {/* Vedic kundali square — repeating geometric lines */}
      {isVedic && (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `url(${vedicKundaliSquare})`,
            backgroundRepeat: "repeat-y",
            backgroundSize: "100% auto",
            backgroundPosition: "top center",
            opacity: 0.5,
          }}
        />
      )}

      {/* Vedic corner ornaments */}
      {isVedic && (
        <>
          <img
            src={vedicCornerOrnament}
            alt=""
            className="absolute top-0 left-0 w-[80px] h-[80px] lg:w-[150px] lg:h-[150px] pointer-events-none z-[1]"
            aria-hidden="true"
          loading="lazy" decoding="async" />
          <img
            src={vedicCornerOrnament}
            alt=""
            className="absolute top-0 right-0 w-[80px] h-[80px] lg:w-[150px] lg:h-[150px] pointer-events-none z-[1]"
            style={{ transform: "scaleX(-1)" }}
            aria-hidden="true"
          loading="lazy" decoding="async" />
        </>
      )}

      {/* Top bar */}
      <div className="relative z-10 flex items-center gap-3 px-4 py-3 border-b backdrop-blur-xl"
        style={{
          borderColor: isVedic ? "rgba(184,134,11,0.12)" : "rgba(255,255,255,0.06)",
          background: isVedic ? "rgba(255,253,247,0.9)" : "rgba(0,0,0,0.8)",
        }}
      >
        <button
          onClick={() => navigate(backTo)}
          className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors group"
          style={{
            background: isVedic ? "rgba(184,134,11,0.06)" : "rgba(255,255,255,0.04)",
          }}
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 transition-colors" style={{ color: isVedic ? "rgba(80,50,20,0.6)" : "rgba(255,255,255,0.5)" }} />
        </button>
        <span className="text-sm font-semibold tracking-tight" style={{ color: colors.textPrimary }}>AI Astrologer Chat</span>
      </div>

      {/* Full AstroChat component */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        <AstroChat initialMessage={initialMessage} />
      </div>
    </div>
  );
}

export default function AIChatPage() {
  return (
    <KundaliThemeProvider>
      <AIChatPageInner />
    </KundaliThemeProvider>
  );
}
