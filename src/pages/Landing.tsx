import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AstroTicker } from "@/components/landing/AstroTicker";
import { AstroSpecialties } from "@/components/landing/AstroSpecialties";
import { Navbar } from "@/components/landing/Navbar";
import { HeroShowcase } from "@/components/landing/HeroShowcase";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { InsightPreview } from "@/components/landing/InsightPreview";
import { Testimonials } from "@/components/landing/Testimonials";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";
import { useAuth } from "@/lib/auth-context";
import { useUserStatus } from "@/hooks/useUserStatus";
import { resolveDestination } from "@/lib/resolve-destination";
import { generateReport } from "@/lib/vedicfinance-api";
import { saveKundaliReport } from "@/lib/kundali-history";
import { supabase } from "@/lib/supabase";
import type { ReportRequest } from "@/lib/vedicfinance-types";

const Landing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isGuest = sessionStorage.getItem("guestMode") === "true";
  const isLoggedIn = !!user || isGuest;
  const { state } = useUserStatus();
  const hasKundaliAccess = isLoggedIn && state.onboardingDone;

  // Handle anchor links from footer (e.g. /home#how, /home#faq)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        const el = document.querySelector(hash);
        el?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [location]);

  // Auto-generate kundli report in background so the moon sign badge shows
  // as soon as the user has filled their birth chart, without needing to
  // visit /kundali first.
  useEffect(() => {
    const reqRaw = sessionStorage.getItem("kundliRequest");
    const reportRaw = sessionStorage.getItem("kundliReport");
    if (!reqRaw || reportRaw) return; // nothing to do

    try {
      const req: ReportRequest = JSON.parse(reqRaw);
      generateReport(req).then(async (data) => {
        const reqKey = `${req.birth_date}|${req.birth_time}|${req.latitude}|${req.longitude}`;
        sessionStorage.setItem("kundliReport", JSON.stringify(data));
        sessionStorage.setItem("kundliReportKey", reqKey);
        // Force a re-render so Navbar picks up the moon sign
        window.dispatchEvent(new Event("kundliReportReady"));

        // Persist to database for history & sharing.
        // Guests are saved too (user_id null): the row carries the session_id, so
        // getUserKundalis() can claim it if they sign up later. This used to bail
        // out when there was no session, silently dropping every guest kundali
        // generated from the landing page.
        try {
          const { data: { session } } = await supabase.auth.getSession();
          let userId = session?.user?.id;

          // Auth may still be initializing on mount. Wait once before falling back
          // to a guest row, so a signed-in user's kundali isn't orphaned.
          if (!userId) {
            await new Promise((r) => setTimeout(r, 1500));
            const { data: { session: retry } } = await supabase.auth.getSession();
            userId = retry?.user?.id;
          }

          const result = await saveKundaliReport(req, data, userId);
          if (result) {
            sessionStorage.setItem("lastKundaliSlug", result.shareSlug);
            sessionStorage.setItem("lastKundaliId", result.id);
            // Notify other components (e.g. Profile page) that the report is saved
            window.dispatchEvent(new Event("storage"));
          }
        } catch (err) {
          console.error("Failed to persist kundali to history:", err);
        }
      }).catch(() => { /* silent — non-critical background fetch */ });
    } catch { /* ignore malformed JSON */ }
  }, []);

  const handleGetKundli = () => {
    const destination = resolveDestination(state, "kundali");
    navigate(destination);
  };

  const seeHow = () => {
    document.getElementById("how")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className="landing-fonts min-h-screen flex flex-col"
      style={{ background: "#ffffff" }}
    >
      <AstroTicker />
      <Navbar />
      <main className="flex-1">
        <Hero onPrimary={handleGetKundli} paid={hasKundaliAccess} />
        <AstroSpecialties />
        <InsightPreview onUnlock={handleGetKundli} paid={hasKundaliAccess} />
        <HowItWorks />
        <Testimonials />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
};

export default Landing;
