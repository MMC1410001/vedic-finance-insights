# VedicFinance

A full-stack web application that computes sidereal (Vedic) birth charts and turns them into
structured financial insight — seven 0–100 scores across wealth, income, savings, investment,
risk, expense and timing, plus dasha and transit periods, purchase-timing guidance, an AI chat
layer, and an admin analytics panel.

React + TypeScript on the front, Supabase (Postgres, auth, 12 edge functions, 18 migrations)
on the back.

> **On the astrology.** The chart mathematics — ayanamsa correction, house division, planetary
> positions, dasha periods — is deterministic and testable, and that is what the test suite
> covers. The mapping from chart to *financial* score is an interpretation of a traditional
> system, not a predictive model. Nothing here is financial advice, and the app's own disclaimer
> says so.

## What is interesting technically

**Deterministic rule engines, not an LLM guess.** `src/lib/` holds separate engines —
`astro-engine`, `financial-kundali-engine`, `investment-engine`, `bonds-engine`,
`daily-trading-engine`, `business-timing-engine`, `explanation-builder`. Each is a pure function
over chart data, so the same birth details always produce the same scores and every score can be
traced back to the rules that produced it. The LLM is used only for conversational explanation,
never to compute a number.

**Astro computation lives in an edge function.** `supabase/functions/generate-report` runs the
sidereal calculation server-side on Deno. Keeping it off the client means the rule set is not
shipped to the browser, and the heavy computation does not depend on the user's device.

**Row-level security as the authorisation model.** 18 migrations define the schema and its RLS
policies. The browser holds only the anon key; what a user can read is decided by Postgres, not
by front-end code.

**Payment webhook verification.** `payment-webhook` verifies a shared secret before trusting a
callback. An unverified payment webhook is a free-orders endpoint.

## Architecture

```
React 19 + Vite + TypeScript + Tailwind + shadcn/Radix
        │
        ├── src/lib/          deterministic scoring engines
        ├── src/pages/        marketing, report, chat, admin, legal
        └── src/components/   UI, admin analytics, funnel
        │
Supabase
        ├── functions/  generate-report · chat · business-decision · investment-baskets
        │               luxury-analysis · market-data · create-payment-order
        │               payment-status · payment-webhook · track-visit
        │               admin-user-management · _shared
        └── migrations/ 18 migrations: schema + row-level security policies
```

## Tests

```bash
npm install
npm run test          # 34 Vitest files - engines, scoring, utilities
npm run test:e2e      # 8 Playwright specs - report flow, chat, payments, admin
```

The engine tests are the ones that matter: they pin scoring behaviour so a rule change that
shifts every user's numbers cannot land unnoticed.

## Running it

```bash
npm install
cp .env.example .env      # every value is UPDATE HERE; comments say where each comes from
npx supabase start        # local Postgres + edge runtime
npx supabase db reset     # applies all 18 migrations
npm run dev
```

`render.yaml` and `vercel.json` are included for deployment.

## About this repository

This is a de-branded copy of a working product, published as a portfolio piece. The product
name, company name and all customer data have been removed, and every credential in
`.env.example` is a placeholder.

The legal pages (`src/pages/Terms.tsx`, `Disclaimer.tsx`) and the footer are kept because they
are part of the application, but the copyright holder is a `[YOUR COMPANY]` placeholder — this
copy asserts no ownership on anyone's behalf. Fill it in before deploying.

## Tech stack

React 19 · TypeScript · Vite · Tailwind · shadcn/ui + Radix · Supabase (Postgres, Auth, Edge
Functions on Deno) · Vitest · Playwright · OpenAI + Anthropic · Zoho Payments · Microsoft Clarity
