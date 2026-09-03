/**
 * Click heatmap — where on a page people actually click.
 *
 * Points come pre-bucketed from admin_click_map(), so the browser never receives
 * raw coordinates. Rendering is the standard two-pass heatmap technique: additive
 * greyscale blobs first, then a colour ramp applied to the accumulated alpha.
 * Doing it in one pass with coloured blobs produces muddy overlaps where two hot
 * spots meet.
 *
 * ── The coordinate model, and why it changed ────────────────────────────────
 * x is a fraction of the LAYOUT viewport width, bucketed into 40 columns. The
 * layout is responsive, so the same control lands at the same fraction for
 * everyone at a given width. (It used to be divided by scrollWidth at capture
 * time, which drifted the whole map left on any page with horizontal overflow.)
 *
 * y is an ABSOLUTE depth in CSS pixels, bucketed into 24px bands. It used to be a
 * fraction of the document height, drawn against the height measured in this
 * panel's own iframe — two different page states, so every blob was displaced by
 * however much they differed, worst at the bottom. click_points.doc_h now carries
 * the height each fraction was taken against, so the depth is recoverable. Rows
 * older than that column fall back to fraction mode (200 buckets), and the server
 * says which mode it used via median_doc_h.
 *
 * The device toggle selects a VIEWPORT WIDTH BAND, not a user-agent label: a
 * desktop browser in a 500px window laid out like a phone and is counted as one.
 *
 * The optional page preview behind the canvas is a same-origin iframe of the
 * real route with ?embed=true (the flag FloatingAstrologerChat already honours),
 * which beats a stored screenshot: it can never be stale. Route guards are
 * suppressed inside it (isHeatmapPreview) so the frame shows the page it claims,
 * and a mismatch detector hides BOTH the frame and the canvas if it does not.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flame, Loader2, RefreshCw, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { invokeAdmin } from "@/lib/admin-api";
import { AdminCard, Pill } from "./AdminCard";
import { heatColour } from "./analytics-format";
import { normalisePath, pageLabel, TRACKED_PAGES } from "@/lib/tracked-pages";

export interface ClickCell {
  x: number;
  y: number;
  /**
   * Absolute depth into the page in CSS pixels, when the server could compute one.
   *
   * Preferred over `y` wherever it exists. `y` is a fraction of a page height, and
   * the only height this component knows is the one it measures in its own preview
   * iframe — which is a different page state to the visitor's, so every blob sat at
   * the wrong depth by however much the two differed. A pixel depth needs no such
   * guess. Null for rows recorded before click_points.doc_h existed.
   */
  y_px?: number | null;
  n: number;
}

export interface ClickMap {
  path: string;
  device: string | null;
  kind?: string;
  total: number;
  cells: ClickCell[];
  max_n: number;
  /** The page height the y_px depths are into. Null in fraction mode. */
  median_doc_h?: number | null;
}

/**
 * Device classes the picker offers.
 *
 * These are now **viewport-width bands**, not user-agent labels — see
 * click_viewport_class() in migration 018. A desktop browser in a 500px window is
 * counted as mobile here, which is right: the width is what the page laid out in,
 * and the width is what this preview reproduces.
 */
const DEVICES = [
  { value: "mobile", label: "Mobile" },
  { value: "desktop", label: "Desktop" },
  { value: "tablet", label: "Tablet" },
] as const;

/**
 * Which sort of click to map.
 *
 * "Dead" is the one that answers "people are clicking where there is nothing to
 * click": those clicks used to be discarded at the listener, so a cold region of
 * the heatmap could mean either "nobody clicked here" or "plenty of people tried
 * and there was no control" — two opposite conclusions with the same picture.
 */
const KINDS = [
  { value: "click", label: "Clicks" },
  { value: "dead", label: "Dead clicks" },
  { value: "rage", label: "Rage clicks" },
] as const;

/**
 * The viewport width each device class is previewed at.
 *
 * The iframe is rendered at these widths and then CSS-scaled down to whatever
 * the panel gives it. Rendering at the panel's own width instead — which is what
 * this did before — puts a *desktop* layout behind a heatmap of mobile clicks,
 * so the blobs land next to elements that were never in that position on a
 * phone. Which is worse than no preview, because it looks like an answer.
 */
const DEVICE_WIDTH: Record<string, number> = { mobile: 390, tablet: 834, desktop: 1440 };

/**
 * On-screen height of the preview window, in CSS pixels.
 *
 * The previewed page is far taller than this and scrolls inside it. Sizing the
 * box to the whole page instead makes a single element ~3000px tall, which
 * pushes every section below the heatmap off screen.
 */
const PREVIEW_VIEWPORT_PX = 520;

/**
 * Fallback page height, as a multiple of the device width.
 *
 * Only used when the real height cannot be measured (the preview is off, or the
 * frame has not loaded). The real one is read from the iframe's own document —
 * see measureFrame — because y coordinates are fractions of the ACTUAL document
 * height, so a guessed height puts every blob at the wrong depth.
 */
const FALLBACK_ASPECT: Record<string, number> = { mobile: 5.2, tablet: 3.4, desktop: 2.6 };

/**
 * Stamp "SAMPLE DATA" across the canvas.
 *
 * Not decoration. The dev mock fabricates a heatmap, and `isSample` used to be
 * derived from the *overview* payload alone — so once migration 018 was applied
 * the overview went real, isSample went false, and invented cells were drawn with
 * nothing on screen saying so. A caption in the prose above is not enough either:
 * a screenshot of the canvas travels without it.
 */
function watermark(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const step = 320;
  ctx.save();
  ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 3;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Repeated down the page, because the stage scrolls inside a 520px window and a
  // single mark at the top would be invisible for most of the page.
  for (let y = step / 2; y < height + step; y += step) {
    ctx.save();
    ctx.translate(width / 2, y);
    ctx.rotate(-Math.PI / 9);
    ctx.strokeText("SAMPLE DATA", 0, 0);
    ctx.fillText("SAMPLE DATA", 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function paint(canvas: HTMLCanvasElement, map: ClickMap, sample: boolean): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  if (map.cells.length === 0) {
    // Still stamped: an empty sample grid is sample data too.
    if (sample) watermark(ctx, width, height);
    return;
  }

  // Pass 1 — additive greyscale. Radius scales with the canvas so the blobs
  // stay the same visual size whatever the container width.
  //
  // Tighter than it was (/22): the vertical buckets are now 24px absolute rather
  // than a fortieth of the page, so a wide blob is no longer hiding the fact that
  // the underlying position was quantised into a ~125px band. A hotspot should read
  // as a control, not as a region of the page.
  const radius = Math.max(10, Math.round(width / 28));
  const max = Math.max(map.max_n, 1);

  for (const cell of map.cells) {
    const cx = cell.x * width;
    // Absolute depth when the server had one, the fraction otherwise. Cells past
    // the preview's own height simply fall off the canvas; the count of those is
    // surfaced in the UI rather than clamped into a false pile at the bottom edge.
    const cy = cell.y_px != null ? cell.y_px : cell.y * height;
    const alpha = Math.min(1, 0.15 + (cell.n / max) * 0.85);

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, `rgba(0,0,0,${alpha})`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pass 2 — replace the accumulated alpha with a colour ramp.
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    const [r, g, b] = heatColour(a / 255);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    // Keep cool areas translucent so the page behind stays readable.
    data[i + 3] = Math.round(Math.min(235, 60 + a * 0.75));
  }
  ctx.putImageData(image, 0, 0);

  // After putImageData, or the recolour pass would overwrite the text.
  if (sample) watermark(ctx, width, height);
}

export function ClickHeatmap({
  paths,
  isSample,
  from,
  to,
  excludeInternal,
}: {
  /**
   * Paths that actually have samples, from admin_analytics().click_map_paths —
   * one row per path AND device, with rows of zero omitted (the SQL groups over
   * click_points, so a path with no rows cannot produce one).
   *
   * Device matters: admin_click_map filters by it, so a path-only count would sit
   * next to a per-device canvas and a page could read "1,840" while drawing an
   * empty Mobile grid. `kind` matters for exactly the same reason now that the
   * canvas can draw dead clicks.
   */
  paths: { path: string; device: string | null; kind?: string; points: number }[];
  isSample: boolean;
  /**
   * Passed down as resolved ISO bounds rather than a day count, so the heatmap
   * covers exactly the window the funnel above it does — including a custom
   * from/to, which no day count can express.
   */
  from: string;
  to: string;
  /**
   * Passed down rather than read here, so the heatmap always describes the same
   * population as the funnel above it. Two independent toggles would let the two
   * panels disagree about the same week with nothing on screen explaining why.
   */
  excludeInternal: boolean;
}) {
  const [path, setPath] = useState<string>(paths[0]?.path ?? "/home");
  const [device, setDevice] = useState<string>("mobile");
  const [kind, setKind] = useState<string>("click");
  const [map, setMap] = useState<ClickMap | null>(null);
  /**
   * Whether the map on screen was fabricated by the dev mock.
   *
   * Tracked separately from the `isSample` prop, which describes the *overview*
   * payload. The two can disagree — migration 018 applied but no click_points rows
   * yet is the ordinary case — and when they did, fabricated cells were drawn with
   * no sample-data caption anywhere. Never infer one from the other.
   */
  const [mapIsSample, setMapIsSample] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPage, setShowPage] = useState(true);
  /**
   * Whether the heatmap has ever been scrolled into view.
   *
   * The preview is a full second copy of the app — router, Supabase client,
   * fonts, the landing page's Lottie and PDF poster. Mounting it on every /admin
   * load made the whole panel measurably slower to settle, and the heatmap sits
   * at the bottom of a long section that most visits never reach. So it is not
   * built until someone actually looks at it.
   */
  const [seen, setSeen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  /**
   * Pending re-measure timers.
   *
   * A ref rather than an effect's closure because measureFrame runs as the
   * iframe's onLoad handler, and React discards whatever an event handler
   * returns — the cleanup it used to return was never called. See
   * clearMeasureTimers() below for what that cost.
   */
  const measureTimers = useRef<number[]>([]);

  /**
   * Every tracked page, with the number of coordinates it has ON THE SELECTED
   * DEVICE — which is what the canvas beside it draws.
   *
   * Driven off the catalogue rather than off `paths` (which only lists pages that
   * already have rows), because "no data yet" and "not a page" looked identical
   * before: /profile and /ai-chat were simply absent from the dropdown, with
   * nothing on screen to say they were never sampled. A page with no coordinates
   * is now selectable and says so.
   *
   * Sorted by the number actually printed, so the order and the figures agree.
   * The catalogue index breaks ties, which keeps the long tail of zeros in a
   * stable, meaningful order instead of shuffling.
   */
  const pickerOptions = useMemo(() => {
    const order = new Map(TRACKED_PAGES.map((page, i) => [page.path, i]));
    const known = new Set(TRACKED_PAGES.map((p) => p.path));

    const counts = new Map<string, number>();
    for (const row of paths) {
      // A null device is its own bucket, not "all devices" — it means neither a
      // viewport width nor a classifiable user agent was reported, and those points
      // cannot be attributed to the mobile/desktop/tablet view the canvas shows.
      if (row.device !== device) continue;
      // Rows predating the kind column arrive without one and are plain clicks,
      // which is also what the SQL's `coalesce(p_kind, 'click')` assumes.
      if ((row.kind ?? "click") !== kind) continue;
      counts.set(row.path, (counts.get(row.path) ?? 0) + row.points);
    }

    const listed = TRACKED_PAGES.map((page) => ({
      path: page.path,
      label: page.label,
      points: counts.get(page.path) ?? 0,
    }));

    // Anything with rows that the catalogue does not know about — a route removed
    // since, or a path recorded before normalisation. Kept visible rather than
    // hidden: those rows exist and someone will wonder where they went.
    const orphans = [...new Set(paths.filter((p) => !known.has(p.path)).map((p) => p.path))].map(
      (path) => ({ path, label: "Unlisted page", points: counts.get(path) ?? 0 }),
    );

    return [...listed, ...orphans].sort(
      (a, b) =>
        b.points - a.points ||
        (order.get(a.path) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(b.path) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [paths, device, kind]);

  useEffect(() => {
    if (pickerOptions.length && !pickerOptions.some((p) => p.path === path)) {
      setPath(pickerOptions[0].path);
    }
  }, [pickerOptions, path]);

  /**
   * Points recorded with no device class, which no canvas here can draw.
   *
   * device is null when a request carried no User-Agent at all — rare, but it
   * happens. Those points cannot honestly be placed on the mobile, desktop or
   * tablet canvas, so they are excluded from every per-device count above. Left
   * at that they would simply vanish, and the next person to compare the picker
   * against click_points would find a discrepancy with nothing to explain it.
   */
  const unclassified = useMemo(
    () => paths.filter((p) => p.device === null).reduce((sum, p) => sum + p.points, 0),
    [paths],
  );

  /**
   * Cancel any re-measure still pending from a previous frame.
   *
   * Load-bearing, not tidiness. Each of those timers calls checkLanding(), which
   * closes over the `path` of the render that scheduled it but reads the
   * *current* iframe's location. Switching page or device inside the 4s window
   * therefore had the old selection's timer compare the new page against the old
   * path, declare a mismatch, and hide the canvas behind "the preview redirected
   * to …" — a wrong answer from the detector whose whole job is catching wrong
   * answers. Switching the device toggle is the ordinary way to use this panel,
   * so it fired constantly.
   */
  const clearMeasureTimers = useCallback(() => {
    measureTimers.current.forEach(window.clearTimeout);
    measureTimers.current = [];
  }, []);

  // A new selection invalidates any previous mismatch verdict — and any timer
  // that was about to reassert one.
  useEffect(() => {
    clearMeasureTimers();
    setLandedOn(null);
    setOverrideMismatch(false);
  }, [path, device, clearMeasureTimers]);

  // Nothing should be measuring a frame that is no longer on screen.
  useEffect(() => clearMeasureTimers, [clearMeasureTimers]);

  const fetchMap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // See admin-api.ts: functions.invoke discards the body of a non-2xx, so a
      // real reason would arrive as "non-2xx status code".
      const data = await invokeAdmin<{ clickMap?: ClickMap }>({
        action: "click-map",
        path,
        device,
        kind,
        from,
        to,
        excludeInternal,
      });

      const loaded = data?.clickMap;

      /**
       * The mock stands in for an ABSENT pipeline, not for a quiet one.
       *
       * This used to fall back whenever the query returned no cells, which meant a
       * working deployment with little traffic showed invented hotspots — the same
       * three blobs on all 21 pages — instead of the empty state this panel already
       * has an overlay for. A successful, empty answer is real information: it says
       * nobody clicked there. Only substitute when the request itself failed (the
       * catch below) or when the overview is sample data too, which is the signal
       * that nothing is deployed.
       */
      if (import.meta.env.DEV && isSample && !loaded?.cells?.length) {
        const dev = await import("@/lib/dev-visitor-mock");
        if (dev.mockVisitorsEnabled()) {
          setMap(dev.mockClickMap(path, device, kind) as ClickMap);
          setMapIsSample(true);
          setLoading(false);
          return;
        }
      }

      setMap(loaded ?? null);
      setMapIsSample(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (import.meta.env.DEV) {
        const dev = await import("@/lib/dev-visitor-mock");
        if (dev.mockVisitorsEnabled()) {
          setMap(dev.mockClickMap(path, device, kind) as ClickMap);
          setMapIsSample(true);
          setLoading(false);
          return;
        }
      }
      // Never a silent empty grid: an empty heatmap and a failed request look
      // identical, and only one of them means "nobody clicked here".
      setError(message);
      setMap(null);
      setMapIsSample(false);
    }
    setLoading(false);
  }, [path, device, kind, from, to, excludeInternal, isSample]);

  useEffect(() => {
    void fetchMap();
  }, [fetchMap]);

  const deviceWidth = DEVICE_WIDTH[device] ?? 1440;
  // Real measured page height in device pixels, once the frame reports one.
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const [measured, setMeasured] = useState(false);
  const [scale, setScale] = useState(1);
  /** Where the frame actually ended up, when that is not what was asked for. */
  const [landedOn, setLandedOn] = useState<string | null>(null);
  const [overrideMismatch, setOverrideMismatch] = useState(false);

  const frameHeight = pageHeight ?? Math.round(deviceWidth * (FALLBACK_ASPECT[device] ?? 2.6));

  /** Anything fabricated, from either source. Drives every "this is not real" mark. */
  const sample = mapIsSample || isSample;

  /** "clicks" / "dead clicks" — used wherever a count is labelled. */
  const kindNoun = kind === "dead" ? "dead clicks" : kind === "rage" ? "rage clicks" : "clicks";

  /**
   * A dynamic route has no single URL to frame.
   *
   * `/shared/:slug` is the catalogue's normalised bucket — the form clicks are
   * recorded under (see normalisePath). Framed literally, it renders SharedKundali
   * looking up a kundali whose slug is the string ":slug", so the backdrop was an
   * error state dressed up as the shared page. There is no honest choice of which
   * visitor's share to show, so show none and say so.
   */
  const previewable = !path.includes(":");

  /**
   * The frame is showing a different page than the one selected.
   *
   * `overrideMismatch` drops the page and keeps the heatmap, which is the honest
   * fallback: the coordinates are real, only the backdrop is wrong.
   */
  const mismatched = landedOn !== null && !overrideMismatch;

  // A new page or device invalidates the measurement.
  useEffect(() => {
    setPageHeight(null);
    setMeasured(false);
  }, [path, device]);

  /**
   * Read the previewed page's real height.
   *
   * Same-origin, so contentDocument is reachable — that is the whole reason the
   * frame carries no `sandbox` attribute (see the iframe below). Without a real
   * height the overlay is sized from a guess, and since y is a fraction of the
   * document height, every blob sits at the wrong depth by however wrong the
   * guess was.
   */
  const measureFrame = useCallback(() => {
    // This frame has loaded, so anything still scheduled against the last one is
    // stale by definition.
    measureTimers.current.forEach(window.clearTimeout);
    measureTimers.current = [];

    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;

    /**
     * Where did the frame actually end up?
     *
     * Several pages redirect themselves — /auth sends an onboarded session to
     * /kundali, /payment sends a paid user to /ai-chat — and the route guards
     * send anyone unqualified elsewhere. The two known cases are suppressed, but
     * a redirect added later must not be able to put the wrong page behind the
     * overlay in silence, which is the defect this replaced.
     *
     * Re-checked on the same schedule as the height, not once at load. These are
     * **client-side** redirects: they run in a React effect after the document
     * has loaded, so at onLoad the location still reads as the requested path and
     * a single check would miss every one of them.
     */
    const checkLanding = () => {
      try {
        const actual = iframe?.contentWindow?.location?.pathname;
        if (!actual) return;
        const normalised = normalisePath(actual);
        setLandedOn(normalised !== path ? normalised : null);
      } catch {
        // Unreadable location means an opaque origin; the height check reports
        // that case on its own.
        setLandedOn(null);
      }
    };

    checkLanding();

    if (!doc?.documentElement) {
      setMeasured(true);
      return;
    }

    // A client-rendered SPA keeps growing after load, so measure again shortly
    // after rather than trusting the first value.
    const read = () => {
      const height = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
      if (height > 0) setPageHeight(height);
      setMeasured(true);
      checkLanding();
    };
    read();
    measureTimers.current.push(
      ...[400, 1200, 2500, 4000].map((delay) => window.setTimeout(read, delay)),
    );
  }, [path]);

  // Mount the preview the first time this panel enters the viewport, and stop
  // observing once it has: it never needs to be torn down again.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || seen) return;
    if (typeof IntersectionObserver !== "function") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [seen]);

  /**
   * Fit the device-width stage into whatever width the panel has.
   *
   * An effect rather than a ref callback: a callback runs on every render and
   * would attach a new ResizeObserver each time with nothing disconnecting the
   * old ones.
   */
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const fit = () => {
      const box = frame.clientWidth;
      if (box > 0) setScale(box / deviceWidth);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [deviceWidth]);

  // Repaint whenever the data or the measured height changes. The canvas is
  // sized in the PREVIEW's coordinate space (device width x real page height),
  // not the container's, so the overlay lines up with the page behind it however
  // the panel is scaled.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return;
    canvas.width = deviceWidth;
    canvas.height = frameHeight;
    paint(canvas, map, sample);
  }, [map, deviceWidth, frameHeight, sample]);

  const top = useMemo(
    () =>
      [...(map?.cells ?? [])]
        .slice(0, 6)
        .map((c) => ({ ...c, pct: map?.total ? (c.n / map.total) * 100 : 0 })),
    [map],
  );

  /**
   * Clicks recorded deeper than the page currently renders.
   *
   * In pixel mode a blob is drawn at its real depth, so a click 4,000px down a page
   * that now measures 3,000px falls off the bottom of the canvas. Counted rather
   * than clamped: piling them onto the last row would invent a hotspot at the foot
   * of every page. A non-zero figure means the page has got shorter since — the
   * content changed, or the previewed state differs from what visitors saw.
   */
  const beyondPreview = useMemo(() => {
    if (!map) return 0;
    return map.cells.reduce(
      (sum, c) => (c.y_px != null && c.y_px > frameHeight ? sum + c.n : sum),
      0,
    );
  }, [map, frameHeight]);

  /**
   * How far the previewed page's height is from the height these clicks were
   * recorded against. Vertical placement is only as good as that agreement.
   */
  const heightDrift = useMemo(() => {
    const recorded = map?.median_doc_h;
    if (!recorded || !pageHeight) return null;
    const pct = Math.abs(pageHeight - recorded) / recorded;
    return pct >= 0.2 ? { recorded, measured: pageHeight, pct } : null;
  }, [map, pageHeight]);

  return (
    <div data-testid="click-heatmap">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Flame className="w-4 h-4 text-admin-info shrink-0" />
          <h3 className="text-sm font-semibold text-admin-text">Click heatmap</h3>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-admin-text-muted" />}
          {!loading && map && (
            <Pill
              size="md"
              tone={
                sample
                  ? "bg-admin-warn/15 text-admin-warn border border-admin-warn/40"
                  : "bg-admin-surface-2 text-admin-text-muted border border-admin-border"
              }
            >
              {/* The word "sample" sits inside the number's own pill on purpose: it
                  is the one element anyone reads before believing the figure. */}
              {map.total.toLocaleString("en-IN")} {sample ? `sample ${kindNoun}` : kindNoun}
            </Pill>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={path}
            onChange={(e) => setPath(e.target.value)}
            aria-label="Heatmap page"
            /* A <select> is as wide as its widest option, and these carry a label,
               a path and a count. Without the cap the element sets the panel's
               minimum width and the whole page scrolls sideways at 390px. */
            className="min-h-[44px] sm:min-h-[36px] px-2 rounded-lg bg-admin-surface-2 border border-admin-border text-xs text-admin-text min-w-0 max-w-full"
          >
            {pickerOptions.map((option) => (
              <option key={option.path} value={option.path}>
                {option.label}: {option.path}
                {option.points > 0
                  ? ` · ${option.points.toLocaleString("en-IN")} ${kindNoun}`
                  : ` · no ${kindNoun} yet`}
              </option>
            ))}
          </select>

          <div className="flex rounded-lg overflow-hidden border border-admin-border">
            {DEVICES.map((d) => (
              <button
                key={d.value}
                onClick={() => setDevice(d.value)}
                aria-pressed={device === d.value}
                className={`px-2.5 min-h-[44px] sm:min-h-[36px] text-xs transition-colors ${
                  device === d.value
                    ? "bg-admin-info-strong text-white"
                    : "bg-admin-surface-2 text-admin-text-muted hover:text-admin-text"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Kind, beside device rather than folded into the page picker: the same
              page is worth looking at twice, once for what people clicked and once
              for where they clicked and nothing happened. */}
          <div className="flex rounded-lg overflow-hidden border border-admin-border">
            {KINDS.map((k) => (
              <button
                key={k.value}
                onClick={() => setKind(k.value)}
                aria-pressed={kind === k.value}
                className={`px-2.5 min-h-[44px] sm:min-h-[36px] text-xs transition-colors ${
                  kind === k.value
                    ? "bg-admin-info-strong text-white"
                    : "bg-admin-surface-2 text-admin-text-muted hover:text-admin-text"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowPage((v) => !v)}
            className="flex items-center gap-1.5 px-2 min-h-[44px] sm:min-h-[36px] text-xs text-admin-text-muted hover:text-admin-text transition-colors"
          >
            {showPage ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPage ? "Hide page" : "Show page"}
          </button>

          <button
            onClick={fetchMap}
            disabled={loading}
            className="flex items-center gap-1.5 px-2 min-h-[44px] sm:min-h-[36px] text-xs text-admin-text-muted hover:text-admin-text transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* How to read a position, where it will actually be read. */}
      <p className="text-[11px] text-admin-text-muted mb-3">
        Horizontal position is a fraction of the layout width, so it is exact.
        Vertical is a real depth in pixels, taken against the page height each click
        was recorded on — so it no longer drifts as the page reflows. The device
        buttons select the <strong>viewport width</strong> the click happened at, not
        the kind of machine: a desktop browser in a narrow window is counted as
        mobile, because that is how the page laid out for them.
        {sample && " These points are generated sample data, not real traffic."}
      </p>

      {/* What "no clicks yet" actually means. Two separate pipelines get conflated
          here otherwise, and the counts in this picker are an order of magnitude
          below the ones in the clicks table for the same page. */}
      <p className="text-[11px] text-admin-text-faint mb-3">
        Positions come from a 25% sample of clicks, kept for 30 days, and are counted
        per width band and per kind. So a page can show no clicks yet here and still
        have plenty in the table above, and a page busy on mobile can be empty on
        tablet.
        {unclassified > 0 && (
          <>
            {" "}
            {unclassified.toLocaleString("en-IN")} further{" "}
            {unclassified === 1 ? "position" : "positions"} came from requests that
            reported neither a viewport width nor a recognisable browser, and are not
            counted on any of the three.
          </>
        )}
      </p>

      {/* Both of these describe the *placement*, not the data, so they belong with
          the caveats above the canvas rather than as errors. */}
      {heightDrift && (
        <p className="text-[11px] text-admin-warn mb-3" data-testid="heatmap-height-drift">
          The page below measures {heightDrift.measured.toLocaleString("en-IN")}px, but
          these clicks were recorded on a page of about{" "}
          {heightDrift.recorded.toLocaleString("en-IN")}px — a{" "}
          {Math.round(heightDrift.pct * 100)}% difference. The depths are still real;
          it is the backdrop that has changed, so blobs near the bottom may not line
          up with what is drawn under them.
        </p>
      )}
      {beyondPreview > 0 && (
        <p className="text-[11px] text-admin-text-faint mb-3">
          {beyondPreview.toLocaleString("en-IN")}{" "}
          {beyondPreview === 1 ? "click was" : "clicks were"} recorded deeper than the
          page now renders and fall below the canvas. They are counted in the total
          above but not drawn.
        </p>
      )}

      {error && (
        <AdminCard className="p-3 mb-3 border-admin-danger/40 bg-admin-danger/10">
          <p className="text-xs text-admin-text">
            Could not load the click map: <span className="font-mono">{error}</span>
          </p>
        </AdminCard>
      )}

      {!previewable && (
        <AdminCard className="p-3 mb-3 border-admin-border">
          <p className="text-xs text-admin-text" data-testid="heatmap-no-preview">
            <span className="font-mono">{path}</span> is one bucket covering every shared
            kundali, so there is no single page to render behind the heatmap. The
            positions below are real; they are drawn over a blank stage sized from an
            estimate.
          </p>
        </AdminCard>
      )}

      {mismatched && (
        <AdminCard className="p-3 mb-3 border-admin-warn/40 bg-admin-warn/10">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-admin-warn shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-admin-text" data-testid="heatmap-mismatch">
                The preview redirected to <span className="font-mono">{landedOn}</span>, so
                the page for {pageLabel(path)} is <strong>not</strong> shown. Both the page
                and the heatmap are hidden rather than drawn over the wrong page.
              </p>
              <p className="text-[11px] text-admin-text-muted mt-1">
                Usually a route guard: this account may not be able to reach{" "}
                <span className="font-mono">{path}</span>, or a redirect on the page itself.
                The recorded clicks are still real; only the backdrop is unavailable.
              </p>
              <button
                onClick={() => setOverrideMismatch(true)}
                className="mt-2 px-2 min-h-[44px] sm:min-h-[32px] rounded-lg border border-admin-border text-[11px] text-admin-text-muted hover:text-admin-text transition-colors"
              >
                Show the heatmap without the page
              </button>
            </div>
          </div>
        </AdminCard>
      )}

      <AdminCard className="p-3">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          {/* The preview is rendered at the DEVICE's width and scaled down to
              whatever the panel gives it, rather than laid out at the panel's
              own width. The heatmap and the page therefore share one coordinate
              space, and a mobile heatmap sits on a mobile layout. */}
          <div ref={frameRef} className="min-w-0">
            {/* Fixed-height viewport, scrolled vertically, rather than a box
                sized to the whole page. A mobile page is ~2000px tall and the
                panel is ~600px wide, so an aspect-ratio box would render a
                3000px-tall element and push everything below it off screen —
                including the sections the sidebar jumps to. The stage inside
                keeps its full height so the canvas and the page scroll together
                and stay aligned. */}
            <div
              className="relative w-full overflow-y-auto overflow-x-hidden rounded-lg border border-admin-border bg-admin-surface-2"
              style={{ height: PREVIEW_VIEWPORT_PX }}
            >
              <div
                ref={stageRef}
                className="absolute top-0 left-0 origin-top-left"
                style={{
                  width: deviceWidth,
                  height: frameHeight,
                  // Scale rather than resize: the iframe must LAY OUT at the
                  // device width for the page to reflow the way a phone does.
                  transform: `scale(${scale})`,
                }}
              >
                {showPage && seen && previewable && !overrideMismatch && !mismatched && (
                  /* `!mismatched` as well as `!overrideMismatch` — both are needed.

                     overrideMismatch is the "show the heatmap without the page"
                     escape, and it clears `mismatched` by design, so gating on
                     `!mismatched` alone would put the page back the moment someone
                     asked for it to go away.

                     The canvas was already hidden on a mismatch but the frame was
                     not, so a guard that bounced the frame to /home left the Landing
                     page sitting under six other page labels — the exact wrong
                     picture this detector exists to prevent, minus the overlay.
                     Hiding the canvas alone was half a fix.

                     Same-origin, so this can never be a stale screenshot, and so
                     the real page height is readable — see measureFrame.
                     
                     No `sandbox` attribute, matching UserKundaliViewer, which
                     embeds /kundali the same way. It previously said
                     `sandbox="allow-scripts"`, and that was the bug behind the
                     blank grey panel: without allow-same-origin the frame gets an
                     opaque origin, so the app's first sessionStorage access
                     throws and nothing renders at all.
                     
                     embed=true stops the framed page recording analytics — see
                     isEmbedded() in src/lib/tracking-scope.ts. Without it,
                     opening this panel writes rows into the table it is
                     displaying. */
                  <iframe
                    ref={iframeRef}
                    key={`${path}-${device}`}
                    src={`${path}?embed=true&preview=heatmap`}
                    title={`Preview of ${path}`}
                    tabIndex={-1}
                    onLoad={measureFrame}
                    loading="lazy"
                    style={{ width: deviceWidth, height: frameHeight }}
                    className="border-0 opacity-60 pointer-events-none"
                  />
                )}
                {/* Hidden on a mismatch, not merely captioned. An overlay of
                    /auth's clicks drawn over the kundali page is the defect this
                    detector exists to stop — leaving it on screen with a warning
                    above it keeps the misleading picture. */}
                {!mismatched && (
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 pointer-events-none"
                    style={{ width: deviceWidth, height: frameHeight }}
                    role="img"
                    aria-label={`Density of ${kindNoun} for ${pageLabel(path)} (${path}) on ${device}`}
                  />
                )}
              </div>

              {!loading && map && map.cells.length === 0 && !error && (
                <div className="sticky top-0 h-full grid place-items-center pointer-events-none">
                  <p
                    className="text-xs text-admin-text-muted px-4 text-center max-w-sm"
                    data-testid="heatmap-empty"
                  >
                    No {kindNoun} recorded for {pageLabel(path)} on {device} in this
                    period.
                    {sample && (
                      <>
                        {" "}
                        <span className="text-admin-text-faint">
                          Nothing is being collected yet: these panels are showing
                          sample data.
                        </span>
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Said plainly when the height is a guess: the vertical placement of
                every blob depends on it, so the reader needs to know. */}
            <p className="text-[10px] text-admin-text-faint mt-1">
              Scroll inside the preview to follow the page down.
            </p>
            {/* Only when a frame was actually expected. A dynamic route or a
                mismatch never mounts one, and both already say why above — a second
                "could not measure" line there reads as a third, separate fault. */}
            {showPage && previewable && !mismatched && measured && pageHeight === null && (
              <p className="text-[10px] text-admin-warn mt-1">
                Could not measure this page, so the height below is an estimate and the
                vertical placement is approximate.
              </p>
            )}
            {!showPage && (
              <p className="text-[10px] text-admin-text-faint mt-1">
                Page preview hidden: the grid height is an estimate.
              </p>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-admin-text-faint mb-2">
              Densest spots
            </p>
            {top.length === 0 && <p className="text-xs text-admin-text-muted">—</p>}
            <ul className="space-y-1.5">
              {top.map((cell, i) => (
                <li key={`${cell.x}-${cell.y}`} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-admin-text-faint tabular-nums">{i + 1}</span>
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{
                      background: `rgb(${heatColour(cell.n / Math.max(map?.max_n ?? 1, 1)).join(",")})`,
                    }}
                  />
                  <span className="text-admin-text-muted tabular-nums">
                    {/* Depth in real pixels when we have it — a percentage of a page
                        height nobody can see is not something you can go and look at.
                        The fraction remains for pre-doc_h rows. */}
                    {Math.round(cell.x * 100)}% /{" "}
                    {cell.y_px != null
                      ? `${cell.y_px.toLocaleString("en-IN")}px`
                      : `${Math.round(cell.y * 100)}%`}
                  </span>
                  <span className="ml-auto text-admin-text tabular-nums">
                    {cell.pct.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>

            {/* A ramp with no numbers is decoration; this one is a legend. */}
            <div className="mt-4">
              <div
                className="h-2 rounded-full"
                style={{
                  background: `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1]
                    .map((t) => `rgb(${heatColour(t).join(",")})`)
                    .join(", ")})`,
                }}
              />
              <div className="flex justify-between text-[10px] text-admin-text-faint mt-1 tabular-nums">
                <span>1</span>
                <span>{map?.max_n ?? 0} clicks / cell</span>
              </div>
            </div>
          </div>
        </div>
      </AdminCard>
    </div>
  );
}
