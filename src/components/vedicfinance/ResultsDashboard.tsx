import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReportResponse } from "@/lib/vedicfinance-types";
import SummaryCard from "./SummaryCard";
import ScoreGrid from "./ScoreGrid";
import DashboardCards from "./DashboardCards";
import TimelineBar from "./TimelineBar";
import NatalChartVisual from "./NatalChartVisual";
import TransitSnapshot from "./TransitSnapshot";

interface Props {
  report: ReportResponse;
  onReset: () => void;
}

export default function ResultsDashboard({ report, onReset }: Props) {
  return (
    <div className="space-y-6 pb-12">
      {/* First viewport: Header + Summary + Scores */}
      <div className="min-h-screen flex flex-col justify-center gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Financial Kundli</p>
            <h1 className="text-xl font-bold tracking-tight">Your Analysis</h1>
          </div>
          <Button variant="outline" size="sm" onClick={onReset} className="gap-2 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> New Analysis
          </Button>
        </div>

        {/* Summary */}
        <SummaryCard summary={report.summary} dasha={report.dasha} confidence={report.confidence} />

        {/* Score grid */}
        <ScoreGrid scores={report.scores} />
      </div>

      {/* Dashboard cards — Fin Metrics */}
      <DashboardCards dashboard={report.dashboard} />

      {/* ── separator ── */}
      <div className="border-t border-white/[0.06]" />

      {/* Birth Chart (Kundali) Analysis — full width 3-column layout */}
      <NatalChartVisual chart={report.d1_chart} reasoning={report.reasoning} />

      {/* Two-column: timeline + transits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TimelineBar timeline={report.timeline} />
        <TransitSnapshot transits={report.transits} />
      </div>

      {/* Confidence */}
    </div>
  );
}
