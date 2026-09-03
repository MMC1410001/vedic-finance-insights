import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, AlertCircle, Star } from "lucide-react";
import { generateReport } from "@/lib/vedicfinance-api";
import type { ReportRequest, ReportResponse } from "@/lib/vedicfinance-types";
import LoadingScreen from "@/components/vedicfinance/LoadingScreen";
import ResultsDashboard from "@/components/vedicfinance/ResultsDashboard";

type UIState = "loading" | "result" | "error" | "skipped";

function getStoredRequest(): ReportRequest | null {
  try {
    const raw = sessionStorage.getItem("kundliRequest");
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.birth_date || !data.birth_time) return null;
    return data as ReportRequest;
  } catch {
    return null;
  }
}

export default function VedicFinance() {
  const navigate = useNavigate();
  const [uiState, setUiState] = useState<UIState>("loading");
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const req = getStoredRequest();
    if (!req) {
      setUiState("skipped");
      return;
    }
    runAnalysis(req);
  }, []);

  const runAnalysis = async (req: ReportRequest) => {
    setUiState("loading");
    setError("");
    try {
      const data = await generateReport(req);
      const reqKey = `${req.birth_date}|${req.birth_time}|${req.latitude}|${req.longitude}`;
      sessionStorage.setItem("kundliReport", JSON.stringify(data));
      sessionStorage.setItem("kundliReportKey", reqKey);
      window.dispatchEvent(new Event("kundliReportReady"));
      setReport(data);
      setUiState("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setUiState("error");
    }
  };

  const handleReset = () => {
    sessionStorage.removeItem("kundliRequest");
    sessionStorage.removeItem("kundliReport");
    sessionStorage.removeItem("kundliReportKey");
    setReport(null);
    setError("");
    navigate("/");
  };

  if (uiState === "loading") return <LoadingScreen />;

  if (uiState === "result" && report) {
    return (
      <div className="min-h-screen px-3 md:px-6 py-6 md:py-10 max-w-7xl mx-auto">
        <ResultsDashboard report={report} onReset={handleReset} />
      </div>
    );
  }

  if (uiState === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <div>
          <p className="font-medium">Analysis failed</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
        <button onClick={() => navigate("/")} className="text-sm text-primary underline underline-offset-4">
          Try again
        </button>
      </div>
    );
  }

  // skipped state
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4 relative overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src="https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=1400&q=80&fm=webp"
          alt="Zodiac astrology cosmos"
          className="w-full h-full object-cover opacity-10"
        loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/40" />
      </div>
      <div className="relative z-10 w-16 h-16 rounded-2xl border border-primary/30 bg-primary/10 flex items-center justify-center">
        <Star className="w-8 h-8 text-primary" />
      </div>
      <div className="relative z-10 space-y-2 max-w-sm">
        <h2 className="text-2xl font-bold">
          Your <span className="text-gradient-gold">Kundli</span> awaits
        </h2>
        <p className="text-muted-foreground text-sm">
          Complete your birth details to unlock a personalized Vedic financial analysis.
        </p>
      </div>
      <button
        onClick={() => navigate("/")}
        className="relative z-10 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground text-sm font-bold uppercase tracking-wider hover:opacity-90 transition-opacity glow-gold"
      >
        <Sparkles className="w-4 h-4" /> Start Onboarding
      </button>
    </div>
  );
}
