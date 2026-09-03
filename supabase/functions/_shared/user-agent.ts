/**
 * User-agent classification for edge functions.
 *
 * Derived here, at write time, and stored in columns — rather than parsed in SQL
 * when the dashboard asks. Two reasons: every analytics aggregate would otherwise
 * repeat the same regex work over the whole log, and a UA string is a
 * high-cardinality mess that no `group by` can usefully bucket.
 *
 * Deliberately coarse. The questions this answers are "is mobile traffic
 * converting worse than desktop" and "is anything broken in one browser" — not
 * "which minor version of Chrome". A full UA parser would be a dependency, and
 * the raw string is kept in visitor_events.user_agent anyway for the rare case
 * that needs more.
 *
 * Note on Chrome-family detection: Edge, Opera, Samsung Internet and Brave all
 * carry "Chrome" in their UA, so order matters — the specific tokens have to be
 * tested before the generic one, or everything collapses into "Chrome".
 */

export interface UserAgentFacts {
  /** "mobile" | "tablet" | "desktop" | null when there was no UA at all. */
  device: string | null;
  browser: string | null;
  os: string | null;
}

export function classifyUserAgent(ua: string | null | undefined): UserAgentFacts {
  if (!ua) return { device: null, browser: null, os: null };

  const s = ua.toLowerCase();

  // iPad reports "macintosh" in desktop-mode Safari, so the tablet checks come
  // first and "ipad" is matched before "macintosh" can claim it.
  const device = /ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(s)
    ? "tablet"
    : /mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(s)
      ? "mobile"
      : "desktop";

  const browser =
    // Bots first, and headless Chrome is the reason. It carries "Chrome" in its
    // UA, so testing Chrome earlier files automated traffic as real visitors and
    // inflates every session count in the funnel.
    /bot|crawler|spider|headless/.test(s) ? "Bot"
    : /edg\//.test(s) ? "Edge"
    : /opr\/|opera/.test(s) ? "Opera"
    : /samsungbrowser/.test(s) ? "Samsung Internet"
    : /firefox|fxios/.test(s) ? "Firefox"
    : /chrome|crios/.test(s) ? "Chrome"
    // Safari must come after Chrome: every Chrome UA also says "safari".
    : /safari/.test(s) ? "Safari"
    : "Other";

  const os =
    /windows/.test(s) ? "Windows"
    // iPhone/iPad before macOS, same reason as the device check above.
    : /iphone|ipad|ipod/.test(s) ? "iOS"
    : /android/.test(s) ? "Android"
    : /mac os x|macintosh/.test(s) ? "macOS"
    : /cros/.test(s) ? "ChromeOS"
    : /linux/.test(s) ? "Linux"
    : "Other";

  return { device, browser, os };
}
