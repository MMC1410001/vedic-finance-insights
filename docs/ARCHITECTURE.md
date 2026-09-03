# VedicFinance — Architecture Diagrams

---

## 1. System Overview (High-Level Architecture)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (SPA)                                │
│          React 18 + Vite + TypeScript + TailwindCSS                     │
│                                                                         │
│  ┌──────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  Landing  │  │   Auth &   │  │   Payment    │  │ Financial Kundali│ │
│  │   Pages   │  │ Onboarding │  │    Flow      │  │   (Premium)      │ │
│  └──────────┘  └────────────┘  └──────────────┘  └──────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              Service Layer (src/lib/)                             │   │
│  │  auth-context │ payment-api │ vedicfinance-api │ zoho-payments       │   │
│  │  supabase     │ report-store│ kundali-engine│ resolve-destination │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE (Backend-as-a-Service)                   │
│                                                                         │
│  ┌─────────────────────┐    ┌────────────────────────────────────────┐ │
│  │    Edge Functions    │    │           PostgreSQL Database           │ │
│  │                      │    │                                        │ │
│  │ • create-payment-order│   │ • auth.users (Supabase Auth)           │ │
│  │ • payment-status     │    │ • user_profiles                       │ │
│  │ • payment-webhook    │    │ • kundali_history                     │ │
│  │ • generate-report    │    │ • payment_orders                      │ │
│  │ • chat (AI)          │    │ • webhook_events                      │ │
│  │ • luxury-analysis    │    │ • card_feedback                       │ │
│  │ • investment-baskets │    │                                        │ │
│  │ • market-data        │    └────────────────────────────────────────┘ │
│  │ • business-decision  │                                               │
│  │ • admin-user-mgmt    │    ┌────────────────────────────────────────┐ │
│  └─────────────────────┘    │          Supabase Auth                  │ │
│                              │  (Email/OTP + Session Management)       │ │
│                              └────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                │
│                                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────────────────┐  │
│  │ Zoho Payments│   │  OpenAI /    │   │   Prokerala Vedic API     │  │
│  │  (Gateway)   │   │  AI Provider │   │   (Astrology Data)        │  │
│  └──────────────┘   └──────────────┘   └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. User Journey & Route Architecture

```
                        ┌─────────────┐
                        │   / (Splash) │
                        └──────┬──────┘
                               │ auto-redirect
                               ▼
                        ┌─────────────┐
                        │  /home      │
                        │  (Landing)  │
                        └──────┬──────┘
                               │ CTA Click
                               ▼
                   ┌───────────────────────┐
                   │  resolveDestination() │
                   │  (Centralized Logic)  │
                   └───────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌────────────┐   ┌────────────┐   ┌────────────┐
     │   /auth    │   │  /payment  │   │  /kundali  │
     │ (Sign In + │   │ (Checkout) │   │ (Premium   │
     │  Birth Det)│   │            │   │  Dashboard)│
     └─────┬──────┘   └─────┬──────┘   └────────────┘
           │                 │                ▲
           │ onboarded       │ paid           │
           └─────────────────┴────────────────┘

  ┌──────────────────────────────────────────────────────────────────┐
  │                        ROUTE GUARDS                               │
  │                                                                   │
  │  ProtectedRoute (require="auth")                                  │
  │    └── Checks: isAuthenticated                                    │
  │                                                                   │
  │  ProtectedRoute (require="onboarded")                             │
  │    └── Checks: isAuthenticated + onboardingDone                   │
  │                                                                   │
  │  PaidRoute                                                        │
  │    └── Checks: isAuthenticated + onboardingDone + hasPaid         │
  └──────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────┐
  │                     ALL ROUTES                                    │
  │                                                                   │
  │  PUBLIC:                                                          │
  │    /home, /coming-soon, /boost-wealth, /upcoming-features         │
  │    /terms, /privacy, /disclaimer, /refund-policy, /services       │
  │    /ai-chat, /shared/:slug                                        │
  │                                                                   │
  │  PROTECTED (auth):                                                │
  │    /dashboard, /profile, /business-timing, /vedic-trading, /chat  │
  │                                                                   │
  │  PROTECTED (onboarded):                                           │
  │    /payment                                                       │
  │                                                                   │
  │  PAID:                                                            │
  │    /kundali                                                       │
  │                                                                   │
  │  ADMIN:                                                           │
  │    /admin                                                         │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 3. Authentication & State Flow

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    User      │──────▶│   Supabase Auth  │──────▶│  Session Token   │
│  (Browser)   │       │  (Email / OTP)   │       │  (JWT in memory) │
└──────────────┘       └──────────────────┘       └────────┬─────────┘
                                                           │
                                                           ▼
                                              ┌────────────────────────┐
                                              │    AuthProvider         │
                                              │  (React Context)       │
                                              │                        │
                                              │  • session: Session    │
                                              │  • user: User          │
                                              │  • loading: boolean    │
                                              │  • signOut()           │
                                              └────────────┬───────────┘
                                                           │
                              ┌─────────────────────────────┼──────────────────┐
                              │                             │                  │
                              ▼                             ▼                  ▼
                   ┌──────────────────┐       ┌─────────────────┐   ┌────────────────┐
                   │  useUserStatus() │       │  ProtectedRoute │   │   PaidRoute    │
                   │  (TanStack Query)│       │  (Guard)        │   │   (Guard)      │
                   │                  │       └─────────────────┘   └────────────────┘
                   │  Fetches from DB:│
                   │  • onboardingDone│
                   │  • hasPaid       │
                   └──────────────────┘

  ┌──────────────────────────────────────────────────────────────────┐
  │                    STATE MANAGEMENT STACK                          │
  │                                                                   │
  │  Layer 1: React Context                                           │
  │    • AuthProvider (session + user state)                           │
  │    • KundaliThemeContext (theme switching)                         │
  │                                                                   │
  │  Layer 2: TanStack Query (server state)                           │
  │    • useUserStatus (user profile from DB, 30s stale)              │
  │    • usePaymentStatus (payment polling)                           │
  │    • Report data fetching & caching                               │
  │                                                                   │
  │  Layer 3: Zustand (client state)                                  │
  │    • feedback-store (card interactions)                            │
  │    • report-store (local kundali data)                             │
  │                                                                   │
  │  Layer 4: SessionStorage (ephemeral)                              │
  │    • kundliRequest, kundliReport, luxuryAnalysis                  │
  │    • investmentBaskets, sessionId                                  │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 4. Payment Flow Architecture

```
┌────────────┐     ┌───────────────┐     ┌──────────────────────────┐
│  /payment  │────▶│  OfferStep    │────▶│     MethodStep           │
│   (Page)   │     │  (₹499 CTA)  │     │  (Select payment mode)   │
└────────────┘     └───────────────┘     └────────────┬─────────────┘
                                                      │ Pay Now
                                                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        PAYMENT SEQUENCE                                │
│                                                                       │
│  1. Client calls createPaymentOrder()                                 │
│         │                                                             │
│         ▼                                                             │
│  2. Edge Function: create-payment-order                               │
│     • Checks if user already paid (idempotent)                        │
│     • Creates order in payment_orders table                           │
│     • Calls Zoho API → gets payments_session_id                       │
│     • Returns { orderId, paymentSessionId, amount }                   │
│         │                                                             │
│         ▼                                                             │
│  3. Client opens Zoho Widget (openPaymentWidget)                      │
│     • ZPayments SDK loaded via <script> tag                           │
│     • requestPaymentMethod({ payments_session_id })                   │
│     • Widget handles card/UPI/netbanking UI                           │
│         │                                                             │
│         ▼                                                             │
│  4a. Widget returns success → Client polls payment-status             │
│  4b. Zoho sends webhook → Edge Function: payment-webhook              │
│     • Verifies webhook signature                                      │
│     • Updates payment_orders.status = 'completed'                     │
│     • Sets user_profiles.has_paid = true                              │
│     • Stores in webhook_events (idempotency)                          │
│         │                                                             │
│         ▼                                                             │
│  5. pollPaymentStatus() resolves with status = 'completed'            │
│     • Exponential backoff: 2s → 3s → 4.5s → ... (cap 10s)           │
│     • Max 15 attempts, 2 min timeout                                  │
│         │                                                             │
│         ▼                                                             │
│  6. SuccessStep → Redirect to /kundali                                │
└──────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────┐
  │              PAYMENT STEPS UI FLOW                                 │
  │                                                                   │
  │  OfferStep → MethodStep → ProcessingStep → SuccessStep            │
  │                                       ↘                           │
  │                                    FailedStep                     │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 5. Financial Kundali Engine (Core Business Logic)

```
┌──────────────────────────────────────────────────────────────────────┐
│                     KUNDALI GENERATION PIPELINE                        │
│                                                                       │
│  ┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐  │
│  │ Birth Details │────▶│  Vedic Calc      │────▶│   Chart Data    │  │
│  │ (Date, Time,  │     │  (vedic-calc.ts)  │     │ (Planets, Houses│  │
│  │  Place)       │     │                  │     │  Signs, Dashas) │  │
│  └──────────────┘     └──────────────────┘     └────────┬────────┘  │
│                                                          │           │
│                         ┌────────────────────────────────┘           │
│                         ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              INSIGHT ENGINES (Deterministic, No LLM)           │   │
│  │                                                               │   │
│  │  financial-kundali-engine.ts                                   │   │
│  │    ├── Money Personality Archetype                             │   │
│  │    ├── Year-Ahead Monthly Forecast                             │   │
│  │    ├── Career & Salary Insights                                │   │
│  │    ├── Loan & EMI Timing Advisor                               │   │
│  │    ├── Wealth Milestones Timeline                              │   │
│  │    ├── Expense & Savings Optimization                          │   │
│  │    └── Investment Personality Profile                          │   │
│  │                                                               │   │
│  │  risk-engine.ts                                                │   │
│  │    └── Financial Risk Assessment                               │   │
│  │                                                               │   │
│  │  investment-engine.ts                                          │   │
│  │    └── Investment Basket Recommendations                       │   │
│  │                                                               │   │
│  │  sector-scoring-engine.ts                                      │   │
│  │    └── Sector Favorability Radar                               │   │
│  │                                                               │   │
│  │  business-timing-engine.ts                                     │   │
│  │    └── Business Decision Timing                                │   │
│  │                                                               │   │
│  │  daily-trading-engine.ts                                       │   │
│  │    └── Vedic Day Trading Signals                               │   │
│  │                                                               │   │
│  │  bonds-engine.ts                                               │   │
│  │    └── Bond & Fixed Income Analysis                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                         │                                            │
│                         ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    OUTPUT: Kundali Report                      │   │
│  │                                                               │   │
│  │  • Scores (savings, risk, investment, income, expense)         │   │
│  │  • Timeline (year-ahead monthly breakdown)                     │   │
│  │  • Archetypes (money personality)                              │   │
│  │  • Sector radar data                                           │   │
│  │  • Milestone predictions                                       │   │
│  │  • PDF export capability                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Frontend Component Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         APP SHELL                                      │
│                                                                       │
│  App.tsx                                                              │
│   ├── QueryClientProvider (TanStack Query)                            │
│   ├── TooltipProvider (Radix)                                         │
│   ├── Toaster (Sonner + Shadcn)                                       │
│   ├── BrowserRouter                                                   │
│   │    └── AuthProvider (Context)                                     │
│   │         ├── <Routes> (Suspense boundary)                         │
│   │         └── FloatingAstrologerChat (global overlay)               │
│   └── Lazy-loaded route components                                    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                    COMPONENT MODULES                                   │
│                                                                       │
│  src/components/                                                      │
│   │                                                                   │
│   ├── landing/          (Public marketing pages)                      │
│   │    ├── Hero.tsx               Main hero section                   │
│   │    ├── HeroShowcase.tsx       Visual showcase                     │
│   │    ├── Navbar.tsx             Global navigation                   │
│   │    ├── HowItWorks.tsx         Process explanation                 │
│   │    ├── InsightPreview.tsx     Kundali glimpse cards               │
│   │    ├── LockedCards.tsx        Teaser locked cards                  │
│   │    ├── UnlockedCards.tsx      Unlocked preview cards               │
│   │    ├── Pricing.tsx            Pricing section                     │
│   │    ├── Testimonials.tsx       Social proof                        │
│   │    ├── FAQ.tsx                Frequently asked questions           │
│   │    ├── Footer.tsx             Site footer                         │
│   │    └── Starfield.tsx          Animated star background            │
│   │                                                                   │
│   ├── financial-kundali/ (Premium Kundali cards)                      │
│   │    ├── IncomeConstellation.tsx                                     │
│   │    ├── IncomeGrowthTimeline.tsx                                    │
│   │    ├── PeakEarningYears.tsx                                       │
│   │    ├── CareerGrowthScore.tsx                                       │
│   │    ├── SalaryPromotionWindows.tsx                                  │
│   │    ├── JobVsBusinessSection.tsx                                     │
│   │    ├── InvestmentsAssetsSection.tsx                                 │
│   │    ├── FITimelineCard.tsx                                          │
│   │    ├── WealthMilestones.tsx                                        │
│   │    ├── FinancialRiskSummary.tsx                                     │
│   │    ├── ScamRiskSection.tsx                                          │
│   │    ├── SuddenWealthChart.tsx                                        │
│   │    ├── ForeignSettlementSection.tsx                                  │
│   │    ├── InheritanceWeaknessSection.tsx                                │
│   │    └── CardFeedback.tsx                                             │
│   │                                                                   │
│   ├── kundali/           (Kundali page infrastructure)                │
│   │    ├── KundaliSidebar.tsx     Side navigation                     │
│   │    ├── KundaliThemeSwitcher.tsx  Cosmic/Vedic toggle              │
│   │    └── InsightInfoTooltip.tsx                                     │
│   │                                                                   │
│   ├── payment/           (Payment flow steps)                         │
│   │    ├── CheckoutShell.tsx      Layout wrapper                      │
│   │    ├── OfferStep.tsx          Pricing & CTA                       │
│   │    ├── MethodStep.tsx         Payment method selection             │
│   │    ├── ProcessingStep.tsx     Loading/polling state                │
│   │    ├── SuccessStep.tsx        Payment confirmed                   │
│   │    └── FailedStep.tsx         Error/retry state                   │
│   │                                                                   │
│   ├── vedicfinance/          (Birth details & onboarding)                 │
│   │    └── BirthDetailsForm.tsx                                       │
│   │                                                                   │
│   └── ui/                (Shadcn/Radix primitive components)          │
│        └── 40+ primitives (Button, Card, Dialog, etc.)                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. Database Schema (ERD)

```
┌────────────────────────────────────────────────────────────────────────┐
│                          SUPABASE POSTGRESQL                            │
└────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────┐          ┌───────────────────────────┐
  │    auth.users        │          │      user_profiles         │
  │  (Supabase managed)  │          │                           │
  ├─────────────────────┤          ├───────────────────────────┤
  │ id (uuid) PK        │◀────────▶│ id (uuid) PK/FK          │
  │ email               │          │ full_name                 │
  │ phone               │          │ date_of_birth             │
  │ created_at          │          │ time_of_birth             │
  │ ...                 │          │ place_of_birth            │
  └─────────────────────┘          │ onboarding_done (bool)    │
                                   │ has_paid (bool)           │
                                   │ created_at                │
                                   │ updated_at                │
                                   └─────────────┬─────────────┘
                                                 │
                          ┌──────────────────────┼──────────────────────┐
                          │                      │                      │
                          ▼                      ▼                      ▼
           ┌──────────────────────┐  ┌─────────────────────┐  ┌───────────────────┐
           │   kundali_history     │  │   payment_orders     │  │   card_feedback    │
           ├──────────────────────┤  ├─────────────────────┤  ├───────────────────┤
           │ id (uuid) PK         │  │ id (uuid) PK        │  │ id (uuid) PK      │
           │ user_id (FK)         │  │ order_id (unique)    │  │ user_id (FK)      │
           │ slug (unique)        │  │ user_id (FK)         │  │ card_id           │
           │ chart_data (jsonb)   │  │ amount (decimal)     │  │ feedback_type     │
           │ report_data (jsonb)  │  │ currency (text)      │  │ created_at        │
           │ created_at           │  │ status (enum)        │  └───────────────────┘
           │ updated_at           │  │ zoho_session_id      │
           └──────────────────────┘  │ zoho_payment_id      │
                                     │ idempotency_key      │
                                     │ created_at           │
                                     │ updated_at           │
                                     │ expires_at           │
                                     └─────────────────────┘

                                     ┌─────────────────────┐
                                     │   webhook_events     │
                                     ├─────────────────────┤
                                     │ id (uuid) PK        │
                                     │ event_id (unique)    │
                                     │ event_type           │
                                     │ order_id             │
                                     │ processed_at         │
                                     └─────────────────────┘

  ┌──────────────────────────────────────────────────────────────────┐
  │                     RLS POLICIES                                   │
  │                                                                   │
  │  user_profiles:   Users read/update own row                       │
  │  kundali_history: Users read/write own records                    │
  │  payment_orders:  Users read own; service_role writes             │
  │  webhook_events:  No user access; service_role only               │
  │  card_feedback:   Users read/write own feedback                   │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 8. Edge Functions (Backend API Layer)

```
┌──────────────────────────────────────────────────────────────────────┐
│                   SUPABASE EDGE FUNCTIONS (Deno)                       │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  _shared/                (Common utilities)                      │ │
│  │    ├── cors.ts           CORS headers for all functions           │ │
│  │    ├── zoho.ts           Zoho API client (auth + endpoints)      │ │
│  │    ├── vedic-helpers.ts  Vedic calculation helpers                │ │
│  │    └── get-report.ts     Report fetching utilities                │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌────────────────────────┐  ┌────────────────────────┐             │
│  │ create-payment-order/  │  │ payment-status/        │             │
│  │                        │  │                        │             │
│  │ POST → Auth required   │  │ POST → Auth required   │             │
│  │ • Check if already paid│  │ • Lookup order by ID   │             │
│  │ • Generate order_id    │  │ • Return current status │             │
│  │ • Call Zoho Sessions   │  │                        │             │
│  │ • Store in DB          │  │                        │             │
│  │ • Return session_id    │  │                        │             │
│  └────────────────────────┘  └────────────────────────┘             │
│                                                                       │
│  ┌────────────────────────┐  ┌────────────────────────┐             │
│  │ payment-webhook/       │  │ generate-report/       │             │
│  │                        │  │                        │             │
│  │ POST → Zoho signature  │  │ POST → Auth required   │             │
│  │ • Verify webhook       │  │ • Fetch birth details  │             │
│  │ • Idempotency check    │  │ • Call Vedic API       │             │
│  │ • Update order status  │  │ • Generate chart data  │             │
│  │ • Set has_paid = true  │  │ • Store in kundali_    │             │
│  │ • Store webhook_event  │  │   history              │             │
│  └────────────────────────┘  └────────────────────────┘             │
│                                                                       │
│  ┌────────────────────────┐  ┌────────────────────────┐             │
│  │ chat/                  │  │ luxury-analysis/       │             │
│  │                        │  │                        │             │
│  │ POST → Auth required   │  │ POST → Auth required   │             │
│  │ • AI-powered astrology │  │ • Luxury asset timing  │             │
│  │   chat responses       │  │ • Vedic analysis       │             │
│  │ • Context-aware Q&A    │  │                        │             │
│  └────────────────────────┘  └────────────────────────┘             │
│                                                                       │
│  ┌────────────────────────┐  ┌────────────────────────┐             │
│  │ investment-baskets/    │  │ market-data/           │             │
│  │                        │  │                        │             │
│  │ POST → Auth required   │  │ GET → Public           │             │
│  │ • Personalized baskets │  │ • Real-time market     │             │
│  │ • Based on chart data  │  │   data aggregation     │             │
│  └────────────────────────┘  └────────────────────────┘             │
│                                                                       │
│  ┌────────────────────────┐  ┌────────────────────────┐             │
│  │ business-decision/     │  │ admin-user-management/ │             │
│  │                        │  │                        │             │
│  │ POST → Auth required   │  │ POST → Admin role      │             │
│  │ • Business timing      │  │ • CRUD user profiles   │             │
│  │   recommendations      │  │ • Payment overrides    │             │
│  └────────────────────────┘  └────────────────────────┘             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 9. Data Flow — Kundali Generation Sequence

```
  User                  Client                 Edge Fn              Vedic API          Database
   │                      │                      │                     │                  │
   │  Enter birth details │                      │                     │                  │
   │─────────────────────▶│                      │                     │                  │
   │                      │                      │                     │                  │
   │                      │  POST /generate-report                     │                  │
   │                      │─────────────────────▶│                     │                  │
   │                      │                      │                     │                  │
   │                      │                      │  Fetch chart data   │                  │
   │                      │                      │────────────────────▶│                  │
   │                      │                      │                     │                  │
   │                      │                      │  Planets, Houses,   │                  │
   │                      │                      │  Dashas, Transits   │                  │
   │                      │                      │◀────────────────────│                  │
   │                      │                      │                     │                  │
   │                      │                      │  Store in kundali_history              │
   │                      │                      │─────────────────────────────────────── ▶│
   │                      │                      │                     │                  │
   │                      │  Return chart_data   │                     │                  │
   │                      │◀─────────────────────│                     │                  │
   │                      │                      │                     │                  │
   │                      │  Run local engines:  │                     │                  │
   │                      │  • financial-kundali-engine                 │                  │
   │                      │  • risk-engine       │                     │                  │
   │                      │  • investment-engine │                     │                  │
   │                      │  • sector-scoring    │                     │                  │
   │                      │                      │                     │                  │
   │  Render Kundali cards│                      │                     │                  │
   │◀─────────────────────│                      │                     │                  │
   │                      │                      │                     │                  │
   │                      │  Cache in session    │                     │                  │
   │                      │  storage             │                     │                  │
   │                      │                      │                     │                  │
```

---

## 10. Technology Stack

```
┌──────────────────────────────────────────────────────────────────────┐
│                         TECH STACK                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  FRONTEND                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Framework:    React 18.3 + TypeScript 5.8                       │ │
│  │  Build:        Vite 5.4 (SWC plugin)                             │ │
│  │  Styling:      TailwindCSS 3.4 + tailwindcss-animate             │ │
│  │  UI Library:   Shadcn/UI (Radix primitives)                      │ │
│  │  Routing:      React Router DOM 6.30                             │ │
│  │  State:        TanStack Query 5 + Zustand 5 + React Context     │ │
│  │  Animation:    Framer Motion 12 + Lottie                         │ │
│  │  Charts:       Recharts 2.15                                     │ │
│  │  Forms:        React Hook Form + Zod validation                  │ │
│  │  PDF:          jsPDF + html2canvas + react-pdf                   │ │
│  │  3D:           Three.js (background effects)                     │ │
│  │  Icons:        Lucide React + React Icons                        │ │
│  │  Astronomy:    astronomy-engine (planetary calculations)          │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  BACKEND                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Platform:     Supabase (hosted PostgreSQL + Auth + Edge Fns)    │ │
│  │  Runtime:      Deno (Edge Functions)                              │ │
│  │  Database:     PostgreSQL with RLS                                │ │
│  │  Auth:         Supabase Auth (email/OTP)                         │ │
│  │  Storage:      Supabase Storage (PDF exports)                    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  EXTERNAL SERVICES                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Payments:     Zoho Payments (India gateway)                     │ │
│  │  Astrology:    Prokerala Vedic API (chart generation)            │ │
│  │  AI:           OpenAI / AI Provider (chat feature)               │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  DEVOPS & TOOLING                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Package Mgr:  Bun                                               │ │
│  │  Linting:      ESLint 9 + TypeScript ESLint                      │ │
│  │  Testing:      Vitest + Testing Library + Playwright             │ │
│  │  Deployment:   Render (static SPA via `serve`)                   │ │
│  │  Env Mgmt:     .env (dev) / .env.qa / .env.uat / .env.production│ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 11. Deployment Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ENVIRONMENTS                                     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   .env (local dev)   .env.qa        .env.uat        .env.production   │
│        │                │               │                 │            │
│        ▼                ▼               ▼                 ▼            │
│   localhost:5173    QA deploy       UAT deploy      Production         │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                     PRODUCTION TOPOLOGY                                 │
│                                                                        │
│  ┌─────────────┐         ┌────────────────────┐                       │
│  │   Browser   │────────▶│   Render.com       │                       │
│  │   (Client)  │         │   (Static SPA)     │                       │
│  └──────┬──────┘         │   serve dist -s    │                       │
│         │                └────────────────────┘                       │
│         │                                                              │
│         │  API calls (supabase-js client)                              │
│         ▼                                                              │
│  ┌──────────────────────────────────────────────────────────┐         │
│  │              Supabase Cloud                               │         │
│  │                                                           │         │
│  │  ┌────────────┐  ┌────────────┐  ┌───────────────────┐  │         │
│  │  │  Auth API  │  │ PostgREST  │  │  Edge Functions    │  │         │
│  │  │  (/auth)   │  │  (/rest)   │  │  (/functions)      │  │         │
│  │  └────────────┘  └─────┬──────┘  └─────────┬─────────┘  │         │
│  │                        │                    │             │         │
│  │                        ▼                    ▼             │         │
│  │              ┌─────────────────────────────────┐         │         │
│  │              │         PostgreSQL               │         │         │
│  │              │   (with Row Level Security)      │         │         │
│  │              └─────────────────────────────────┘         │         │
│  └──────────────────────────────────────────────────────────┘         │
│         │                                                              │
│         │  Webhook (payment-webhook)                                   │
│         ▼                                                              │
│  ┌──────────────┐                                                     │
│  │    Zoho      │                                                     │
│  │  Payments    │                                                     │
│  └──────────────┘                                                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Security Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                      SECURITY LAYERS                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  LAYER 1: Client-Side Guards                                          │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  • ProtectedRoute — blocks unauthenticated access                │ │
│  │  • PaidRoute — blocks unpaid access to premium content           │ │
│  │  • resolveDestination() — deterministic route resolution         │ │
│  │  • JWT token in memory (not localStorage)                        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  LAYER 2: API-Level Security                                          │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  • Supabase Auth JWT verification on every request               │ │
│  │  • Edge Functions validate auth before processing                │ │
│  │  • CORS restricted to known origins                              │ │
│  │  • Zoho webhook signature verification                           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  LAYER 3: Database-Level Security                                     │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  • Row Level Security (RLS) on all tables                        │ │
│  │  • Users can only access their own data                          │ │
│  │  • service_role key for backend operations only                  │ │
│  │  • No direct INSERT/UPDATE for users on payment tables           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  LAYER 4: Payment Security                                            │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  • Idempotency keys prevent duplicate charges                    │ │
│  │  • Webhook event deduplication                                   │ │
│  │  • Order expiry (30 min TTL + cron cleanup)                      │ │
│  │  • Payment state verified server-side (not client)               │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 13. Feature Module Map

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FEATURE MODULES                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  LANDING & MARKETING                                               │  │
│  │  Pages: Index, Landing, ComingSoon, BoostWealth, UpcomingFeatures  │  │
│  │  Components: landing/*                                             │  │
│  │  Purpose: Convert visitors → signups → payments                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  AUTHENTICATION & ONBOARDING                                       │  │
│  │  Pages: AuthPage                                                   │  │
│  │  Components: AuthStep, BirthDetailsForm                            │  │
│  │  Lib: auth-context, supabase                                       │  │
│  │  Purpose: Email/OTP sign-in + collect birth details                │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  PAYMENT                                                           │  │
│  │  Pages: Payment                                                    │  │
│  │  Components: payment/*                                             │  │
│  │  Lib: payment-api, zoho-payments, payment-storage                  │  │
│  │  Edge Fns: create-payment-order, payment-status, payment-webhook   │  │
│  │  Purpose: ₹499 one-time payment via Zoho                          │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  FINANCIAL KUNDALI (Core Product)                                  │  │
│  │  Pages: FinancialKundali                                           │  │
│  │  Components: financial-kundali/*, kundali/*                        │  │
│  │  Lib: financial-kundali-engine, kundali-engine, vedic-calc,        │  │
│  │       risk-engine, investment-engine, sector-scoring-engine,        │  │
│  │       business-timing-engine, daily-trading-engine, bonds-engine    │  │
│  │  Edge Fns: generate-report, luxury-analysis, investment-baskets    │  │
│  │  Purpose: Premium Vedic financial insights dashboard               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  AI ASTROLOGER CHAT                                                │  │
│  │  Pages: AIChatPage                                                 │  │
│  │  Components: FloatingAstrologerChat                                │  │
│  │  Edge Fns: chat                                                    │  │
│  │  Purpose: AI-powered financial astrology Q&A                       │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  SHARING & EXPORT                                                  │  │
│  │  Pages: SharedKundali                                              │  │
│  │  Lib: kundali-history                                              │  │
│  │  Purpose: Public shareable kundali via slug + PDF export           │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  ADMIN                                                             │  │
│  │  Pages: Admin                                                      │  │
│  │  Edge Fns: admin-user-management                                   │  │
│  │  Purpose: User management, payment overrides, analytics            │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  LEGAL & INFO                                                      │  │
│  │  Pages: Terms, Privacy, Disclaimer, RefundPolicy, Services         │  │
│  │  Purpose: Compliance pages                                         │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Performance & Loading Strategy

```
┌──────────────────────────────────────────────────────────────────────┐
│                   LOADING & PERFORMANCE                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  CODE SPLITTING STRATEGY                                              │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                                                                   │ │
│  │  EAGER (in main bundle):                                          │ │
│  │    • Index (Splash)     — first paint, must be instant            │ │
│  │    • Landing            — SEO + marketing, most visited           │ │
│  │                                                                   │ │
│  │  LAZY (separate chunks via React.lazy):                           │ │
│  │    • AuthPage           ─┐                                        │ │
│  │    • Payment             │                                        │ │
│  │    • FinancialKundali    │  Only loaded when user                 │ │
│  │    • HomeNew             │  navigates to these routes             │ │
│  │    • AIChatPage          │                                        │ │
│  │    • Profile             │                                        │ │
│  │    • Admin               │                                        │ │
│  │    • SharedKundali       │                                        │ │
│  │    • Legal pages        ─┘                                        │ │
│  │                                                                   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  CACHING STRATEGY                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                                                                   │ │
│  │  TanStack Query:                                                  │ │
│  │    • User status: staleTime 30s, gcTime 5min                      │ │
│  │    • Reports: cached until invalidated                            │ │
│  │                                                                   │ │
│  │  SessionStorage:                                                  │ │
│  │    • kundliReport — avoids re-fetch on navigation                 │ │
│  │    • luxuryAnalysis, investmentBaskets — expensive computations    │ │
│  │    • Cleared on sign-out (prevents data leaking)                  │ │
│  │                                                                   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

*Generated: July 2026*
