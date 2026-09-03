/**
 * Campaign attribution — which marketing link brought this person here.
 *
 * A tagged link (`?utm_source=whatsapp&utm_medium=message&utm_campaign=…`) tells
 * GA4 where a *session* came from and then the trail dies, because the events
 * that matter — kundali_generated, signed_in, payment_started — exist only in our
 * own visitor_events log. This module is the missing half: it reads the campaign
 * off the landing URL, persists it, and hands it to visitor-tracking.ts so the
 * `visit` row carries the campaign that produced it.
 *
 * ── Why anything is persisted at all ───────────────────────────────────────
 * The session id lives in sessionStorage and dies with the tab. A WhatsApp click
 * on Monday and a signup on Wednesday would be two unrelated universes. Worse,
 * *no* call site forwards window.location.search into signInWithOAuth's
 * redirectTo — Google's round trip returns to a bare `/auth` — so a campaign that
 * only lived in the URL would be gone by the time the account exists.
 *
 * Hence three stores, each answering a different question:
 *
 *   afVisitorId   localStorage    which browser is this (across sessions)
 *   afFirstTouch  localStorage    which campaign ACQUIRED them (write-once)
 *   afLastTouch   sessionStorage  which campaign started THIS session
 *
 * First touch is what a campaign gets credit for; last touch is what the current
 * session's rows are stamped with. They differ for anyone who arrives twice, and
 * conflating them would let a retargeting link steal the acquisition.
 *
 * ── Nothing here records anything on its own ───────────────────────────────
 * trackingSuppressed() is consulted first, same as both tracking paths. The
 * /admin heatmap frames real pages; without that guard, opening the panel would
 * capture and — worse — rewrite the framed page's URL underneath it.
 */

import { supabase } from "./supabase";
import { trackingSuppressed } from "./tracking-scope";
import { normalisePath } from "./tracked-pages";

/** Permanent, one per browser. Not cleared on sign-out — see auth-context.tsx. */
const VISITOR_ID_KEY = "afVisitorId";
/** Write-once acquisition record, in localStorage so it survives the tab. */
const FIRST_TOUCH_KEY = "afFirstTouch";
/** This session's campaign, alongside sessionId. Cleared on sign-out. */
const LAST_TOUCH_KEY = "afLastTouch";
/** Guard so one session makes at most one stamp_first_touch round trip. */
const STAMPED_KEY = "afFirstTouchStamped";

/**
 * How long a first touch keeps its claim.
 *
 * Not a privacy figure — a shared-device mitigation. Without an expiry, the
 * second person to sign up on an office laptop inherits the first person's
 * campaign forever. Ninety days is well past any reasonable consideration window
 * for a ₹99 report while still eventually forgetting.
 */
const FIRST_TOUCH_TTL_DAYS = 90;
const FIRST_TOUCH_TTL_MS = FIRST_TOUCH_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Longest value we keep. Anything longer is rejected, never truncated — see below. */
const MAX_UTM_LEN = 64;
const MAX_CLICK_ID_LEN = 128;

/** The params we own. Everything else on the URL is left exactly as it was. */
const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const CLICK_ID_PARAMS = ["gclid", "fbclid"] as const;

export interface Attribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  /** Google/Meta ad click id, if the link carried one. */
  click_id: string | null;
  click_id_source: "gclid" | "fbclid" | null;
  /** Normalised path they landed on, so `/shared/:slug` never stores a token. */
  landing_path: string | null;
  visitor_id: string | null;
}

export interface FirstTouch extends Attribution {
  /** ISO timestamp of the claim. Also what the TTL is measured against. */
  first_touch_at: string;
}

/**
 * In-memory fallbacks.
 *
 * Safari private mode, iOS Lockdown and "block all site data" make every
 * storage write throw. Losing the cross-session link there is unavoidable, but
 * losing the *landing row's* campaign is not: the value is parsed either way and
 * kept here, so the visit that just happened is still attributed correctly.
 */
let memoryTouch: Attribution | null = null;
let memoryVisitorId: string | null = null;

/** captureAttribution() is idempotent per page load; this is the latch. */
let captured = false;

/* ────────────────────────────── storage helpers ───────────────────────────── */

function readStore(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(store: Storage, key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch {
    /* private mode — the memory fallbacks above cover this page load */
  }
}

function readJson<T>(store: Storage, key: string): T | null {
  const raw = readStore(store, key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    // A hand-edited or half-written value is not worth crashing boot over.
    return null;
  }
}

/* ──────────────────────────────── normalising ─────────────────────────────── */

/**
 * Anything that looks like it identifies a person, rather than an advert.
 *
 * Mail-merged links are the real case: `utm_content=ravi@gmail.com` or a phone
 * number pasted into a broadcast tool. Such a value is dropped **whole** rather
 * than scrubbed, because a scrubbed one still reads as a plausible campaign name
 * in a report and nobody would ever notice it was somebody's email.
 */
const LOOKS_LIKE_PII = /@|%40|\d{7,}/;

/**
 * Lowercase, hyphenated, `[a-z0-9._-]` only, at most 64 characters.
 *
 * Lowercasing is the whole reason our own reports do not split `Whatsapp`,
 * `whatsapp` and `WhatsApp` into three campaigns. (GA4 still splits them — it
 * matches case-sensitively and we cannot change that, which is why
 * docs/CAMPAIGN-UTM-GUIDE.md asks for lowercase at the source.)
 *
 * Over-length values are rejected, not truncated, and the server does the same:
 * a clipped campaign name is a *different* campaign, and would quietly become a
 * second row that looks like a real one.
 */
function normaliseUtmValue(raw: string | null): string | null {
  if (!raw) return null;
  if (LOOKS_LIKE_PII.test(raw)) return null;

  const value = raw
    .trim()
    .toLowerCase()
    // URLSearchParams already decodes `+` to a space; both become a hyphen so
    // `Community+message` and `Community message` land on the same row.
    .replace(/[\s+]+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-{2,}/g, "-")
    // Underscore is stripped from the ends as well as `-` and `.`, and that is
    // not cosmetic: the server's validator requires the first character to be
    // [a-z0-9], so `_promo` used to be kept here, pushed to GTM, and then
    // dropped by track-visit — the campaign appeared in GA4 and was missing from
    // /admin, with no error on either side. Both ends must agree.
    .replace(/^[-._]+|[-._]+$/g, "");

  if (!value || value.length > MAX_UTM_LEN) return null;
  return value;
}

/** Ad click ids are case-significant, so this validates rather than normalises. */
function readClickId(params: URLSearchParams): Pick<Attribution, "click_id" | "click_id_source"> {
  for (const name of CLICK_ID_PARAMS) {
    const raw = params.get(name);
    if (!raw) continue;
    if (raw.length > MAX_CLICK_ID_LEN || !/^[A-Za-z0-9_.-]+$/.test(raw)) continue;
    return { click_id: raw, click_id_source: name };
  }
  return { click_id: null, click_id_source: null };
}

/* ─────────────────────────────── the visitor id ───────────────────────────── */

/**
 * The one identifier that survives a closed tab.
 *
 * Random, per-browser, and carries nothing about the person — it exists so the
 * session that clicked the advert and the session that came back and paid can be
 * recognised as the same browser. On a storage failure it falls back to a
 * per-page-load value: that browser then reports one visitor per load, which is
 * wrong but harmless, and better than sending null.
 */
export function ensureVisitorId(): string {
  const existing = readStore(localStorage, VISITOR_ID_KEY);
  if (existing) return existing;
  if (memoryVisitorId) return memoryVisitorId;

  const id = crypto.randomUUID();
  memoryVisitorId = id;
  writeStore(localStorage, VISITOR_ID_KEY, id);
  return id;
}

/* ──────────────────────────────── the capture ─────────────────────────────── */

/** Reads the five UTMs + a click id, or null when the URL is untagged. */
function readTouch(params: URLSearchParams): Attribution | null {
  const utms = {
    utm_source: normaliseUtmValue(params.get("utm_source")),
    utm_medium: normaliseUtmValue(params.get("utm_medium")),
    utm_campaign: normaliseUtmValue(params.get("utm_campaign")),
    utm_content: normaliseUtmValue(params.get("utm_content")),
    utm_term: normaliseUtmValue(params.get("utm_term")),
  };
  const click = readClickId(params);

  const tagged =
    Object.values(utms).some((v) => v !== null) || click.click_id !== null;
  if (!tagged) return null;

  return {
    ...utms,
    ...click,
    landing_path: normalisePath(window.location.pathname),
    visitor_id: null, // filled by captureAttribution once the id is minted
  };
}

/**
 * Remove our params from the address bar, leaving every other one alone.
 *
 * Two reasons. A user who copies the URL out of their address bar and shares it
 * would otherwise re-attribute someone else's session to a campaign they never
 * saw; and a tagged URL that stays in history means a back-navigation re-reads
 * it as a fresh arrival.
 *
 * `intent` (AuthPage builds redirectTo from it), `embed` and `preview`
 * (tracking-scope reads both) must survive untouched, so this deletes a known
 * list rather than clearing the search string.
 */
function cleanUrl(params: URLSearchParams): void {
  try {
    for (const name of [...UTM_PARAMS, ...CLICK_ID_PARAMS]) params.delete(name);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    );
  } catch {
    /* history unavailable — the URL stays tagged, which costs nothing */
  }
}

function claimFirstTouch(touch: Attribution): void {
  const existing = readJson<FirstTouch>(localStorage, FIRST_TOUCH_KEY);
  if (existing?.first_touch_at) {
    const age = Date.now() - Date.parse(existing.first_touch_at);
    // NaN (a corrupt timestamp) is not > TTL, so a bad value keeps its claim
    // rather than letting every later visit overwrite it.
    if (!(age > FIRST_TOUCH_TTL_MS)) return;
  }
  const first: FirstTouch = { ...touch, first_touch_at: new Date().toISOString() };
  writeStore(localStorage, FIRST_TOUCH_KEY, JSON.stringify(first));
}

/**
 * Read the campaign off this page load. Call once, before anything renders.
 *
 * Order matters and is load-bearing — see the call in main.tsx.
 *
 * An **untagged** load deliberately does nothing beyond minting the visitor id:
 * it must not clear the session's last touch (that is what survives the OAuth
 * return to a bare `/auth`), and it must not claim first touch as `direct`
 * (which would permanently mark someone as organic and make every campaign they
 * later arrive from look like it acquired nobody).
 */
export function captureAttribution(): void {
  if (captured) return;
  captured = true;

  try {
    // Same gate as both tracking paths: an embed or /admin captures nothing —
    // and, importantly, rewrites no URL.
    if (trackingSuppressed()) return;

    const params = new URLSearchParams(window.location.search);
    const touch = readTouch(params);
    const visitorId = ensureVisitorId();
    if (!touch) return;

    const withVisitor: Attribution = { ...touch, visitor_id: visitorId };
    memoryTouch = withVisitor;
    writeStore(sessionStorage, LAST_TOUCH_KEY, JSON.stringify(withVisitor));
    claimFirstTouch(withVisitor);
    cleanUrl(params);
  } catch {
    /* crypto or storage unavailable — must never break boot */
  }
}

/**
 * The campaign this session landed on, or null for untagged traffic.
 *
 * This is what the `visit` row is stamped with. It falls back to the in-memory
 * value so a private-mode browser still attributes the page load it is on.
 */
export function currentAttribution(): Attribution | null {
  return readJson<Attribution>(sessionStorage, LAST_TOUCH_KEY) ?? memoryTouch;
}

/**
 * What the `visit` row is stamped with: the campaign, and always the visitor id.
 *
 * These two used to travel as one block, which quietly made the id conditional
 * on the URL being tagged — currentAttribution() returns null for an untagged
 * arrival, so `visitor_id` reached visitor_events only for campaign traffic.
 * Every other session then landed in admin_audience's `unknown` bucket, and the
 * new-vs-returning split could only ever describe people who arrived from a
 * marketing link, while the panel explained the gap as a pre-019 backlog that
 * would fill in on its own. It would not have.
 *
 * The id is browser identity, not campaign data, so it is attached here rather
 * than inside the touch. sanitiseAttribution() keeps a block where any single
 * field is non-null, so an id on its own is stored with the campaign columns
 * left empty — which is exactly what an untagged visit is.
 *
 * No suppression check of its own: the one caller, trackVisit(), has already
 * asked. Minting an id is a side effect, so it must not happen on /admin.
 */
export function visitAttribution(): Partial<Attribution> | null {
  const touch = currentAttribution();

  let visitorId: string | null = null;
  try {
    visitorId = ensureVisitorId();
  } catch {
    /* crypto or storage unavailable — a campaign, if any, still travels */
  }

  if (!touch && !visitorId) return null;
  return { ...(touch ?? {}), visitor_id: visitorId };
}

/**
 * The campaign that first brought this browser here, if any — and only while
 * its claim is still inside the TTL.
 *
 * The expiry is checked on READ, not only on write. Checking it solely in
 * claimFirstTouch() meant the TTL governed replacement and nothing else: a
 * stored claim never lapsed on its own, so the shared-laptop case the TTL exists
 * for — "the second person to sign up inherits the first person's campaign
 * forever" — still happened, unless that second person happened to arrive on a
 * differently-tagged link. An untagged arrival writes nothing by design, which
 * is exactly the arrival a colleague makes.
 *
 * A corrupt timestamp parses to NaN, which is not > TTL, so it keeps its claim
 * rather than being silently discarded. Same rule as claimFirstTouch.
 */
export function firstTouchAttribution(): FirstTouch | null {
  const stored = readJson<FirstTouch>(localStorage, FIRST_TOUCH_KEY);
  if (!stored) return null;
  if (stored.first_touch_at) {
    const age = Date.now() - Date.parse(stored.first_touch_at);
    if (age > FIRST_TOUCH_TTL_MS) return null;
  }
  return stored;
}

/**
 * The platform an ad click id came from, named the way a utm_source would be.
 *
 * The mirror of click_network() in migration 019, and it exists for the same
 * reason: Google Ads and Meta auto-tagging append `gclid`/`fbclid` and no
 * utm_source at all. The session half of the Campaigns table now labels those
 * `google` / `facebook`; without this the USER half would still label the same
 * person `(none)`, and one campaign's sessions and its revenue would land on two
 * different rows of the same table.
 *
 * Kept in step with the SQL. If the two disagree, the table contradicts itself.
 */
function networkForClickId(source: Attribution["click_id_source"]): string | null {
  if (source === "gclid") return "google";
  if (source === "fbclid") return "facebook";
  return null;
}

/**
 * Copy first touch onto the user's profile, once, permanently.
 *
 * visitor_events is purged after 180 days; an account's acquisition source
 * should outlive that. The write-once guard is in SQL (`first_touch_at is null`
 * inside stamp_first_touch), so this being called twice — or from both call
 * sites — cannot overwrite an earlier campaign with a later one.
 *
 * Called from the SIGNED_IN handler *and* after the user_profiles upsert that
 * creates the row, because on a brand-new signup the row does not exist yet when
 * SIGNED_IN fires and an UPDATE would match nothing.
 */
export async function stampFirstTouchOnce(): Promise<void> {
  try {
    const first = firstTouchAttribution();
    if (!first) return; // untagged acquisition: nothing to record
    if (readStore(sessionStorage, STAMPED_KEY) === "1") return;

    // An ad click with no utm_source is still paid acquisition, and must be
    // recorded under the same name the session half of the table uses.
    const network = networkForClickId(first.click_id_source);

    const { data, error } = await supabase.rpc("stamp_first_touch", {
      p_source: first.utm_source ?? network,
      p_medium: first.utm_medium ?? (network ? "cpc" : null),
      p_campaign: first.utm_campaign,
      p_content: first.utm_content,
      p_term: first.utm_term,
      p_landing_path: first.landing_path,
      p_visitor_id: first.visitor_id,
      p_first_touch_at: first.first_touch_at,
    });

    // Latch only on a row actually written. The RPC returns null when it
    // matched nothing — which on a brand-new signup means the user_profiles row
    // does not exist yet, and the call site that runs after the upsert must
    // still get its turn. (It also returns null for an already-stamped user, so
    // a returning user costs one cheap RPC per sign-in. That is the price of not
    // needing a second query to tell those two cases apart.)
    if (!error && data === true) writeStore(sessionStorage, STAMPED_KEY, "1");
  } catch {
    /* attribution must never break a sign-in */
  }
}

/**
 * The session's campaign, shaped for the GTM dataLayer.
 *
 * Flat `traffic_*` keys rather than the raw `utm_*` names: GA4 already owns
 * `utm_*` as its own attribution, and a custom parameter colliding with one is
 * how a report ends up showing two different answers to the same question.
 * Registered as event-scoped custom dimensions in GA4 — without that they exist
 * in the payload and appear in no report.
 */
export function campaignParams(): Record<string, string> | null {
  const touch = currentAttribution();
  if (!touch) return null;

  const params: Record<string, string> = {};
  if (touch.utm_source) params.traffic_source = touch.utm_source;
  if (touch.utm_medium) params.traffic_medium = touch.utm_medium;
  if (touch.utm_campaign) params.traffic_campaign = touch.utm_campaign;
  if (touch.utm_content) params.traffic_content = touch.utm_content;
  if (touch.utm_term) params.traffic_term = touch.utm_term;
  return Object.keys(params).length > 0 ? params : null;
}

/** Test seam. Clears the module's latch and its in-memory fallbacks. */
export function __resetAttribution(): void {
  captured = false;
  memoryTouch = null;
  memoryVisitorId = null;
}
