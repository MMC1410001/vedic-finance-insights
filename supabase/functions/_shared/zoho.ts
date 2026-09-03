/**
 * Shared Zoho Payments service module.
 * Handles OAuth token refresh, checkout session creation,
 * session status retrieval, and webhook HMAC verification.
 */

// ─── Token cache ──────────────────────────────────────────────────────────────
//
// Problem: Supabase Edge Functions run on Deno Deploy. Each cold-start spins a
// fresh isolate, so a plain in-memory variable loses its value and every cold
// invocation is forced to hit accounts.zoho.in for a new OAuth token before it
// can do anything useful. That adds 200–600 ms of latency to both
// create-payment-order and payment-status — inconsistently, depending on
// whether the isolate happened to be warm.
//
// Fix: use Deno KV as a cross-isolate token store. A warm isolate still reads
// from the in-memory variable (zero overhead). A cold isolate reads from KV
// (~5 ms local read) before falling back to a real OAuth refresh. The token is
// written to KV on every genuine refresh so the next cold start benefits from it.
//
// KV key layout: ["zoho_token", "access_token"] and ["zoho_token", "expires_at"]

let _memToken: string | null = null;
let _memExpiresAt = 0; // Unix ms

/** Open KV once and reuse — returns null if KV is not available. */
let _kv: Deno.Kv | null | undefined = undefined; // undefined = not yet attempted
async function getKv(): Promise<Deno.Kv | null> {
  if (_kv !== undefined) return _kv;
  try {
    _kv = await Deno.openKv();
  } catch {
    // KV not available in this runtime — fall back to memory-only
    _kv = null;
  }
  return _kv;
}

// ─── Environment helpers ──────────────────────────────────────────────────────
function env(key: string): string {
  const val = Deno.env.get(key);
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function zohoApiBase(): string {
  return Deno.env.get("ZOHO_API_BASE") || "https://payments.zoho.in/api/v1";
}

function zohoAccountId(): string {
  return env("ZOHO_ACCOUNT_ID");
}

// ─── OAuth Token Management ───────────────────────────────────────────────────

/**
 * Refresh the Zoho OAuth access token using the stored refresh token.
 * Retries up to 3 times with exponential backoff on rate-limit (400/429)
 * responses. Writes the new token to both the in-memory cache and Deno KV
 * so that the next cold-start isolate can skip the OAuth round-trip.
 */
export async function refreshAccessToken(): Promise<string> {
  const clientId = env("ZOHO_CLIENT_ID");
  const clientSecret = env("ZOHO_CLIENT_SECRET");
  const refreshToken = env("ZOHO_REFRESH_TOKEN");

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const MAX_RETRIES = 3;
  let lastError = "";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 2s, 4s, 8s — give Zoho time to lift rate limit
      const delay = 2000 * Math.pow(2, attempt - 1);
      console.warn(`Zoho token refresh rate-limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((r) => setTimeout(r, delay));
    }

    const res = await fetch("https://accounts.zoho.in/oauth/v2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    // Rate-limited — retry with backoff
    if (res.status === 429 || res.status === 400) {
      const text = await res.text();
      let isRateLimit = res.status === 429;
      if (!isRateLimit) {
        try {
          const parsed = JSON.parse(text);
          isRateLimit = parsed.error === "Access Denied" &&
            typeof parsed.error_description === "string" &&
            parsed.error_description.toLowerCase().includes("too many requests");
        } catch { /* not JSON */ }
      }

      if (isRateLimit && attempt < MAX_RETRIES - 1) {
        lastError = `Zoho token refresh rate-limited (${res.status}): ${text}`;
        continue; // retry
      }
      // Last attempt or non-rate-limit 400 — throw
      throw new Error(`Zoho token refresh failed (${res.status}): ${text}`);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Zoho token refresh failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    if (!data.access_token) {
      throw new Error(
        `Zoho token refresh returned no access_token: ${JSON.stringify(data)}`
      );
    }

    // Expire 90s early — comfortable buffer before Zoho rejects the token.
    const expiresIn = (data.expires_in || 3600) as number;
    const expiresAt = Date.now() + (expiresIn - 90) * 1000;

    // Update in-memory cache
    _memToken = data.access_token as string;
    _memExpiresAt = expiresAt;

    // Persist to Deno KV so cold-start isolates don't need to refresh
    const kv = await getKv();
    if (kv) {
      await kv.set(["zoho_token", "access_token"], _memToken, {
        expireIn: (expiresIn - 90) * 1000,
      });
      await kv.set(["zoho_token", "expires_at"], expiresAt, {
        expireIn: (expiresIn - 90) * 1000,
      });
    }

    return _memToken;
  }

  // All retries exhausted
  throw new Error(`Zoho token refresh failed after ${MAX_RETRIES} attempts: ${lastError}`);
}

/**
 * Clear the in-memory and KV token cache, then fetch a fresh token.
 * Only called when a 401 response confirms the current token is actually invalid.
 */
async function invalidateAndRefreshToken(): Promise<string> {
  _memToken = null;
  _memExpiresAt = 0;
  const kv = await getKv();
  if (kv) {
    await kv.delete(["zoho_token", "access_token"]);
    await kv.delete(["zoho_token", "expires_at"]);
  }
  return refreshAccessToken();
}

/**
 * Get a valid access token.
 *
 * Resolution order (fastest → slowest):
 *   1. In-memory cache  — 0 ms  (warm isolate, token still valid)
 *   2. Deno KV          — ~5 ms (cold isolate, token persisted from last refresh)
 *   3. OAuth refresh    — 200–600 ms (token missing or expired everywhere)
 */
export async function getAccessToken(): Promise<string> {
  // 1. In-memory hit
  if (_memToken && Date.now() < _memExpiresAt) {
    return _memToken;
  }

  // 2. KV hit
  const kv = await getKv();
  if (kv) {
    const [tokenEntry, expiryEntry] = await Promise.all([
      kv.get<string>(["zoho_token", "access_token"]),
      kv.get<number>(["zoho_token", "expires_at"]),
    ]);

    const kvToken = tokenEntry.value;
    const kvExpiry = expiryEntry.value ?? 0;

    if (kvToken && Date.now() < kvExpiry) {
      // Populate in-memory cache so subsequent calls in the same isolate are free
      _memToken = kvToken;
      _memExpiresAt = kvExpiry;
      return _memToken;
    }
  }

  // 3. Full OAuth refresh
  return await refreshAccessToken();
}

// ─── Checkout Session ─────────────────────────────────────────────────────────

export interface CreateCheckoutParams {
  orderId: string;
  amount: number;
  currency: string;
  description: string;
}

export interface CheckoutSessionResult {
  session_id?: string;
  payments_session_id?: string;
  payment_session_id?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Create a Zoho Payments checkout session.
 * Retries once on 401 (token expired mid-flight).
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<CheckoutSessionResult> {
  const accountId = zohoAccountId();
  const url = `${zohoApiBase()}/paymentsessions?account_id=${accountId}`;

  const body = {
    amount: params.amount.toFixed(2),
    currency: params.currency,
    description: params.description,
    reference_number: params.orderId,
  };

  console.log("Zoho createCheckoutSession request:", JSON.stringify({ url, body }));

  let token = await getAccessToken();

  let res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Zoho-oauthtoken ${token}`,
    },
    body: JSON.stringify(body),
  });

  // Retry once on 401 — token expired mid-flight. Invalidate cache and refresh.
  if (res.status === 401) {
    token = await invalidateAndRefreshToken();
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Zoho-oauthtoken ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho createCheckoutSession failed (${res.status}): ${text}`);
  }

  return (await res.json()) as CheckoutSessionResult;
}

// ─── Session Status ───────────────────────────────────────────────────────────

export interface PaymentSessionStatus {
  status: string;
  payment_id?: string;
  [key: string]: unknown;
}

/**
 * Get the status of a Zoho payment session.
 * Retries once on 401 (token expired mid-flight).
 */
export async function getPaymentSessionStatus(
  sessionId: string
): Promise<PaymentSessionStatus> {
  const accountId = zohoAccountId();
  const url = `${zohoApiBase()}/paymentsessions/${sessionId}?account_id=${accountId}`;

  let token = await getAccessToken();

  let res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });

  // Retry once on 401 — token expired mid-flight. Invalidate cache and refresh.
  if (res.status === 401) {
    token = await invalidateAndRefreshToken();
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho getPaymentSessionStatus failed (${res.status}): ${text}`);
  }

  return (await res.json()) as PaymentSessionStatus;
}

// ─── Webhook HMAC Verification ────────────────────────────────────────────────

/**
 * Verify a Zoho webhook signature using HMAC-SHA256.
 *
 * The X-Zoho-Webhook-Signature header format:
 *   t=<unix_timestamp>,v=<hex_signature>
 *
 * Signed payload: `<timestamp>.<raw_body_string>`
 */
export async function verifyWebhookSignature(
  rawBody: Uint8Array,
  signatureHeader: string
): Promise<boolean> {
  const secret = env("ZOHO_WEBHOOK_SECRET");

  // Parse header: t=<timestamp>,v=<signature>
  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(",")) {
    const eqIdx = segment.indexOf("=");
    if (eqIdx > 0) {
      parts[segment.slice(0, eqIdx).trim()] = segment.slice(eqIdx + 1).trim();
    }
  }

  const timestamp = parts["t"];
  const signature = parts["v"];
  if (!timestamp || !signature) return false;

  // Build the signed payload: timestamp.body
  const signedPayload = `${timestamp}.${new TextDecoder().decode(rawBody)}`;

  // Compute HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );

  const computed = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (computed.length !== signature.length) return false;

  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }

  return mismatch === 0;
}
