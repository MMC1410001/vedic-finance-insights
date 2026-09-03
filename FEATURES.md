# VedicFinance — Feature & Architecture Document

VedicFinance is a Vedic astrology-based financial analysis platform. It computes real planetary positions using the Swiss Ephemeris, runs deterministic Vedic rule engines, and presents personalized financial insights through a rich, animated frontend.

---

## 1. Core Features

### 1.1 Vedic Birth Chart (Kundali) Generation
- Computes D1 (Rashi) and D9 (Navamsa) charts from birth date, time, and location.
- Uses the **Swiss Ephemeris** (`pyswisseph`) with **Lahiri ayanamsa** for sidereal/Vedic accuracy.
- Calculates positions for Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, and Ketu across 12 houses and 27 nakshatras.
- Ascendant (Lagna) computed via Placidus house system.
- Frontend renders an interactive North Indian Kundali SVG with house/planet drill-down.

### 1.2 Financial Scoring Engine
Seven deterministic financial scores (0–100), each derived from explicit Vedic rules:

| Score | What It Measures |
|---|---|
| Natal Wealth | 2nd/11th lord strength, Dhana Yoga, Jupiter placement |
| Income | 11th house benefics, Jupiter/Saturn transits over 11th |
| Savings | 4th lord strength, Moon dignity, Saturn discipline |
| Investment | 5th lord strength, Jupiter in 5th/9th, Rahu risk |
| Risk | Rahu in 5th, Mars in 8th, Saturn retrograde, 8th lord placement |
| Expense | 12th house malefics, 12th lord in 1st/2nd, Saturn transit 12th |
| Timing | Mahadasha/Antardasha lord in wealth houses, Jupiter/Saturn transit impact |

Every score is traceable — the engine logs which specific rules fired and why.

### 1.3 Vimshottari Dasha Engine
- Full 120-year Vimshottari Dasha cycle computation from natal Moon's nakshatra.
- Identifies current Mahadasha and Antardasha periods with exact start/end dates.
- Determines next Mahadasha transition for financial planning.

### 1.4 Transit Engine
- Computes real-time sidereal positions of Jupiter, Saturn, Rahu, Ketu, Mars, and Sun.
- Maps each transit planet to the user's natal house and Moon house.
- Classifies impact as **favorable**, **neutral**, or **challenging** using house-specific Vedic rules.

### 1.5 Dashboard & Insights
- Deterministic labels (strong/moderate/weak) for income outlook, wealth accumulation, investment climate, speculation risk, expense pressure, and volatility.
- Rule-based reasoning text for natal, dasha, and transit analysis — no LLM-generated content in the core report.
- Timeline with favorable and caution periods derived from dasha transitions and transit windows.
- Confidence scoring based on birth time accuracy and number of triggered rules.
- Summary with financial phase classification (Growth / Consolidation / Caution).

### 1.6 Luxury Asset Purchase Timing
Analyzes purchase readiness for **Property, Vehicle, Gold, and Loans** using a weighted model:

| Layer | Weight | What It Checks |
|---|---|---|
| Dasha | 50% | Mahadasha/Antardasha lord ruling asset houses, karaka activation |
| Transit | 30% | Jupiter/Saturn/Mars/Venus transit over relevant houses |
| Natal | 15% | House lord strength, karaka dignity, benefic aspects |
| Muhurta | 5% | Favorable nakshatras, weekday preferences, Rahu Kaal avoidance |

Produces a verdict (**Favorable / Delay / Avoid**), a best purchase window, and suggested nakshatras for each asset type.

### 1.7 Investment Basket Allocation
Determines which asset classes suit the user based on Vedic chart analysis:

- **Baskets**: Stocks, Mutual Funds, Real Estate, Gold, Fixed Income, High Risk/Speculative.
- **Investor Type**: Conservative / Balanced / Aggressive — derived from 5th house strength, Rahu/Mars influence, and Saturn/Jupiter dignity.
- **Scoring**: Natal (40%) + Dasha activation (35%) + Transit timing (25%).
- **Output**: Ranked baskets, percentage allocation, active baskets in current dasha, and an avoid list with reasons.
- Includes a **Cosmic Bond Synastry** visualization mapping the user's chart to each investment instrument.

### 1.8 AI Chat (Vedic Financial Advisor)
- Conversational interface powered by **OpenAI GPT-4o-mini**.
- Every chat message triggers a full chart recomputation — the AI is grounded strictly in the user's real planetary data.
- System prompt enforces Vedic terminology and prohibits invented positions or specific price predictions.
- Supports conversation history (last 10 messages) for contextual follow-ups.
- Displays score radar charts inline with AI responses.

### 1.9 Onboarding Flow
- 3-step onboarding: Birth Details → AstroSign Quiz (5-question financial personality assessment) → Financial Profile (risk tolerance + investment horizon).
- Persists all data to **Supabase** (birth details, quiz results, financial profile).
- Returning users skip onboarding — profile is loaded from the database.

### 1.10 Authentication
- Supabase Auth with session management.
- Protected routes via `ProtectedRoute` component.
- Auth state change listener with hard redirect on sign-out to clear React state.

---

## 2. Tech Stack

### Frontend
| Package | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite 5 | Build tool (SWC plugin for fast compilation) |
| React Router v6 | Client-side routing |
| TanStack React Query | Server state management and caching |
| Tailwind CSS 3 | Utility-first styling |
| shadcn/ui (Radix primitives) | Accessible UI components (accordion, dialog, tabs, toast, tooltip, etc.) |
| Recharts | Radar charts, pie charts, bar charts for financial data visualization |
| Framer Motion | Animations and transitions |
| Lottie (`@lottiefiles/dotlottie-react`) | Animated zodiac, horoscope, and shooting star visuals |
| `@paper-design/shaders` | WebGL shader backgrounds (neural noise, cybernetic grid, interactive shaders) |
| Three.js | 3D star field and particle backgrounds |
| React Hook Form + Zod | Form validation with schema-based type safety |
| React Markdown | Rendering AI chat responses with rich formatting |
| Sonner | Toast notifications |
| Lucide React | Icon library |
| date-fns | Date formatting utilities |
| Supabase JS | Auth + database client |

### Backend (Supabase Edge Functions)
| Package | Purpose |
|---|---|
| Deno | Runtime for Supabase Edge Functions |
| Supabase Edge Functions | Serverless API endpoints |
| OpenAI API | GPT-4o-mini integration for the AI chat feature |

### Infrastructure & Quality
| Tool | Purpose |
|---|---|
| Supabase | Auth, PostgreSQL database, Edge Functions (serverless API) |
| Render | Hosting — static frontend (see `render.yaml`) |
| Playwright | End-to-end testing |
| Vitest + Testing Library | Unit and component testing |
| fast-check | Property-based testing |
| ESLint + TypeScript ESLint | Code linting and type checking |

---

## 3. API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/generate-report` | Full financial analysis report (chart + scores + dashboard + timeline + reasoning) |
| POST | `/luxury-analysis` | Luxury asset purchase timing for property, vehicle, gold, loan |
| POST | `/investment-baskets` | Investment basket allocation with investor type and rankings |
| POST | `/chat` | AI-powered Vedic financial chat grounded in real chart data |
| GET | `/health` | Health check |

All endpoints accept birth details (date, time, place, lat/lon, timezone, accuracy) as input.

---

## 4. Assurance & Reliability

- **Deterministic rule engine**: All financial scores and insights are generated from explicit, traceable Vedic rules — no randomness, no hallucination. Every triggered rule is logged.
- **Real ephemeris data**: Planetary positions are computed from Swiss Ephemeris data files (`.se1`), the same library used by professional astrology software worldwide.
- **Confidence scoring**: The system self-reports its confidence level based on birth time accuracy and the number of strong planetary combinations found.
- **Schema validation**: TypeScript types in edge functions and Zod on the frontend enforce strict type safety across the entire data pipeline.
- **AI grounding**: The chat AI receives only computed chart data and is instructed to never invent positions or make specific financial predictions.
- **Testing layers**: Unit tests (Vitest), property-based tests (fast-check), and E2E tests (Playwright) cover the frontend.
- **Session caching**: Reports are cached in `sessionStorage` to avoid redundant API calls during a session.
- **Environment isolation**: Sensitive keys (OpenAI, Supabase) are managed via `.env` and never committed.

---

## 5. Data Flow

```
User enters birth details
        ↓
  Onboarding saves to Supabase
        ↓
  Frontend calls /generate-report
        ↓
  Backend: birth data → Julian Day → Swiss Ephemeris
        ↓
  D1 Chart + D9 Chart + Dasha + Transits computed
        ↓
  Scoring engine applies ~40 Vedic rules → 7 scores + rule log
        ↓
  Insight engine builds dashboard, reasoning, timeline, confidence, summary
        ↓
  JSON response → Frontend renders Kundali, radar, panels, timeline
        ↓
  /luxury-analysis and /investment-baskets use same chart pipeline
        ↓
  /chat recomputes chart per message → feeds to GPT-4o-mini with strict system prompt
```
