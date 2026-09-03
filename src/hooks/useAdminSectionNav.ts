/**
 * Jump-to-section behaviour for the /admin sidebar.
 *
 * Window scroll with `scrollIntoView` + `scroll-mt-*` on the anchors, rather
 * than the manual arithmetic on /kundali (`scrollTop + (elRect.top -
 * containerRect.top) - headerOffset - 8`). That page needs it because <main> is
 * the scroller there; /admin has no inner scroll container, so the browser's own
 * scroll-margin handling is both shorter and correct. Mixing the two — which
 * /kundali does — means the CSS `scroll-margin-top` is silently ignored.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ADMIN_SECTIONS, type AdminSectionId } from "@/components/admin/admin-sections";

/** Within this many pixels of either end of the document we call it "at the end". */
const EDGE_THRESHOLD = 80;

/**
 * Which of the currently-intersecting sections should own the highlight.
 *
 * Exported for tests, and separate because getting it wrong is the /kundali
 * scroll-spy bug: it calls `setActiveSection(id)` for every intersecting entry
 * in the callback, so with two sections in view the last one in the entry list
 * wins — which is the *lower* section, not the one you are reading. Taking the
 * topmost intersecting entry is what makes the highlight track the heading at
 * the top of the viewport.
 */
export function pickActiveEntry(entries: IntersectionObserverEntry[]): string | null {
  const visible = entries.filter((e) => e.isIntersecting);
  if (visible.length === 0) return null;

  let top = visible[0];
  for (const entry of visible) {
    if (entry.boundingClientRect.top < top.boundingClientRect.top) top = entry;
  }
  return top.target.id || null;
}

/**
 * The section to force at either end of the document, or null in between.
 *
 * Both ends need this, because the observer band is a narrow strip near the top
 * of the viewport and neither end of the page can put a heading inside it.
 *
 * Top: without it the first section is unhighlighted on load, and whatever was
 * last active stays lit after scrolling back up — the /kundali stale-highlight
 * bug.
 *
 * Bottom: once the page can scroll no further, the remaining sections sit below
 * the band, so the last heading that *did* pass through it keeps the highlight.
 * Measured before this existed: free-scrolling to the final two sections left
 * "Admin Kundalis" lit. At the true end of the document, the last section is
 * what you are looking at.
 */
export function edgeSectionId(
  scrollY: number,
  innerHeight: number,
  scrollHeight: number,
  threshold = EDGE_THRESHOLD,
): string | null {
  if (scrollY < threshold) return ADMIN_SECTIONS[0].id;
  if (scrollY + innerHeight >= scrollHeight - threshold) {
    return ADMIN_SECTIONS[ADMIN_SECTIONS.length - 1].id;
  }
  return null;
}

export function useAdminSectionNav() {
  const [active, setActive] = useState<string>(ADMIN_SECTIONS[0].id);

  /**
   * Set while a programmatic smooth scroll is in flight. Without it the
   * observer fires for every section the animation passes through and the
   * highlight flickers across the whole list before settling.
   */
  const jumpingTo = useRef<string | null>(null);
  const jumpTimer = useRef<ReturnType<typeof setTimeout>>();

  const scrollTo = useCallback((id: AdminSectionId) => {
    const el = document.getElementById(id);
    if (!el) return;

    jumpingTo.current = id;
    setActive(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });

    // replaceState, not a hash assignment: a hash assignment jumps instantly
    // (cancelling the smooth scroll) and pushes a history entry per click, so
    // Back would walk the operator through every section they visited.
    window.history.replaceState(null, "", `#${id}`);

    clearTimeout(jumpTimer.current);
    jumpTimer.current = setTimeout(() => {
      jumpingTo.current = null;
    }, 700);
  }, []);

  // Scroll-spy.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (jumpingTo.current) return;
        const id = pickActiveEntry(entries);
        if (id) setActive(id);
      },
      // Top band only: a section counts as "current" once its heading is in the
      // upper fifth of the viewport, which is how the eye reads a long page.
      { root: null, rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );

    for (const section of ADMIN_SECTIONS) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    // See edgeSectionId: the observer alone cannot highlight correctly at either
    // end of the document.
    const onScroll = () => {
      if (jumpingTo.current) return;
      const edge = edgeSectionId(
        window.scrollY,
        window.innerHeight,
        document.documentElement.scrollHeight,
      );
      if (edge) setActive(edge);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Deep link: /admin#admin-users. Deferred a frame because the sections render
  // their loading states first and are shorter than their final height.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    if (!ADMIN_SECTIONS.some((s) => s.id === hash)) return;

    const timer = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(hash);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => () => clearTimeout(jumpTimer.current), []);

  return { active, scrollTo };
}
