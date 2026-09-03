/**
 * SharedKundali — public view of a shared kundali report via slug.
 * Loads the full FinancialKundali dashboard (same UI as /kundali).
 * Accessible without authentication.
 * 
 * For admins: bypasses RLS by using the admin API to fetch any kundali.
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { getKundaliBySlug, getKundaliBySlugAdmin } from "@/lib/kundali-history";
import { useReportStore } from "@/lib/report-store";
import { useAuth } from "@/lib/auth-context";
import { useUserStatus } from "@/hooks/useUserStatus";
import FinancialKundali from "./FinancialKundali";

const SharedKundali = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: userStatusLoading } = useUserStatus();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      if (!slug) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Wait for user status to load before deciding which API to use
      if (user && userStatusLoading) {
        return;
      }

      // Clear any previously loaded kundali from sessionStorage and the Zustand
      // store BEFORE fetching. Without this, the store hydrates synchronously
      // from sessionStorage at module load time (e.g. the admin's own kundali)
      // and renders the wrong name until the async fetch completes.
      sessionStorage.removeItem("kundliReport");
      sessionStorage.removeItem("kundliRequest");
      sessionStorage.removeItem("kundliReportKey");
      sessionStorage.removeItem("lastKundaliSlug");
      sessionStorage.removeItem("lastKundaliId");
      useReportStore.getState().clear();

      // Admins can view any kundali (bypasses is_shared RLS check)
      console.log('[SharedKundali] Loading kundali:', { slug, isAdmin: user && isAdmin, hasUser: !!user });
      const kundali = (user && isAdmin)
        ? await getKundaliBySlugAdmin(slug)
        : await getKundaliBySlug(slug);

      console.log('[SharedKundali] Kundali loaded:', { found: !!kundali, name: kundali?.full_name });

      if (!kundali) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Hydrate sessionStorage with this kundali's data
      const reportData = {
        summary: {
          financial_phase: kundali.financial_phase,
          confidence_level: kundali.confidence_lvl,
          primary_insight: kundali.primary_insight,
        },
        scores: kundali.scores,
        d1_chart: kundali.d1_chart,
        d9_chart: kundali.d9_chart,
        dasha: kundali.dasha,
        timeline: kundali.timeline,
        transits: kundali.transits,
      };
      const requestData = {
        full_name: kundali.full_name || "",
        birth_date: kundali.birth_date,
        birth_time: kundali.birth_time,
        birth_place: kundali.birth_place,
        latitude: 0,
        longitude: 0,
        timezone: 0,
        birth_time_accuracy: "exact",
      };

      sessionStorage.setItem("kundliReport", JSON.stringify(reportData));
      sessionStorage.setItem("kundliRequest", JSON.stringify(requestData));
      sessionStorage.setItem("lastKundaliSlug", kundali.share_slug);
      sessionStorage.setItem("lastKundaliId", kundali.id);
      window.dispatchEvent(new Event("kundliReportReady"));

      const reqKey = `${kundali.birth_date}|${kundali.birth_time}|0|0`;
      sessionStorage.setItem("kundliReportKey", reqKey);

      // Update the Zustand store directly so FinancialKundali renders immediately
      const { setReport } = useReportStore.getState();
      const birthYear = kundali.birth_date ? new Date(kundali.birth_date).getFullYear() : undefined;
      setReport(reportData as any, kundali.full_name || "", birthYear);

      setLoading(false);
    }

    load();
  }, [slug, user, isAdmin, userStatusLoading]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #0D0618 0%, #1A0B2E 50%, #0D0618 100%)" }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#F2C572" }} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: "linear-gradient(135deg, #0D0618 0%, #1A0B2E 50%, #0D0618 100%)" }}
      >
        <Sparkles className="h-12 w-12" style={{ color: "rgba(242,197,114,0.3)" }} />
        <h1 className="text-xl font-bold" style={{ color: "#F5E9FF" }}>
          Kundali Not Found
        </h1>
        <p className="text-sm" style={{ color: "rgba(168,155,200,0.6)" }}>
          This kundali link may be invalid or expired.
        </p>
        <button
          onClick={() => navigate("/home")}
          className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
          style={{
            background: "linear-gradient(135deg, #F2C572, #FFDFA3)",
            color: "#2A0E4A",
          }}
        >
          Go Home
        </button>
      </div>
    );
  }

  // Render the full FinancialKundali page — data is already in the store
  return <FinancialKundali />;
};

export default SharedKundali;
