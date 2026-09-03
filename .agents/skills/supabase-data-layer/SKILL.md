---
name: supabase-data-layer
description: Use when working on anything that touches the backend or user state — Supabase edge functions, SQL migrations, RLS policies, auth, route guards, redirects after login/payment, TanStack Query caching, or the Zustand stores. Triggers on "edge function", "migration", "RLS", "auth", "login", "sign out", "protected route", "paid route", "guest mode", "user_profiles", "supabase", "react-query", "zustand", "payment status", "kundali history".
---

# VedicFinance — Supabase & data layer

The SPA talks to Supabase (Postgres + Auth + Edge Functions), which in turn talks to Zoho Payments, OpenAI, and Prokerala. `docs/ARCHITECTURE.md` has the full diagram — read it before any structural change.

## Client

`src/lib/supabase.ts` is the single client. It reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; `.env.example` is the contract for every variable. Never construct a second client.

Secrets for edge functions (`OPENAI_API_KEY`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) live in **Supabase Dashboard → Edge Functions → Secrets**, not in `.env`. A `VITE_`-prefixed secret is shipped to the browser — if you find yourself adding one for a private key, that's the wrong layer.

## Edge functions

Ten live in `supabase/functions/` (plus `_shared/`): `chat`, `generate-report`, `create-payment-order`, `payment-status`, `payment-webhook`, `admin-user-management`, `business-decision`, `investment-baskets`, `luxury-analysis`, `market-data`. Copy the shape of `supabase/functions/chat/index.ts`:

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization") ?? "";   // forward to downstream calls
  // ...
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

Deno, not Node — URL imports, `Deno.env.get`, no `package.json`. Reuse `_shared/`: `cors.ts`, `get-report.ts` (fetches computed chart data), `vedic-helpers.ts`, `zoho.ts`. Don't inline a copy of what's already in `_shared/`.

Degrade gracefully when a secret is missing — `chat/index.ts` returns a friendly `reply` instead of a 500. Follow that.

### Calling them

Client-side calls go through `src/lib/vedicfinance-api.ts`, which wraps `supabase.functions.invoke(...)` and owns the `sessionId` convention. Payments go through `src/lib/payment-api.ts` (`createPaymentOrder`, `pollPaymentStatus`). Kundali persistence goes through `src/lib/kundali-history.ts` (`saveKundaliReport`, `getUserKundalis`, `getKundaliBySlug`, `getKundaliById`). Add new calls to the matching module rather than invoking from a component.

## Migrations & RLS

`supabase/migrations/NNN_name.sql`, applied in filename order. **`005` is intentionally absent — do not renumber existing files.** Next new file is `011_`.

Every table gets RLS. The reference is `002_user_profiles.sql`:

```sql
alter table user_profiles enable row level security;

create policy "users manage own profile" on user_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
```

A table added without `enable row level security` is readable by every anon key holder. There is no separate API layer protecting it.

## Auth

`src/lib/auth-context.tsx` exposes `AuthProvider` and `useAuth()` → `{ session, user, loading, signOut }`. `AuthProvider` sits inside `BrowserRouter` in `src/App.tsx`.

**Footgun — read before adding any cached user data.** The `SIGNED_OUT` branch of `onAuthStateChange` explicitly clears: `kundliRequest`, `kundliReport`, `kundliReportKey`, `lastKundaliSlug`, `lastKundaliId`, `luxuryAnalysis`, `investmentBaskets`, `sessionId`, `guestMode` from `sessionStorage`; `moonSign` from `localStorage`; and every `financialSummary_*` key by prefix scan. It then does a hard `window.location.href` redirect to clear React state.

If you cache anything user-scoped in `sessionStorage`/`localStorage` and don't add it to that list, **the next user who signs in on the same browser sees the previous user's chart data.** Prefer the `financialSummary_*`-style prefix so the existing scan catches it.

## Routing & guards

Never hand-roll a redirect. `src/lib/resolve-destination.ts` is the single source of truth:

- `resolveDestination(state, intent?)` — where a CTA should send the user.
- `getRedirectForRoute(state, requirement)` — returns a path to redirect to, or `null` if the requirement is met.

`UserState` is `{ isAuthenticated, onboardingDone, hasPaid }`. Requirements ladder: `"auth"` → `"onboarded"` → `"paid"`.

Guards consume it:

| Guard | Usage | Fails to |
|---|---|---|
| `ProtectedRoute` | `require="auth"` (default) or `"onboarded"` | `/home`, then `/auth` |
| `PaidRoute` | wraps `/kundali` | `/home` → `/auth` → `/payment` |

Both show a spinner while `loading`, and both bypass every check when `sessionStorage.guestMode === "true"` (demo/testing only — don't build features that depend on it).

## Server state

`useUserStatus()` (`src/hooks/useUserStatus.ts`) reads `onboarding_done` / `has_paid` from `user_profiles` via TanStack Query — key `[USER_STATUS_KEY, user.id]`, `staleTime` 30s, `gcTime` 60s (deliberately short; long gc kept stale paid/unpaid state alive on mobile). On error it returns `{ onboardingDone: false, hasPaid: false }`, i.e. fails closed.

After any write that changes payment or onboarding state, invalidate `USER_STATUS_KEY` — otherwise the user sits on `/payment` for up to 30s after paying.

## Client state (Zustand)

`src/lib/report-store.ts` and `src/lib/feedback-store.ts`.

- Stores **hydrate synchronously from `sessionStorage` at creation** so there's no skeleton flash on navigation. Preserve that; don't move hydration into a `useEffect`.
- Subscribe per slice: `const scores = useReportStore(s => s.scores)`. Subscribing to the whole store re-renders on every unrelated change.
- `feedback-store.ts` documents its `card_feedback` table and RLS policies in its header comment — keep that comment in sync with `supabase/migrations/006_card_feedback.sql`.
