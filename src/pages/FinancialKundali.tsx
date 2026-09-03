/**
 * FinancialKundali — Main Financial Kundali page (/kundali).
 * Shows a high-level summary of earnings, risks, and investments.
 *
 * Uses Zustand store for report data — no skeleton flash on revisit.
 */

import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Particles } from "@/components/ui/particles";
import {
  Menu,
  Download,
  Calendar,
  Clock,
  MapPin,
  Sun,
  Moon,
} from "lucide-react";
import KundaliSidebar from "@/components/kundali/KundaliSidebar";
import { useReportStore } from "@/lib/report-store";
import { KundaliThemeProvider, useKundaliTheme } from "@/lib/kundali-theme-context";
import { useAuth } from "@/lib/auth-context";
import { useChatAccess } from "@/hooks/useChatAccess";
import { USER_STATUS_KEY } from "@/hooks/useUserStatus";
import { persistGuestBirthDetails } from "@/lib/save-birth-details";
import { getUserKundalis } from "@/lib/kundali-history";
import analytics from "@/lib/analytics";
import type { ReportRequest } from "@/lib/vedicfinance-types";
import AuthGate from "@/components/kundali/AuthGate";

import SalaryPromotionWindows from "@/components/financial-kundali/SalaryPromotionWindows";
import ScamRiskSection from "@/components/financial-kundali/ScamRiskSection";
import FITimelineCard from "@/components/financial-kundali/FITimelineCard";
import IncomeGrowthTimeline from "@/components/financial-kundali/IncomeGrowthTimeline";
import PeakEarningYears from "@/components/financial-kundali/PeakEarningYears";
import IncomeConstellation from "@/components/financial-kundali/IncomeConstellation";
import SuddenWealthChart from "@/components/financial-kundali/SuddenWealthChart";
import FinancialRiskSummary from "@/components/financial-kundali/FinancialRiskSummary";
import InvestmentsAssetsSection, { BestBusinessStartCard } from "@/components/financial-kundali/InvestmentsAssetsSection";
import { CardFeedbackWrapper } from "@/components/financial-kundali/CardFeedback";
import FeedbackPanel from "@/components/financial-kundali/FeedbackPanel";
import { useFeedbackLoader } from "@/lib/feedback-store";
import { ZODIAC_IMAGE_BY_NAME } from "@/lib/zodiac-images";
import vedicKundaliSquare from "@/assets/vedic-kundali-square.svg";
import vedicCornerOrnament from "@/assets/vedic-corner-ornament.svg";

/* ── Memoized Particles to prevent re-renders ── */
const MemoParticles = memo(Particles);

/**
 * Saves an intermediate PDF raster to disk for inspection (AF-088).
 * Only ever called when the `vedicfinance:pdfDebug` flag is set in localStorage.
 */
function pdfDebugDump(name: string, dataUrl: string) {
  try {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `pdfdebug-${name}.png`;
    a.click();
  } catch (err) {
    console.warn("[pdfDebug] could not dump", name, err);
  }
}

/* ── Main page ── */
const FinancialKundaliInner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Embed mode: hide sidebar, mobile header, and PDF overlay when rendered inside an iframe on the landing page
  const isEmbed = new URLSearchParams(location.search).get("embed") === "true";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Auto-collapse sidebar on iPad/tablet-width screens (1024–1279px)
    // to give main content enough room
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024 && window.innerWidth < 1280;
    }
    return false;
  });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfStep, setPdfStep] = useState<string>(""); // Granular progress label shown in overlay
  const pdfInProgressRef = useRef(false); // Ref guard to prevent double-click race
  const mainRef = useRef<HTMLElement>(null);
  const { theme, colors, toggleTheme, setTheme } = useKundaliTheme();
  const { user, loading: authLoading } = useAuth();
  const { openChat } = useChatAccess();
  const queryClient = useQueryClient();

  // Force vedic (light) theme in embed mode to match the landing page white background
  useEffect(() => {
    if (isEmbed) setTheme("vedic");
  }, [isEmbed, setTheme]);

  // Load existing feedback votes from Supabase for the authenticated user
  useFeedbackLoader();

  // Subscribe to individual store slices — component only re-renders when its slice changes
  const scores = useReportStore((s) => s.scores);
  const dasha = useReportStore((s) => s.dasha);
  const transits = useReportStore((s) => s.transits);
  const chart = useReportStore((s) => s.chart);
  const timeline = useReportStore((s) => s.timeline);
  const insights = useReportStore((s) => s.insights);
  const birthYear = useReportStore((s) => s.birthYear);
  const userName = useReportStore((s) => s.userName);
  const personalSummary = useReportStore((s) => s.personalSummary);
  const fetchReport = useReportStore((s) => s.fetchReport);
  const fetchSummary = useReportStore((s) => s.fetchSummary);
  const hasRealData = useReportStore((s) => s.hasRealData);
  const reportLoading = useReportStore((s) => s.loading);

  // Parse birth details from session storage for display.
  // Depends on `userName` from the store so it re-derives after the DB-restore
  // path writes kundliRequest to sessionStorage and updates the store — fixes
  // the bug where a fresh tab (or second window) would show null birth details
  // because sessionStorage was empty at mount time and the memo never re-ran.
  const birthDetails = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("kundliRequest");
      if (!raw) return null;
      const req = JSON.parse(raw);
      const name = req.full_name || "";
      const date = req.birth_date
        ? new Date(req.birth_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
        : "";
      const time = req.birth_time || "";
      const place = req.birth_place || "";
      return { name, date, time, place };
    } catch {
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName]); // re-run when store userName changes (e.g. after DB restore)

  // Fetch report if session data exists but store hasn't loaded real data yet
  useEffect(() => {
    const raw = sessionStorage.getItem("kundliRequest");
    if (!raw) return;
    try {
      const req: ReportRequest = JSON.parse(raw);
      fetchReport(req);
    } catch {
      // Malformed JSON — ignore
    }
  }, [fetchReport]);

  // Persist birth details for users who signed in via /kundali-auth, which
  // OAuths back to this page. That flow wrote nothing, so the user ended up
  // authenticated with no user_profiles row — onboarding_done stayed false, the
  // /payment guard bounced them to /auth, and payment could never be recorded.
  // Shared with KundaliAuthPage's chat-intent flow, so both entry points write
  // the same rows — upsert, safe to repeat, guards read it on next refetch.
  useEffect(() => {
    if (authLoading || !user) return;
    persistGuestBirthDetails(user.id).then((saved) => {
      if (saved) queryClient.invalidateQueries({ queryKey: [USER_STATUS_KEY, user.id] });
    });
  }, [user, authLoading, queryClient]);

  // Generate AI summary once we have data
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, scores, dasha, insights, chart]);

  // Fallback: if sessionStorage is empty but the user is authenticated,
  // load their most recent saved kundali from Supabase and re-hydrate the store.
  // This prevents existing users from seeing the onboarding empty state on
  // a fresh tab or after a page reload that cleared sessionStorage.
  const setReport = useReportStore((s) => s.setReport);
  const [restoringFromDb, setRestoringFromDb] = useState(false);
  useEffect(() => {
    if (hasRealData || reportLoading || !user) return;
    let cancelled = false;
    setRestoringFromDb(true);

    (async () => {
      try {
        const records = await getUserKundalis(user.id);
        if (cancelled || records.length === 0) {
          if (!cancelled) setRestoringFromDb(false);
          return;
        }

        const latest = records[0];
        // Reconstruct a minimal ReportResponse shape from the DB record
        const report = {
          scores: latest.scores,
          dasha: latest.dasha,
          transits: latest.transits ?? null,
          d1_chart: latest.d1_chart,
          timeline: latest.timeline ?? null,
        };

        // Rebuild sessionStorage keys so subsequent fetchReport calls are no-ops
        const req: ReportRequest = {
          full_name: latest.full_name ?? "",
          birth_date: latest.birth_date,
          birth_time: latest.birth_time,
          birth_place: latest.birth_place ?? "",
          latitude: 0,
          longitude: 0,
        };
        sessionStorage.setItem("kundliReport", JSON.stringify(report));
        sessionStorage.setItem("kundliRequest", JSON.stringify(req));
        sessionStorage.setItem("lastKundaliId", latest.id);
        if (latest.share_slug) {
          sessionStorage.setItem("lastKundaliSlug", latest.share_slug);
        }

        const birthYear = latest.birth_date
          ? new Date(latest.birth_date).getFullYear()
          : undefined;

        if (!cancelled) {
          setReport(report as Parameters<typeof setReport>[0], latest.full_name ?? "", birthYear);
        }
      } catch {
        // Non-critical — silently ignore, user will see empty state
      } finally {
        if (!cancelled) setRestoringFromDb(false);
      }
    })();

    return () => { cancelled = true; };
  }, [hasRealData, reportLoading, user, setReport]);

  // Scroll to hash section on mount (e.g. /kundali#kundali-risks)
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      // Small delay to let the DOM render
      const timer = setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, []);

  /* ── PDF Download — direct live-DOM capture at forced desktop width ── */
  /* Temporarily forces the page to desktop width (1280px) AND injects CSS overrides
     so that all Tailwind responsive breakpoints (sm:, md:, lg:, xl:) activate as if
     the viewport is 1280px. Captures the full page as one image, then slices it into
     standard A4 landscape pages for a professional PDF look. */
  const handleDownloadPdf = useCallback(async () => {
    // AF-088 diagnostic switch. Off unless explicitly enabled in devtools:
    //   localStorage.setItem("vedicfinance:pdfDebug", "1")
    // When on, every intermediate raster is downloaded alongside the PDF so the
    // blurred region can be located precisely instead of guessed at.
    const pdfDebug = (() => {
      try { return localStorage.getItem("vedicfinance:pdfDebug") === "1"; } catch { return false; }
    })();

    // Use ref as primary guard — immune to stale closure issues on rapid double-click
    if (pdfInProgressRef.current) return;
    pdfInProgressRef.current = true;
    // After the guard, so a double-tap counts once. One call covers all three
    // download buttons (sidebar expanded, sidebar collapsed, page header).
    analytics({ 'gtm.text': 'Kundali_DownloadPDF' });
    setIsGeneratingPdf(true);
    setPdfStep("Preparing layout…");

    // Theme-aware background colors
    const isVedic = theme === "vedic";
    const pdfBgColor = isVedic ? "#FFFCF5" : "#080310";
    const pdfBgRgb: [number, number, number] = isVedic ? [255, 252, 245] : [8, 3, 16];

    try {
      // Lazy-load heavy libraries
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);

      const mainEl = mainRef.current;
      if (!mainEl) throw new Error("Main content not found");

      const CAPTURE_WIDTH = 1280;
      // Custom page size: 297mm wide × 350mm tall (taller than A4 to fit sections better)
      const PDF_PAGE_WIDTH_MM = 297;
      const PDF_PAGE_HEIGHT_MM = 350;

      // ─── Step 1: Inject CSS to force all responsive breakpoints to desktop ───
      // This is the critical fix: Tailwind responsive classes use @media (min-width),
      // which checks the VIEWPORT, not the element width. On mobile the viewport is
      // still 390px even if we force the element to 1280px. By injecting these
      // overrides we make sm:, md:, lg:, xl: classes always apply.
      const pdfStyleEl = document.createElement("style");
      pdfStyleEl.id = "pdf-desktop-overrides";
      pdfStyleEl.textContent = `
        /* ── PDF CAPTURE: freeze animation + flatten compositing (AF-088) ──
           html-to-image captures whatever frame the page happens to be on.
           The Vedic shimmer (.vedic-theme main .rounded-2xl::before) sweeps a
           half-width, full-height translucent band across every card at up to
           opacity 1, so an unlucky capture bakes a wash band over the content.
           Freezing all animation also makes the export deterministic — two
           downloads of the same chart now produce the same pixels.

           backdrop-filter is dropped for a different reason: html-to-image
           renders through an SVG foreignObject where backdrop sampling is
           unreliable, and a static page has no live backdrop to blur anyway.
           IncomeConstellation's tooltip already hard-codes this opt-out. */
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
        }
        * {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        /* ── PDF CAPTURE: Force desktop responsive behavior ── */
        /* Override Tailwind breakpoint-based visibility */
        .hidden.sm\\:block, .hidden.sm\\:flex, .hidden.sm\\:grid,
        .hidden.sm\\:inline, .hidden.sm\\:inline-block, .hidden.sm\\:inline-flex,
        .hidden.md\\:block, .hidden.md\\:flex, .hidden.md\\:grid,
        .hidden.md\\:inline, .hidden.md\\:inline-block, .hidden.md\\:inline-flex,
        .hidden.lg\\:block, .hidden.lg\\:flex, .hidden.lg\\:grid,
        .hidden.lg\\:inline, .hidden.lg\\:inline-block, .hidden.lg\\:inline-flex,
        .hidden.xl\\:block, .hidden.xl\\:flex, .hidden.xl\\:grid,
        .hidden.xl\\:inline, .hidden.xl\\:inline-block, .hidden.xl\\:inline-flex {
          display: revert !important;
        }
        /* Force sm:hidden, md:hidden, lg:hidden elements to stay hidden */
        .sm\\:hidden, .md\\:hidden, .lg\\:hidden, .xl\\:hidden {
          display: none !important;
        }
        /* Force lg grid layouts */
        .lg\\:grid-cols-\\[3fr_2fr\\] { grid-template-columns: 3fr 2fr !important; }
        .lg\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .lg\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        .lg\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
        .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        .sm\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .sm\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        /* Force md/lg flex direction */
        .lg\\:flex-row { flex-direction: row !important; }
        .md\\:flex-row { flex-direction: row !important; }
        .lg\\:flex-col { flex-direction: column !important; }
        .lg\\:items-center { align-items: center !important; }
        .lg\\:items-start { align-items: flex-start !important; }
        .lg\\:text-left { text-align: left !important; }
        /* Force md divide utilities (e.g. ScamRiskSection 3-panel grid) */
        .md\\:divide-y-0 > :not([hidden]) ~ :not([hidden]) { border-top-width: 0 !important; }
        .md\\:divide-x > :not([hidden]) ~ :not([hidden]) { border-right-width: 0 !important; border-left-width: 1px !important; }
        /* Force md gap */
        .md\\:gap-0 { gap: 0 !important; }
        /* Force lg gap/padding/margin */
        .lg\\:gap-8 { gap: 2rem !important; }
        .lg\\:gap-12 { gap: 3rem !important; }
        .lg\\:px-14 { padding-left: 3.5rem !important; padding-right: 3.5rem !important; }
        .lg\\:py-10 { padding-top: 2.5rem !important; padding-bottom: 2.5rem !important; }
        .lg\\:pt-12 { padding-top: 3rem !important; }
        .lg\\:pb-10 { padding-bottom: 2.5rem !important; }
        .lg\\:mb-10 { margin-bottom: 2.5rem !important; }
        /* Force sm/md spacing that should be active */
        .sm\\:px-6 { padding-left: 1.5rem !important; padding-right: 1.5rem !important; }
        .sm\\:px-10 { padding-left: 2.5rem !important; padding-right: 2.5rem !important; }
        .sm\\:py-8 { padding-top: 2rem !important; padding-bottom: 2rem !important; }
        .sm\\:py-20 { padding-top: 5rem !important; padding-bottom: 5rem !important; }
        .sm\\:pt-10 { padding-top: 2.5rem !important; }
        .sm\\:pb-20 { padding-bottom: 5rem !important; }
        .sm\\:gap-6 { gap: 1.5rem !important; }
        .sm\\:gap-8 { gap: 2rem !important; }
        .sm\\:mb-8 { margin-bottom: 2rem !important; }
        .sm\\:mb-12 { margin-bottom: 3rem !important; }
        .md\\:px-10 { padding-left: 2.5rem !important; padding-right: 2.5rem !important; }
        .md\\:mb-16 { margin-bottom: 4rem !important; }
        .md\\:gap-4 { gap: 1rem !important; }
        /* Force lg width/display for sidebar-related elements during capture */
        .lg\\:block { display: block !important; }
        /* Hide mobile-only elements */
        .lg\\:hidden { display: none !important; }
        /* Force sm:block for elements that should show on desktop */
        .sm\\:block { display: block !important; }
        .sm\\:flex { display: flex !important; }
        /* Force text sizes */
        .sm\\:text-2xl { font-size: 1.5rem !important; line-height: 2rem !important; }
        .sm\\:text-3xl { font-size: 1.875rem !important; line-height: 2.25rem !important; }
        .md\\:text-4xl { font-size: 2.25rem !important; line-height: 2.5rem !important; }
        .lg\\:text-5xl { font-size: 3rem !important; line-height: 1 !important; }
        .sm\\:text-base { font-size: 1rem !important; line-height: 1.5rem !important; }
        /* Scroll margin for lg */
        .lg\\:scroll-mt-6 { scroll-margin-top: 1.5rem !important; }
        /* Negative margins for full-bleed sections — remove them during capture
           to prevent content from extending beyond the container width */
        .lg\\:-mx-14, .md\\:-mx-10, .sm\\:-mx-6 {
          margin-left: 0 !important;
          margin-right: 0 !important;
        }
      `;
      document.head.appendChild(pdfStyleEl);

      // ─── Step 2: Force the page to desktop width for consistent capture ───
      const scrollContainer = mainEl.closest(".flex-1.overflow-y-auto") as HTMLElement || mainEl.parentElement as HTMLElement;
      const originalStyles = {
        mainWidth: mainEl.style.width,
        mainMinWidth: mainEl.style.minWidth,
        mainMaxWidth: mainEl.style.maxWidth,
        mainOverflow: mainEl.style.overflow,
        mainPosition: mainEl.style.position,
        mainLeft: mainEl.style.left,
        mainTop: mainEl.style.top,
        bodyOverflow: document.body.style.overflow,
        scrollContainerWidth: scrollContainer?.style.width || "",
        scrollContainerMinWidth: scrollContainer?.style.minWidth || "",
        scrollContainerOverflow: scrollContainer?.style.overflow || "",
        scrollContainerPosition: scrollContainer?.style.position || "",
        scrollContainerClip: scrollContainer?.style.clipPath || "",
      };

      // Move the content off-screen so the user doesn't see the expansion
      if (scrollContainer && scrollContainer !== mainEl) {
        scrollContainer.style.position = "fixed";
        scrollContainer.style.clipPath = "inset(0)";
      }

      // Force desktop width on the content area
      mainEl.style.width = `${CAPTURE_WIDTH}px`;
      mainEl.style.minWidth = `${CAPTURE_WIDTH}px`;
      mainEl.style.maxWidth = `${CAPTURE_WIDTH}px`;
      mainEl.style.overflow = "visible";
      mainEl.style.position = "absolute";
      mainEl.style.left = "-9999px";
      mainEl.style.top = "0";
      if (scrollContainer && scrollContainer !== mainEl) {
        scrollContainer.style.width = `${CAPTURE_WIDTH}px`;
        scrollContainer.style.minWidth = `${CAPTURE_WIDTH}px`;
        scrollContainer.style.overflow = "visible";
      }
      document.body.style.overflow = "visible";

      // Hide elements that shouldn't appear in PDF.
      //
      // Only [data-pdf-hide] is needed. There used to be a
      // `button[title='Download report as PDF']` clause here; it never matched
      // anything. The export/share controls live in the sidebar and header,
      // which are siblings of <main> and therefore outside `mainEl` entirely —
      // and the button's title is "Download PDF" (in fact "Generating PDF…"
      // while a capture is running), so a title selector would not match even
      // if the scope were right. Use data-pdf-hide for anything new.
      const hideSelectors = "[data-pdf-hide]";
      const hiddenEls: HTMLElement[] = [];
      mainEl.querySelectorAll(hideSelectors).forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.dataset.pdfOrigDisplay = htmlEl.style.display;
        htmlEl.style.display = "none";
        hiddenEls.push(htmlEl);
      });

      // Force all framer-motion elements to be visible.
      //
      // These are inline styles written by framer-motion, so the `animation:
      // none` rule above does not reach them. An element stuck at its `initial`
      // state carries BOTH opacity and a transform — e.g.
      // `initial={{ opacity: 0, y: 24 }}` or `{ opacity: 0, scale: 0.8 }`.
      // Resetting opacity alone left the element offset or shrunk in the PDF
      // (the risk badge above "Peak ( 20xx )" was rendering at scale 0.8), so
      // clear the transform too and restore both afterwards.
      const opacityFixed: { el: HTMLElement; opacity: string; transform: string }[] = [];
      mainEl.querySelectorAll("[style]").forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.style.opacity === "0") {
          opacityFixed.push({
            el: htmlEl,
            opacity: htmlEl.style.opacity,
            transform: htmlEl.style.transform,
          });
          htmlEl.style.opacity = "1";
          htmlEl.style.transform = "none";
        }
      });

      // Wait for reflow at new width with CSS overrides applied
      await new Promise((resolve) => setTimeout(resolve, 600));

      // ─── Step 2b: Pre-encode all images to data URIs ───────────────────────
      // On mobile browsers, html-to-image's canvas serialization may silently
      // drop images whose src is a hashed Vite asset path. Pre-encoding them
      // as base64 data URIs before capture ensures every image appears in the PDF.
      // We also retry once on failure and verify each image decoded correctly.
      setPdfStep("Loading images…");

      const captureWrapper = mainEl.querySelector(".relative.z-10") as HTMLElement;
      const captureTarget = captureWrapper || mainEl;
      const imgEls = Array.from(captureTarget.querySelectorAll("img")) as HTMLImageElement[];
      const imgOrigSrcs: { el: HTMLImageElement; src: string }[] = [];

      // Helper: fetch one URL and return a data URI, with one retry on failure
      const fetchAsDataUri = async (url: string): Promise<string | null> => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const resp = await fetch(url, { cache: attempt === 0 ? "force-cache" : "no-cache" });
            if (!resp.ok) continue;
            const blob = await resp.blob();
            const reader = new FileReader();
            return await new Promise<string>((res, rej) => {
              reader.onload = () => res(reader.result as string);
              reader.onerror = rej;
              reader.readAsDataURL(blob);
            });
          } catch {
            // retry
          }
        }
        return null;
      };

      await Promise.allSettled(
        imgEls.map(async (img) => {
          const originalSrc = img.src;
          if (!originalSrc || originalSrc.startsWith("data:")) return; // already encoded
          const dataUri = await fetchAsDataUri(originalSrc);
          if (!dataUri) {
            console.warn("[PDF] Failed to encode image:", originalSrc);
            return;
          }
          imgOrigSrcs.push({ el: img, src: originalSrc });
          img.src = dataUri;
        }),
      );

      // ─── Step 2b-verify: Wait for every swapped image to fully decode ──────
      // After changing img.src the browser must re-decode the data URI.
      // On mobile this is async — we must wait or the canvas capture sees a blank.
      setPdfStep("Verifying images…");

      if (imgOrigSrcs.length > 0) {
        await Promise.allSettled(
          imgOrigSrcs.map(({ el: img }) =>
            img.decode().catch(() => {
              // decode() not supported in all browsers — fall back to load event
              return new Promise<void>((resolve) => {
                if (img.complete && img.naturalWidth > 0) { resolve(); return; }
                img.onload = () => resolve();
                img.onerror = () => resolve(); // still proceed even if broken
                setTimeout(resolve, 2000); // hard timeout so we never hang
              });
            }),
          ),
        );
      }

      // ─── Step 2b-check: Log any images that still have 0-size after decode ─
      const missingImgs = imgEls.filter(
        (img) => img.src && !img.src.startsWith("data:") || (img.complete && img.naturalWidth === 0),
      );
      if (missingImgs.length > 0) {
        console.warn(`[PDF] ${missingImgs.length} image(s) could not be pre-encoded and may be blank in PDF:`,
          missingImgs.map((img) => img.src || img.alt));
      }

      // ─── Step 2c: Replace object-cover images with background-image divs ──
      // On mobile, html-to-image fails to render <imgloading="lazy" decoding="async"> with object-fit:cover
      // inside overflow:hidden containers. Swapping to a <div> with
      // background-image + background-size:cover renders reliably on all devices.
      //
      // IMPORTANT: getBoundingClientRect() returns 0×0 for elements that are
      // positioned off-screen (left:-9999px). We use offsetWidth/offsetHeight
      // instead, which reflects layout dimensions regardless of viewport position.
      // If those are also 0 (element not yet laid out), we fall back to the
      // parent's offsetWidth and an explicit pixel height from the img's CSS.
      const objectCoverSwaps: { img: HTMLImageElement; placeholder: HTMLDivElement; parent: HTMLElement }[] = [];
      imgEls.forEach((img) => {
        const style = window.getComputedStyle(img);
        if (style.objectFit !== "cover") return;
        const parent = img.parentElement;
        if (!parent) return;

        // Prefer offsetWidth/Height (layout dimensions, viewport-independent)
        let w = img.offsetWidth;
        let h = img.offsetHeight;

        // Fallback: use parent dimensions when the img itself reports 0
        if (w === 0) w = parent.offsetWidth;
        if (h === 0) {
          // Try parsing an explicit height from computed style
          const parsedH = parseFloat(style.height);
          h = isFinite(parsedH) && parsedH > 0 ? parsedH : parent.offsetHeight;
        }

        // Last resort: use a sensible minimum so the image area is never invisible
        if (w === 0) w = 100;
        if (h === 0) h = 100;

        const div = document.createElement("div");
        div.style.width = `${w}px`;
        div.style.height = `${h}px`;
        div.style.backgroundImage = `url(${img.src})`;
        div.style.backgroundSize = "cover";
        div.style.backgroundPosition = "center";
        div.style.backgroundRepeat = "no-repeat";
        div.style.display = "block";
        div.setAttribute("role", "img");
        div.setAttribute("aria-label", img.alt || "");
        parent.replaceChild(div, img);
        objectCoverSwaps.push({ img, placeholder: div, parent });
      });

      // Brief settle after DOM swap — give browser a frame to apply the div styles
      await new Promise((resolve) => setTimeout(resolve, 150));

      // ─── Step 3: Capture the entire content area as one tall image ───
      setPdfStep("Rendering PDF…");

      const fullDataUrl = await toPng(captureTarget, {
        backgroundColor: pdfBgColor,
        pixelRatio: 2,
        cacheBust: true,
        skipFonts: false,
        width: CAPTURE_WIDTH,
        height: captureTarget.scrollHeight,
        style: {
          transform: "none",
          width: `${CAPTURE_WIDTH}px`,
          overflow: "visible",
        },
      });

      // AF-088 diagnostic: dumping the intermediate raster separates a
      // capture-side fault (the PNG is already blurred) from a placement-side
      // one (only the PDF page is). Enable with:
      //   localStorage.setItem("vedicfinance:pdfDebug", "1")
      if (pdfDebug) {
        pdfDebugDump("full-capture", fullDataUrl);
        console.info("[pdfDebug] captureTarget", {
          tag: captureTarget.tagName,
          className: captureTarget.className,
          usedFallback: captureTarget === mainEl,
          scrollHeight: captureTarget.scrollHeight,
          offsetWidth: captureTarget.offsetWidth,
          CAPTURE_WIDTH,
          pixelRatio: 2,
        });
        console.info(
          "[pdfDebug] object-cover swaps",
          objectCoverSwaps.map(({ placeholder, img }) => ({
            src: img.src.slice(0, 80),
            w: placeholder.style.width,
            h: placeholder.style.height,
            // A 100x100 box means every dimension probe failed and the image is
            // being upscaled from a guess — the prime blur suspect.
            suspect: placeholder.style.width === "100px" || placeholder.style.height === "100px",
          })),
        );
      }

      const fullImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = fullDataUrl;
      });

      // ─── Step 3b: Detect section boundaries while layout is still forced ───
      const sectionIds = ["kundali-earnings", "kundali-timings", "kundali-investments", "kundali-risks"];
      const captureTop = captureTarget.getBoundingClientRect().top;
      const pixelRatio = 2; // matches toPng pixelRatio

      const sectionBreaks: number[] = [];
      for (const id of sectionIds) {
        const el = captureTarget.querySelector(`#${id}`) as HTMLElement | null;
        if (el) {
          const rect = el.getBoundingClientRect();
          const yInCapture = Math.round((rect.top - captureTop) * pixelRatio);
          sectionBreaks.push(yInCapture);
        }
      }
      sectionBreaks.sort((a, b) => a - b);

      // ─── Step 4: Restore original layout ───
      setPdfStep("Building pages…");
      pdfStyleEl.remove();

      mainEl.style.width = originalStyles.mainWidth;
      mainEl.style.minWidth = originalStyles.mainMinWidth;
      mainEl.style.maxWidth = originalStyles.mainMaxWidth;
      mainEl.style.overflow = originalStyles.mainOverflow;
      mainEl.style.position = originalStyles.mainPosition;
      mainEl.style.left = originalStyles.mainLeft;
      mainEl.style.top = originalStyles.mainTop;
      document.body.style.overflow = originalStyles.bodyOverflow;
      if (scrollContainer && scrollContainer !== mainEl) {
        scrollContainer.style.width = originalStyles.scrollContainerWidth;
        scrollContainer.style.minWidth = originalStyles.scrollContainerMinWidth;
        scrollContainer.style.overflow = originalStyles.scrollContainerOverflow;
        scrollContainer.style.position = originalStyles.scrollContainerPosition;
        scrollContainer.style.clipPath = originalStyles.scrollContainerClip;
      }

      hiddenEls.forEach((el) => {
        el.style.display = el.dataset.pdfOrigDisplay || "";
        delete el.dataset.pdfOrigDisplay;
      });

      opacityFixed.forEach(({ el, opacity, transform }) => {
        el.style.opacity = opacity;
        el.style.transform = transform;
      });

      // Restore object-cover img elements (swapped to background-image divs for capture)
      objectCoverSwaps.forEach(({ img, placeholder, parent }) => {
        parent.replaceChild(img, placeholder);
      });

      // Restore original img srcs (swapped to base64 for capture)
      imgOrigSrcs.forEach(({ el, src }) => {
        el.src = src;
      });

      // ─── Step 5: Slice the full image into pages using section boundaries ───
      // Instead of blindly slicing at fixed A4 height intervals (which cuts sections),
      // we detect where each major section starts and place page breaks between them.
      const imgWidth = fullImg.width;
      const imgHeight = fullImg.height;

      // A4 landscape ratio: 297:210
      const pageAspect = PDF_PAGE_WIDTH_MM / PDF_PAGE_HEIGHT_MM;
      const maxPageHeightPx = Math.round(imgWidth / pageAspect);

      // Build page slices: for each page, find the best break point
      // A page can be at most maxPageHeightPx tall. We try to break at a section boundary.
      const pageSlices: { srcY: number; srcH: number }[] = [];
      let currentY = 0;
      let isFirstPage = true;

      while (currentY < imgHeight) {
        const remaining = imgHeight - currentY;
        if (remaining <= maxPageHeightPx) {
          // Last page — take whatever is left
          pageSlices.push({ srcY: currentY, srcH: remaining });
          break;
        }

        // For the first page, ensure we include the header + first section
        // by only considering breaks at the 2nd section onwards
        const minBreakY = isFirstPage && sectionBreaks.length >= 2
          ? sectionBreaks[1] // Don't break before the 2nd section
          : currentY + maxPageHeightPx * 0.25;

        // Find the best section break that fits within this page
        const pageEnd = currentY + maxPageHeightPx;
        // Look for the last section break that starts before pageEnd
        // We want to break BEFORE a section starts (so the section goes to next page)
        let bestBreak = -1;
        for (const breakY of sectionBreaks) {
          if (breakY >= minBreakY && breakY <= pageEnd) {
            bestBreak = breakY;
          }
        }

        if (bestBreak > 0) {
          // Break at the section boundary
          pageSlices.push({ srcY: currentY, srcH: bestBreak - currentY });
          currentY = bestBreak;
        } else {
          // No good section break found — use full page height
          pageSlices.push({ srcY: currentY, srcH: maxPageHeightPx });
          currentY += maxPageHeightPx;
        }

        isFirstPage = false;
      }

      if (pdfDebug) {
        console.info("[pdfDebug] slicing", {
          imgWidth,
          imgHeight,
          maxPageHeightPx,
          pageAspect,
          sectionBreaks,
          pageSlices,
          // Any page whose slice is taller than a full page gets squashed by the
          // Math.min clamp below — non-proportional scaling, i.e. distortion.
          squashedPages: pageSlices
            .map(({ srcH }, i) => ({ page: i, sliceHeightMm: (srcH / imgWidth) * PDF_PAGE_WIDTH_MM }))
            .filter(({ sliceHeightMm }) => sliceHeightMm > PDF_PAGE_HEIGHT_MM + 0.5),
        });
      }

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: [PDF_PAGE_WIDTH_MM, PDF_PAGE_HEIGHT_MM],
      });

      for (let page = 0; page < pageSlices.length; page++) {
        if (page > 0) pdf.addPage([PDF_PAGE_WIDTH_MM, PDF_PAGE_HEIGHT_MM], "p");

        const { srcY, srcH } = pageSlices[page];

        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = imgWidth;
        sliceCanvas.height = srcH;
        const ctx = sliceCanvas.getContext("2d")!;

        // Fill with background color
        ctx.fillStyle = pdfBgColor;
        ctx.fillRect(0, 0, imgWidth, srcH);

        // Draw the slice from the full image
        ctx.drawImage(
          fullImg,
          0, srcY, imgWidth, srcH,
          0, 0, imgWidth, srcH,
        );

        const sliceDataUrl = sliceCanvas.toDataURL("image/png");
        if (pdfDebug) pdfDebugDump(`page-${page + 1}`, sliceDataUrl);

        // Fill PDF page background
        pdf.setFillColor(...pdfBgRgb);
        pdf.rect(0, 0, PDF_PAGE_WIDTH_MM, PDF_PAGE_HEIGHT_MM, "F");

        // Calculate the height in mm proportional to the slice height
        const sliceHeightMm = (srcH / imgWidth) * PDF_PAGE_WIDTH_MM;
        // Place image at top, maintaining aspect ratio
        pdf.addImage(
          sliceDataUrl, "PNG",
          0, 0,
          PDF_PAGE_WIDTH_MM, Math.min(sliceHeightMm, PDF_PAGE_HEIGHT_MM),
          undefined, "FAST",
        );
      }

      const name = userName ? `${userName}-Financial-Kundali` : "Financial-Kundali";
      pdf.save(`${name}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      document.getElementById("pdf-desktop-overrides")?.remove();
      alert(
        "Could not generate PDF. Please try again, or use your browser's print dialog (Cmd/Ctrl+P).",
      );
    } finally {
      pdfInProgressRef.current = false;
      setIsGeneratingPdf(false);
      setPdfStep("");
    }
  }, [userName, theme, setPdfStep]);

  // Track which section is currently in view for sidebar highlighting
  const [activeSection, setActiveSection] = useState("kundali-overview");

  useEffect(() => {
    if (!hasRealData) return;

    const sectionIds = ["kundali-earnings", "kundali-timings", "kundali-investments", "kundali-risks"];
    const observers: IntersectionObserver[] = [];

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      sectionIds.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;

        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                setActiveSection(id);
              }
            });
          },
          {
            root: mainRef.current,
            rootMargin: "-20% 0px -60% 0px",
            threshold: 0,
          }
        );
        observer.observe(el);
        observers.push(observer);
      });
    }, 500);

    return () => {
      clearTimeout(timer);
      observers.forEach((obs) => obs.disconnect());
    };
  }, [hasRealData]);

  const handleSidebarSelect = useCallback(
    (id: string) => {
      const scrollContainer = mainRef.current;
      if (!scrollContainer) return;

      // "kundali-overview" scrolls back to the very top
      if (id === "kundali-overview") {
        scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
        setActiveSection("kundali-overview");
        return;
      }

      // All kundali-* subitems scroll to the matching section
      if (id.startsWith("kundali-")) {
        const el = document.getElementById(id);
        if (!el) return;

        // Calculate offset within the scroll container, then subtract the
        // mobile fixed header height (≈52 px on small screens, 0 on desktop)
        // so the section title is never hidden behind the top bar.
        const isMobile = window.innerWidth < 1024; // lg breakpoint
        const headerOffset = isMobile ? 56 : 0;

        const containerRect = scrollContainer.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const targetTop =
          scrollContainer.scrollTop +
          (elRect.top - containerRect.top) -
          headerOffset -
          8; // 8px breathing room

        scrollContainer.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
        setActiveSection(id);
        return;
      }

      // Upcoming insights — navigate to the upcoming-features page (top).
      // Carry the shared-view flag in router state so /upcoming-features keeps
      // the limited sidebar when reached from a shared kundali link.
      if (id.startsWith("upcoming-")) {
        const isShared = window.location.pathname.startsWith("/shared/");
        navigate("/upcoming-features", isShared ? { state: { isSharedView: true } } : undefined);
        return;
      }
    },
    [navigate],
  );

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-500 ${theme === "vedic" ? "vedic-theme" : ""}`} style={{ background: colors.pageBg }}>
      {/* PDF Generation Overlay */}
      {!isEmbed && isGeneratingPdf && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: theme === "vedic" ? "rgba(255,252,245,0.92)" : "rgba(8,3,16,0.92)", backdropFilter: "blur(8px)" }}>
          <div className="flex flex-col items-center gap-6 px-8 py-10 rounded-2xl" style={{ background: theme === "vedic" ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.04)", border: `1px solid ${theme === "vedic" ? "rgba(184,134,11,0.2)" : "rgba(255,255,255,0.08)"}` }}>
            {/* Animated spinner */}
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent" style={{ borderTopColor: "#F2C572", borderRightColor: "#F2C572", animation: "spin 1s linear infinite" }} />
              <div className="absolute inset-2 rounded-full border-[2px] border-transparent" style={{ borderBottomColor: theme === "vedic" ? "#C6930A" : "#FFDFA3", borderLeftColor: theme === "vedic" ? "#C6930A" : "#FFDFA3", animation: "spin 1.5s linear infinite reverse" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Download className="h-5 w-5" style={{ color: "#F2C572" }} />
              </div>
            </div>
            {/* Status text */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-base font-semibold" style={{ color: theme === "vedic" ? "#5C3D00" : "#F5E9FF", fontFamily: "'Poppins', sans-serif" }}>
                Generating your Kundali PDF
              </p>
              <p className="text-sm" style={{ color: theme === "vedic" ? "#8B6914" : "#A89BC8" }}>
                {pdfStep || "This may take a few seconds…"}
              </p>
              {/* Step dots — one dot per step, fills left-to-right */}
              <div className="flex items-center gap-1.5 mt-1">
                {["Preparing layout…", "Loading images…", "Verifying images…", "Rendering PDF…", "Building pages…"].map((step) => (
                  <div
                    key={step}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: pdfStep === step ? "20px" : "6px",
                      background: pdfStep === step
                        ? "#F2C572"
                        : theme === "vedic" ? "rgba(184,134,11,0.2)" : "rgba(255,255,255,0.12)",
                    }}
                  />
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Sidebar — desktop */}
      {!isEmbed && (
      <div
        className="hidden lg:block shrink-0 h-full transition-all duration-300"
        style={{ width: sidebarCollapsed ? "60px" : "240px" }}
      >
        <KundaliSidebar
          active={activeSection}
          onSelect={handleSidebarSelect}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onGoHome={() => navigate("/")}
          onAiChat={openChat}
          onDownloadPdf={handleDownloadPdf}
          isDownloadingPdf={isGeneratingPdf}
          userName={userName}
        />
      </div>
      )}

      {/* Mobile header */}
      {!isEmbed && (
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 transition-colors duration-500 backdrop-blur-md"
        style={{
          background: theme === "vedic" ? "rgba(255,252,245,0.92)" : "rgba(8,3,16,0.95)",
          borderBottom: `1px solid ${theme === "vedic" ? "rgba(184,134,11,0.15)" : "rgba(255,255,255,0.06)"}`,
        }}
      >
        {/* Left: hamburger + name */}
        <div className="flex items-center gap-2 z-10">
          <button onClick={() => setMobileMenuOpen(true)} className="p-1">
            <Menu className="h-5 w-5 transition-colors duration-500" style={{ color: theme === "vedic" ? "#8B6914" : "rgba(255,255,255,0.5)" }} />
          </button>
          <Link
            to="/"
            className="text-sm font-bold hover:opacity-80 transition-opacity"
            style={{ color: "#F2C572", fontFamily: "'Poppins', sans-serif" }}
          >
            VedicFinance
          </Link>
        </div>
        {/* Right: theme switcher + download */}
        <div className="flex items-center gap-2 z-10">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg transition-all duration-300"
            style={{
              background: theme === "vedic" ? "rgba(198,147,10,0.08)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${theme === "vedic" ? "rgba(198,147,10,0.15)" : "rgba(255,255,255,0.08)"}`,
            }}
            title={theme === "vedic" ? "Switch to Cosmic theme" : "Switch to Vedic theme"}
          >
            {theme === "vedic" ? (
              <Moon className="h-4 w-4" style={{ color: "rgba(198,147,10,0.5)" }} />
            ) : (
              <Sun className="h-4 w-4" style={{ color: "#F2C572" }} />
            )}
          </button>
          {/* Download PDF */}
          {user ? (
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #F2C572, #FFDFA3)",
              color: "#2A0E4A",
              boxShadow: "0 2px 10px rgba(242,197,114,0.4)",
            }}
            title={isGeneratingPdf ? "Generating PDF…" : "Download PDF"}
          >
            {isGeneratingPdf ? (
              <svg className="h-3.5 w-3.5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <Download className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{isGeneratingPdf ? "…" : "Download"}</span>
          </button>
          ) : (
            <AuthGate feature="Download" mode="inline" />
          )}
        </div>
      </div>
      )}

      {/* Mobile sidebar overlay */}
      {!isEmbed && mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-[260px]">
            <KundaliSidebar
              active={activeSection}
              onSelect={(id) => {
                setMobileMenuOpen(false);
                handleSidebarSelect(id);
              }}
              onGoHome={() => navigate("/")}
              onAiChat={openChat}
              onDownloadPdf={handleDownloadPdf}
              isDownloadingPdf={isGeneratingPdf}
              userName={userName}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <MemoParticles
          className="absolute inset-0 z-0 pointer-events-none"
          quantity={30}
          color="#F2C572"
        />

        {/* Loading / empty state — shown when no real data is available */}
        {!hasRealData && (
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6">
            {(reportLoading || authLoading || restoringFromDb) ? (
              <>
                {/* Animated loading spinner */}
                <div className="relative w-20 h-20 mb-8">
                  <div
                    className="absolute inset-0 rounded-full animate-spin"
                    style={{
                      border: "3px solid rgba(242,197,114,0.1)",
                      borderTopColor: "#F2C572",
                    }}
                  />
                  <div
                    className="absolute inset-2 rounded-full animate-spin"
                    style={{
                      border: "2px solid rgba(47,191,159,0.1)",
                      borderTopColor: "#2FBF9F",
                      animationDirection: "reverse",
                      animationDuration: "1.5s",
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl">☽</span>
                  </div>
                </div>
                <h2
                  className="text-xl sm:text-2xl font-bold mb-3 text-center"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    color: "#F5E9FF",
                  }}
                >
                  Generating Your Financial Kundali
                </h2>
                <p
                  className="text-sm text-center max-w-md"
                  style={{ color: "rgba(214,198,245,0.5)" }}
                >
                  Analyzing planetary positions and computing your personalized financial insights…
                </p>
              </>
            ) : (
              <>
                {/* Empty state — no data, not loading */}
                <div className="text-5xl mb-6 opacity-60">✦</div>
                <h2
                  className="text-xl sm:text-2xl font-bold mb-3 text-center"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    color: "#F5E9FF",
                  }}
                >
                  No Kundali Data
                </h2>
                <p
                  className="text-sm text-center max-w-md mb-6"
                  style={{ color: "rgba(214,198,245,0.5)" }}
                >
                  Enter your birth details to generate your personalized Financial Kundali.
                </p>
                <button
                  onClick={() => navigate("/")}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                  style={{
                    background: "linear-gradient(135deg, #F2C572, #FFDFA3)",
                    color: "#2A0E4A",
                    boxShadow: "0 10px 30px rgba(242,197,114,0.3)",
                  }}
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        )}

        {hasRealData && (
        <div
          className="relative z-10 px-4 sm:px-6 md:px-10 lg:px-14 pt-16 sm:pt-10 md:pt-16 pb-8 lg:pt-12 lg:pb-10 max-w-7xl mx-auto"
        >
          {/* Vedic kundali square — repeating background, low opacity, scrolls with content */}
          {theme === "vedic" && (
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

          {/* Vedic corner ornaments — real DOM elements for PDF rendering */}
          {theme === "vedic" && (
            <>
              <img
                src={vedicCornerOrnament}
                alt=""
                className="absolute top-0 left-0 w-[100px] h-[100px] lg:w-[200px] lg:h-[200px] pointer-events-none z-[1]"
                aria-hidden="true"
              loading="lazy" decoding="async" />
              <img
                src={vedicCornerOrnament}
                alt=""
                className="absolute top-0 right-0 w-[100px] h-[100px] lg:w-[200px] lg:h-[200px] pointer-events-none z-[1]"
                style={{ transform: "scaleX(-1)" }}
                aria-hidden="true"
              loading="lazy" decoding="async" />
            </>
          )}
          {/* Page heading */}
          <section
            id="kundali-overview"
            className="mb-6 sm:mb-8 lg:mb-10 relative overflow-visible"
          >
            <div className="flex flex-col xl:flex-row items-center gap-6 sm:gap-8 xl:gap-12 py-6 sm:py-8 xl:py-10 px-6 sm:px-10 xl:px-14">
              {/* Mobile: Zodiac on top, centered */}
              <div className="flex xl:hidden flex-col items-center w-full">
                {/* Zodiac badge */}
                {chart &&
                  (() => {
                    const moon = chart.planets.find((p) => p.planet === "Moon");
                    const moonSign = moon?.sign ?? "—";
                    const signImage = ZODIAC_IMAGE_BY_NAME[moonSign];
                    const isVedic = theme === "vedic";
                    return (
                      <div className="flex flex-col items-center justify-center mb-4">
                        {signImage ? (
                          <img
                            src={signImage}
                            alt={moonSign}
                            className="w-24 h-24 object-contain"
                            style={isVedic ? { filter: "sepia(1) saturate(2) hue-rotate(-10deg) brightness(0.7)" } : undefined}
                          loading="lazy" decoding="async" />
                        ) : (
                          <span className="text-4xl leading-none">☽</span>
                        )}
                        <span
                          className="text-[10px] uppercase tracking-widest mt-1.5 font-semibold"
                          style={{ color: isVedic ? "rgba(139,105,20,0.8)" : "rgba(200,162,255,0.8)" }}
                        >
                          {moonSign}
                        </span>
                      </div>
                    );
                  })()}

                {/* Archetype label */}
                {personalSummary && (() => {
                  const match = personalSummary.match(/"([^"]+)"/);
                  if (match) {
                    const isVedic = theme === "vedic";
                    return (
                      <span
                        className="inline-block text-xs font-bold mb-2"
                        style={{
                          color: isVedic ? "#F2C572" : "#C8A2FF",
                          fontFamily: "'Poppins', sans-serif",
                        }}
                      >
                        "{match[1]}"
                      </span>
                    );
                  }
                  return null;
                })()}

                {/* Title */}
                <h1
                  className="font-bold tracking-tight mb-4 text-center kundali-title-gradient break-words max-w-full"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "clamp(22px, 5.5vw, 32px)",
                    overflowWrap: "anywhere",
                    lineHeight: 1.15,
                    background: "linear-gradient(135deg, #F2C572 0%, #FFDFA3 40%, #F2C572 70%, #D4A84B 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    textShadow: "none",
                    filter: "drop-shadow(0 0 6px rgba(242,197,114,0.25))",
                  }}
                >
                  {userName
                    ? `${userName}'s Financial Kundali`
                    : "Financial Kundali"}
                </h1>

                {/* Summary */}
                <p
                  className="text-xs leading-relaxed text-center max-w-sm mx-auto mb-5"
                  style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.6)" : "rgba(214,198,245,0.55)" }}
                >
                  {personalSummary ? (
                    personalSummary
                  ) : (
                    <span className="inline-block w-40 h-3.5 rounded bg-white/5 animate-pulse" />
                  )}
                </p>

                {/* Birth details row */}
                {birthDetails && (
                  <div className="flex items-center justify-center gap-5 flex-wrap">
                    {birthDetails.date && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: colors.pageBg === "#FFFCF5" ? "rgba(184,134,11,0.06)" : "rgba(242,197,114,0.08)" }}>
                          <Calendar className="w-4 h-4" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(139,105,20,0.7)" : "rgba(242,197,114,0.7)" }} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.5)" : "rgba(214,198,245,0.4)" }}>Birth Date</span>
                          <span className="text-[11px] font-bold" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.85)" : "rgba(245,233,255,0.85)" }}>{birthDetails.date}</span>
                        </div>
                      </div>
                    )}
                    {birthDetails.date && birthDetails.time && (
                      <div className="w-px h-8 rounded-full" style={{ background: colors.pageBg === "#FFFCF5" ? "rgba(184,134,11,0.2)" : "rgba(242,197,114,0.15)" }} />
                    )}
                    {birthDetails.time && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: colors.pageBg === "#FFFCF5" ? "rgba(184,134,11,0.06)" : "rgba(242,197,114,0.08)" }}>
                          <Clock className="w-4 h-4" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(139,105,20,0.7)" : "rgba(242,197,114,0.7)" }} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.5)" : "rgba(214,198,245,0.4)" }}>Birth Time</span>
                          <span className="text-[11px] font-bold" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.85)" : "rgba(245,233,255,0.85)" }}>{birthDetails.time}</span>
                        </div>
                      </div>
                    )}
                    {birthDetails.time && birthDetails.place && (
                      <div className="w-px h-8 rounded-full" style={{ background: colors.pageBg === "#FFFCF5" ? "rgba(184,134,11,0.2)" : "rgba(242,197,114,0.15)" }} />
                    )}
                    {birthDetails.place && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: colors.pageBg === "#FFFCF5" ? "rgba(184,134,11,0.06)" : "rgba(242,197,114,0.08)" }}>
                          <MapPin className="w-4 h-4" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(139,105,20,0.7)" : "rgba(242,197,114,0.7)" }} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.5)" : "rgba(214,198,245,0.4)" }}>Location</span>
                          <span className="text-[11px] font-bold truncate max-w-[120px]" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.85)" : "rgba(245,233,255,0.85)" }}>{birthDetails.place}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop: Left text + Right zodiac (unchanged) */}
              <div className="hidden xl:block flex-1 min-w-0 text-center xl:text-left">
                {/* Archetype label */}
                {personalSummary && (() => {
                  const match = personalSummary.match(/"([^"]+)"/);
                  if (match) {
                    const isVedic = theme === "vedic";
                    return (
                      <span
                        className="inline-block text-xs sm:text-sm font-bold mb-3"
                        style={{
                          color: isVedic ? "#F2C572" : "#C8A2FF",
                          fontFamily: "'Poppins', sans-serif",
                        }}
                      >
                        "{match[1]}"
                      </span>
                    );
                  }
                  return null;
                })()}

                <h1
                  className="font-bold tracking-tight mb-4 sm:mb-5 kundali-title-gradient break-words max-w-full"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "clamp(22px, 4vw, 40px)",
                    overflowWrap: "anywhere",
                    lineHeight: 1.15,
                    background: "linear-gradient(135deg, #F2C572 0%, #FFDFA3 40%, #F2C572 70%, #D4A84B 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    textShadow: "none",
                    filter: "drop-shadow(0 0 6px rgba(242,197,114,0.25))",
                  }}
                >
                  {userName
                    ? `${userName}'s Financial Kundali`
                    : "Financial Kundali"}
                </h1>

                <p
                  className="text-sm sm:text-base leading-relaxed max-w-2xl"
                  style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.6)" : "rgba(214,198,245,0.55)" }}
                >
                  {personalSummary ? (
                    personalSummary
                  ) : (
                    <span className="inline-block w-40 sm:w-56 h-3.5 rounded bg-white/5 animate-pulse" />
                  )}
                </p>
              </div>

              {/* Vertical divider */}
              <div
                className="hidden xl:block self-stretch w-px"
                style={{ background: theme === "vedic" ? "rgba(184,134,11,0.15)" : "linear-gradient(180deg, transparent, rgba(242,197,114,0.25) 30%, rgba(242,197,114,0.25) 70%, transparent)" }}
              />

              {/* Right: Zodiac badge with birth details — desktop only */}
              <div className="hidden xl:flex items-center gap-4 sm:gap-3 shrink-0 w-[300px] max-w-[300px] sm:flex-col sm:items-center">
                {/* Zodiac badge */}
                {chart &&
                  (() => {
                    const moon = chart.planets.find((p) => p.planet === "Moon");
                    const moonSign = moon?.sign ?? "—";
                    const signImage = ZODIAC_IMAGE_BY_NAME[moonSign];
                    const isVedic = theme === "vedic";
                    return (
                      <div className="flex flex-col items-center justify-center shrink-0">
                        {signImage ? (
                          <img
                            src={signImage}
                            alt={moonSign}
                            className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 object-contain"
                            style={isVedic ? { filter: "sepia(1) saturate(2) hue-rotate(-10deg) brightness(0.7)" } : undefined}
                          loading="lazy" decoding="async" />
                        ) : (
                          <span className="text-4xl leading-none">☽</span>
                        )}
                        <span
                          className="text-[10px] sm:text-sm uppercase tracking-widest mt-1 sm:mt-1.5 font-semibold"
                          style={{ color: isVedic ? "rgba(139,105,20,0.8)" : "rgba(200,162,255,0.8)" }}
                        >
                          {moonSign}
                        </span>
                      </div>
                    );
                  })()}

                {/* Mobile: birth details to the right of zodiac */}
                {birthDetails && (
                  <div className="flex sm:hidden items-center gap-3">
                    <div className="w-px self-stretch min-h-[60px] rounded-full" style={{ background: colors.pageBg === "#FFFCF5" ? "rgba(184,134,11,0.2)" : "linear-gradient(180deg, transparent, rgba(242,197,114,0.3) 30%, rgba(242,197,114,0.3) 70%, transparent)" }} />
                    <div className="flex flex-col gap-1 min-w-0">
                      {birthDetails.name && (
                        <span className="text-[12px] font-bold leading-tight break-words" title={birthDetails.name} style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.9)" : "rgba(245,233,255,0.9)" }}>
                          {birthDetails.name}
                        </span>
                      )}
                      {personalSummary && (() => {
                        const match = personalSummary.match(/"([^"]+)"/);
                        if (match) {
                          return (
                            <span className="text-[10px] font-medium italic leading-tight" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(139,105,20,0.8)" : "rgba(200,162,255,0.7)" }}>
                              {match[1]}
                            </span>
                          );
                        }
                        return null;
                      })()}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                        {birthDetails.date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 shrink-0" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(139,105,20,0.5)" : "rgba(242,197,114,0.5)" }} />
                            <span className="text-[10px] font-medium" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.7)" : "rgba(214,198,245,0.7)" }}>
                              {birthDetails.date}
                            </span>
                          </div>
                        )}
                        {birthDetails.time && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 shrink-0" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(139,105,20,0.5)" : "rgba(242,197,114,0.5)" }} />
                            <span className="text-[10px] font-medium" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.7)" : "rgba(214,198,245,0.7)" }}>
                              {birthDetails.time}
                            </span>
                          </div>
                        )}
                      </div>
                      {birthDetails.place && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(139,105,20,0.5)" : "rgba(242,197,114,0.5)" }} />
                          <span className="text-[10px] font-medium truncate max-w-[140px]" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.7)" : "rgba(214,198,245,0.7)" }}>
                            {birthDetails.place}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Desktop: birth details below the zodiac */}
                {birthDetails && (
                  <div className="hidden sm:flex flex-col items-center gap-2.5 mt-4 w-full min-w-0">
                    {/* Name | Archetype line */}
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 w-full min-w-0">
                      {birthDetails.name && (
                        <span className="text-[11px] sm:text-xs font-semibold break-words text-center max-w-full" title={birthDetails.name} style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.85)" : "rgba(245,233,255,0.85)" }}>
                          {birthDetails.name}
                        </span>
                      )}
                      {birthDetails.name && personalSummary && personalSummary.match(/"([^"]+)"/) && (
                        <div className="w-px h-3.5" style={{ background: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.15)" : "rgba(214,198,245,0.2)" }} />
                      )}
                      {personalSummary && (() => {
                        const match = personalSummary.match(/"([^"]+)"/);
                        if (match) {
                          return (
                            <span className="text-[11px] sm:text-xs font-medium italic" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(139,105,20,0.8)" : "rgba(200,162,255,0.7)" }}>
                              {match[1]}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {/* Date | Time | Place line */}
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 w-full min-w-0">
                      {birthDetails.date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.4)" : "rgba(168,155,200,0.45)" }} />
                          <span className="text-[10px] sm:text-[11px] font-medium" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.7)" : "rgba(214,198,245,0.7)" }}>
                            {birthDetails.date}
                          </span>
                        </div>
                      )}
                      {birthDetails.date && birthDetails.time && (
                        <div className="w-px h-3.5" style={{ background: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.15)" : "rgba(214,198,245,0.2)" }} />
                      )}
                      {birthDetails.time && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.4)" : "rgba(168,155,200,0.45)" }} />
                          <span className="text-[10px] sm:text-[11px] font-medium" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.7)" : "rgba(214,198,245,0.7)" }}>
                            {birthDetails.time} (IST)
                          </span>
                        </div>
                      )}
                      {birthDetails.time && birthDetails.place && (
                        <div className="w-px h-3.5" style={{ background: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.15)" : "rgba(214,198,245,0.2)" }} />
                      )}
                      {birthDetails.place && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.4)" : "rgba(168,155,200,0.45)" }} />
                          <span className="text-[10px] sm:text-[11px] truncate max-w-[160px] font-medium" style={{ color: colors.pageBg === "#FFFCF5" ? "rgba(61,43,31,0.7)" : "rgba(214,198,245,0.7)" }}>
                            {birthDetails.place}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ═══ Section 1: About your Income ═══ */}
          <section
            id="kundali-earnings"
            className="scroll-mt-16 lg:scroll-mt-6 -mx-4 sm:-mx-6 md:-mx-10 lg:-mx-14 px-4 sm:px-6 md:px-10 lg:px-14 pt-8 pb-14 sm:pt-10 sm:pb-20 mb-0"
          >
            {/* Section heading */}
            <div className="max-w-7xl mx-auto">
              <div className="mb-8 sm:mb-12 md:mb-16">
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4 w-full">
                  {/* Left shiny line */}
                  <div className="relative h-[1px] sm:h-[2px] flex-1 overflow-hidden rounded-full">
                    <div
                      className="absolute inset-0"
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, rgba(242,197,114,0.25) 40%, rgba(255,223,163,0.6) 100%)",
                      }}
                    />
                    <div
                      className="absolute inset-y-0 w-full"
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, transparent 20%, rgba(242,197,114,0.8) 45%, rgba(255,223,163,1) 50%, rgba(242,197,114,0.8) 55%, transparent 80%, transparent 100%)",
                        backgroundSize: "200% 100%",
                        animation: "dividerShimmer 4s ease-in-out infinite",
                      }}
                    />
                    <div
                      className="absolute -inset-y-[2px] w-full pointer-events-none"
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, rgba(242,197,114,0.15) 40%, rgba(255,223,163,0.4) 100%)",
                        filter: "blur(4px)",
                      }}
                    />
                  </div>

                  {/* Center label */}
                  <span
                    className="shrink-0 text-xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-[0.06em]"
                    style={{
                      color: "#D6C6F5",
                      fontFamily: "'Cormorant Garamond', 'Playfair Display', serif",
                      fontStyle: "italic",
                      textShadow: "0 0 12px rgba(200,162,255,0.3)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    About your Income
                  </span>

                  {/* Right shiny line */}
                  <div className="relative h-[1px] sm:h-[2px] flex-1 overflow-hidden rounded-full">
                    <div
                      className="absolute inset-0"
                      style={{
                        background: "linear-gradient(90deg, rgba(255,223,163,0.6) 0%, rgba(242,197,114,0.25) 60%, transparent 100%)",
                      }}
                    />
                    <div
                      className="absolute inset-y-0 w-full"
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, transparent 20%, rgba(242,197,114,0.8) 45%, rgba(255,223,163,1) 50%, rgba(242,197,114,0.8) 55%, transparent 80%, transparent 100%)",
                        backgroundSize: "200% 100%",
                        animation: "dividerShimmerReverse 7s ease-in-out infinite",
                      }}
                    />
                    <div
                      className="absolute -inset-y-[2px] w-full pointer-events-none"
                      style={{
                        background: "linear-gradient(90deg, rgba(255,223,163,0.4) 0%, rgba(242,197,114,0.15) 60%, transparent 100%)",
                        filter: "blur(4px)",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 sm:gap-6 lg:gap-8">
                {/* Left column (60%): Income Growth + Sudden Wealth stacked */}
                <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8 min-w-0">
                  <CardFeedbackWrapper cardId="income-growth-timeline">
                    <IncomeGrowthTimeline
                      scores={scores}
                      dasha={dasha}
                      transits={transits}
                      birthYear={birthYear}
                    />
                  </CardFeedbackWrapper>
                  <CardFeedbackWrapper cardId="sudden-wealth-chart">
                    <SuddenWealthChart
                      scores={scores}
                      dasha={dasha}
                      transits={transits}
                      timeline={timeline}
                      chart={chart}
                      birthYear={birthYear}
                    />
                  </CardFeedbackWrapper>
                </div>
                {/* Right column (40%): Suggested Side Hustles */}
                <div className="self-start relative overflow-visible">
                {/* Vedic mandala — positioned behind the Suggested Side Incomes card */}
                {theme === "vedic" && (
                  <div className="vedic-mandala-top" />
                )}
                <CardFeedbackWrapper cardId="income-constellation">
                  <IncomeConstellation
                    scores={scores}
                    dasha={dasha}
                    transits={transits}
                    chart={chart}
                    birthYear={birthYear}
                  />
                </CardFeedbackWrapper>
                </div>
              </div>
            </div>
          </section>

          {/* ═══ Section 2: Your Best Financial Timings ═══ */}
          <section
            id="kundali-timings"
            className="scroll-mt-16 lg:scroll-mt-6 -mx-4 sm:-mx-6 md:-mx-10 lg:-mx-14 px-4 sm:px-6 md:px-10 lg:px-14 py-14 sm:py-20 mb-0 relative"
            style={{ background: "rgba(242,197,114,0.04)", borderTop: "1px solid rgba(242,197,114,0.08)", borderBottom: "1px solid rgba(242,197,114,0.08)" }}
          >
            <div className="max-w-7xl mx-auto">
              {/* Section heading */}
              <div className="mb-8 sm:mb-12 md:mb-16">
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4 w-full">
                  {/* Left shiny line */}
                  <div className="relative h-[1px] sm:h-[2px] flex-1 overflow-hidden rounded-full">
                    <div
                      className="absolute inset-0"
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, rgba(242,197,114,0.25) 40%, rgba(255,223,163,0.6) 100%)",
                      }}
                    />
                    <div
                      className="absolute inset-y-0 w-full"
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, transparent 20%, rgba(242,197,114,0.8) 45%, rgba(255,223,163,1) 50%, rgba(242,197,114,0.8) 55%, transparent 80%, transparent 100%)",
                        backgroundSize: "200% 100%",
                        animation: "dividerShimmer 4s ease-in-out infinite",
                      }}
                    />
                    <div
                      className="absolute -inset-y-[2px] w-full pointer-events-none"
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, rgba(242,197,114,0.15) 40%, rgba(255,223,163,0.4) 100%)",
                        filter: "blur(4px)",
                      }}
                    />
                  </div>

                  {/* Center label */}
                  <span
                    className="shrink-0 text-xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-[0.06em]"
                    style={{
                      color: "#D6C6F5",
                      fontFamily: "'Cormorant Garamond', 'Playfair Display', serif",
                      fontStyle: "italic",
                      textShadow: "0 0 12px rgba(200,162,255,0.3)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Your Best Financial Timings
                  </span>

                  {/* Right shiny line */}
                  <div className="relative h-[1px] sm:h-[2px] flex-1 overflow-hidden rounded-full">
                    <div
                      className="absolute inset-0"
                      style={{
                        background: "linear-gradient(90deg, rgba(255,223,163,0.6) 0%, rgba(242,197,114,0.25) 60%, transparent 100%)",
                      }}
                    />
                    <div
                      className="absolute inset-y-0 w-full"
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, transparent 20%, rgba(242,197,114,0.8) 45%, rgba(255,223,163,1) 50%, rgba(242,197,114,0.8) 55%, transparent 80%, transparent 100%)",
                        backgroundSize: "200% 100%",
                        animation: "dividerShimmerReverse 7s ease-in-out infinite",
                      }}
                    />
                    <div
                      className="absolute -inset-y-[2px] w-full pointer-events-none"
                      style={{
                        background: "linear-gradient(90deg, rgba(255,223,163,0.4) 0%, rgba(242,197,114,0.15) 60%, transparent 100%)",
                        filter: "blur(4px)",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 2-column layout: left stack + right stack */}
              <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 sm:gap-6 lg:gap-8">
                {/* Left column: Best Time to Start Business + FI Timeline */}
                <div className="flex flex-col gap-4 sm:gap-6">
                  <CardFeedbackWrapper cardId="best-business-start">
                    <BestBusinessStartCard
                      scores={scores}
                      dasha={dasha}
                      transits={transits}
                      chart={chart}
                    />
                  </CardFeedbackWrapper>
                  <CardFeedbackWrapper cardId="fi-timeline">
                    <FITimelineCard
                      scores={scores}
                      dasha={dasha}
                      transits={transits}
                      birthYear={birthYear}
                    />
                  </CardFeedbackWrapper>
                </div>

                {/* Right column: Best Months For Wealth + Peak Earning Years.
                    self-start keeps these two short cards at their content
                    height instead of stretching to match the taller left
                    column — same treatment as the Income section above. */}
                <div className="flex flex-col gap-4 sm:gap-6 self-start">
                  <CardFeedbackWrapper cardId="salary-promotion-windows">
                    <SalaryPromotionWindows career={insights?.career ?? null} />
                  </CardFeedbackWrapper>
                  <CardFeedbackWrapper cardId="peak-earning-years">
                    <PeakEarningYears
                      scores={scores}
                      dasha={dasha}
                      transits={transits}
                      chart={chart}
                      birthYear={birthYear}
                    />
                  </CardFeedbackWrapper>
                </div>
              </div>
            </div>
          </section>

          {/* Row 5: Investments & Assets */}
          <section
            id="kundali-investments"
            className="scroll-mt-16 lg:scroll-mt-6 -mx-4 sm:-mx-6 md:-mx-10 lg:-mx-14 px-4 sm:px-6 md:px-10 lg:px-14 py-14 sm:py-20 mb-0"
          >
            <div className="max-w-7xl mx-auto">
                <InvestmentsAssetsSection
                  scores={scores}
                  dasha={dasha}
                  transits={transits}
                  chart={chart}
                  investment={insights?.investmentPersonality ?? null}
                />
            </div>
          </section>

          {/* Row 6: Risk Insights — Requires auth */}
          <AuthGate feature="Risk Insights" mode="overlay">
          <section
            id="kundali-risks"
            className="scroll-mt-16 lg:scroll-mt-6 -mx-4 sm:-mx-6 md:-mx-10 lg:-mx-14 px-4 sm:px-6 md:px-10 lg:px-14 py-14 sm:py-20 mb-0 relative"
            style={{ background: "rgba(242,197,114,0.04)", borderTop: "1px solid rgba(242,197,114,0.08)", borderBottom: "1px solid rgba(242,197,114,0.08)" }}
          >
            <div className="max-w-7xl mx-auto">
              {/* Section divider heading */}
              <div className="mb-8 sm:mb-12 md:mb-16">
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4 w-full">
                  {/* Left shiny line */}
                  <div className="relative h-[1px] sm:h-[2px] flex-1 overflow-hidden rounded-full">
                    <div
                      className="absolute inset-0"
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, rgba(242,197,114,0.25) 40%, rgba(255,223,163,0.6) 100%)",
                      }}
                    />
                    <div
                      className="absolute inset-y-0 w-full"
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, transparent 20%, rgba(242,197,114,0.8) 45%, rgba(255,223,163,1) 50%, rgba(242,197,114,0.8) 55%, transparent 80%, transparent 100%)",
                        backgroundSize: "200% 100%",
                        animation: "dividerShimmer 4s ease-in-out infinite",
                      }}
                    />
                    <div
                      className="absolute -inset-y-[2px] w-full pointer-events-none"
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, rgba(242,197,114,0.15) 40%, rgba(255,223,163,0.4) 100%)",
                        filter: "blur(4px)",
                      }}
                    />
                  </div>

                  {/* Center label */}
                  <span
                    className="shrink-0 text-xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-[0.06em]"
                    style={{
                      color: "#D6C6F5",
                      fontFamily: "'Cormorant Garamond', 'Playfair Display', serif",
                      fontStyle: "italic",
                      textShadow: "0 0 12px rgba(200,162,255,0.3)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Is Your Money At Risk???
                  </span>

                  {/* Right shiny line */}
                  <div className="relative h-[1px] sm:h-[2px] flex-1 overflow-hidden rounded-full">
                    <div
                      className="absolute inset-0"
                      style={{
                        background: "linear-gradient(90deg, rgba(255,223,163,0.6) 0%, rgba(242,197,114,0.25) 60%, transparent 100%)",
                      }}
                    />
                    <div
                      className="absolute inset-y-0 w-full"
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, transparent 20%, rgba(242,197,114,0.8) 45%, rgba(255,223,163,1) 50%, rgba(242,197,114,0.8) 55%, transparent 80%, transparent 100%)",
                        backgroundSize: "200% 100%",
                        animation: "dividerShimmerReverse 7s ease-in-out infinite",
                      }}
                    />
                    <div
                      className="absolute -inset-y-[2px] w-full pointer-events-none"
                      style={{
                        background: "linear-gradient(90deg, rgba(255,223,163,0.4) 0%, rgba(242,197,114,0.15) 60%, transparent 100%)",
                        filter: "blur(4px)",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* ScamRiskSection — "Is Your Money At Risk?" */}
              <div className="mb-4 sm:mb-6">
                <CardFeedbackWrapper cardId="scam-risk">
                  <ScamRiskSection
                    scores={scores}
                    chart={chart}
                    dasha={dasha}
                    transits={transits}
                    loan={insights?.loan ?? null}
                  />
                </CardFeedbackWrapper>
              </div>

              {/* Financial Risk & Stability Outlook chart */}
              <div className="mb-4 sm:mb-6">
                <CardFeedbackWrapper cardId="financial-risk-summary">
                  <FinancialRiskSummary
                    scores={scores}
                    dasha={dasha}
                    transits={transits}
                  />
                </CardFeedbackWrapper>
              </div>
            </div>
          </section>
          </AuthGate>
        </div>
        )}

        {/* Feedback panel — bottom-left */}
        {!isEmbed && <FeedbackPanel />}
      </main>
    </div>
  );
};

/* ── Wrapped with theme provider ── */
const FinancialKundali = () => (
  <KundaliThemeProvider>
    <FinancialKundaliInner />
  </KundaliThemeProvider>
);

export default FinancialKundali;
