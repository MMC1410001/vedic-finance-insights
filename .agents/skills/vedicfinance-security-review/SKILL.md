---
name: vedicfinance-security-review
description: Review a change for security defects specific to VedicFinance — secret exposure through the Vite bundle, Supabase RLS gaps, service-role blast radius, admin authentication, edge-function authorization, payment webhook integrity, and CORS/CSP posture. Use for "security review", "is this safe", "auth check", "RLS", "secrets", "vulnerability", "harden", "penetration", or before deploying anything touching payments or admin.
---

# VedicFinance — security review

Security review grounded in this app's actual trust boundaries: a public SPA, a Supabase project reachable directly with the anon key, and edge functions holding the service-role key.

**The anon key is public.** Anyone can read it from the bundle and query your Postgres directly. **RLS is the only thing standing between a user and everyone else's data.** Review with that assumption.

## Scope

1. Explicit argument wins.
2. Else uncommitted diff (`git status --porcelain`).
3. Else commits ahead of `origin/af-prod`.
4. Else clean on `af-prod` → ask what to review.

**Report only. Never edit files.** Close with: *"Say `fix <n>` to apply any of these."*

## Output

Ranked most-severe first. Each finding: `file:line`, the claim, a **concrete exploit path** (who does what → what they get), severity `blocker / major / minor / nit`, and a fix sketch. Mark **pre-existing** issues as such.

## Standing risk #1 — the admin chain (pre-existing)

Verify before reporting; reference rather than rediscover:

- `src/pages/Admin.tsx:10` — `const ADMIN_PASSWORD = "test123"`, compared client-side and **shipped in the built bundle** (`dist/assets/Admin-*.js`). Anyone can read it.
- `/admin` has **no route guard** in `src/App.tsx` — no `ProtectedRoute`, no `PaidRoute`, no role check.
- `supabase/functions/admin-user-management/index.ts:15` — `Deno.env.get("ADMIN_SECRET") || "test123"`. If the secret was never set in the dashboard, the published default is live.
- That function then acts with `SUPABASE_SERVICE_ROLE_KEY` on `delete-user`, `reset-payment`, `delete-kundalis`, `cleanup-orphans` — full-database blast radius behind a shared string.

The real fix is a Supabase role/claim check on both the route and the function, not a stronger password. Flag any diff that extends this pattern.

## Service-role key handling

Used in `payment-status`, `payment-webhook`, `admin-user-management`, `create-payment-order`, and as a fallback in `_shared/get-report.ts`. It bypasses RLS entirely.

Check on every edge-function change:
- It never reaches a response body, log line, or error message.
- The function authenticates the caller *before* using it — a service-role query behind no auth check is an open data endpoint.
- Prefer forwarding the caller's `Authorization` header and letting RLS apply, unless the operation genuinely needs elevation.

## Secrets and the `VITE_` boundary

Anything named `VITE_*` is **compiled into the client bundle and public**. `.env.example` correctly puts only `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_ZOHO_ACCOUNT_ID` / `VITE_ZOHO_API_KEY` there, with `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_WEBHOOK_SECRET`, `OPENAI_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as dashboard-only secrets.

Flag as **blocker**: any new `VITE_`-prefixed private credential, any literal key in source, any secret moved from an edge function into the client. Note `supabase/.temp/project-ref` (the project id) is committed — low severity, but it means the project URL is public knowledge.

## RLS on every table

Every migration adding a table must include `enable row level security` **and** a policy. `supabase/migrations/002_user_profiles.sql` is the pattern:

```sql
alter table user_profiles enable row level security;
create policy "users manage own profile" on user_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
```

A table without RLS is world-readable to any anon-key holder. Also check policies aren't too broad — a `using (true)` policy is the same as no RLS. Pay attention to anything backing `/shared/:slug`, which is deliberately public: confirm it exposes only the report, not birth details or user identity beyond intent.

## Payments

`payment-webhook` already does this right — verifies the `X-Zoho-Webhook-Signature` HMAC, rejects on missing/invalid, and dedupes by event id. **Credit it; don't churn on it.**

What to check on payment changes: `has_paid` is only ever set server-side from a verified webhook or a verified status poll, never from client input; amounts/currency come from the server, not the request body; replaying a webhook can't double-grant; a failed or cancelled payment can't leave `has_paid = true`.

## Logging

`src/lib/zoho-payments.ts` logs `sessionId`, `orderId`, `amount`, and the full stringified widget result to the browser console (lines ~134, 146, 155). These reach production consoles and browser-extension readers — pre-existing, low severity, but flag any diff that adds identifiers, tokens, or PII to `console.*`.

## CORS and headers

All edge functions use `Access-Control-Allow-Origin: "*"` (`supabase/functions/_shared/cors.ts`). Acceptable only because auth rides in the `Authorization` header rather than cookies — call it out if any change introduces cookie-based auth, which would make this exploitable.

`vercel.json` sets `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, and `Permissions-Policy`. Its **CSP is only `frame-ancestors 'none'`** — there is no `script-src`/`connect-src`, so a script injection isn't contained. Worth raising when reviewing anything that renders user- or model-supplied content.

## Injection and untrusted content

- The AI chat renders model output through `react-markdown`; `purify` is in the bundle. Verify sanitization stays on for any change that renders HTML.
- Chart/report data flows into PDF generation via `html2canvas` — user-controlled strings (name, birth place) end up in the DOM. Check escaping.
- The `chat` edge function embeds user messages into a system prompt. Prompt injection can't reach the database, but it can make the assistant contradict the product's own rule against specific stock picks and monetary predictions. Treat that as a product-integrity finding.
