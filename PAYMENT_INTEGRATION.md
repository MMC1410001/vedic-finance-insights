# Zoho Payments Integration — VedicFinance

## Overview

VedicFinance uses Zoho Payments to process a one-time ₹99 payment for Financial Kundali access. The integration uses:

- **Zoho ZPayments JS SDK** (client-side widget)
- **3 Supabase Edge Functions** (order creation, webhook handling, status polling)
- **Supabase PostgreSQL** as the source of truth for payment status

## Architecture

```
User → React Frontend → create-payment-order (Edge Fn) → Zoho Payments API
                                                          ↓
User ← Zoho Widget ← paymentSessionId ←─────────────────┘
                                                          
Zoho → payment-webhook (Edge Fn) → Update DB (has_paid=true)
                                                          
Frontend → payment-status (Edge Fn) → DB + Zoho sync → Confirmation
```

## Environment Variables

### Frontend (.env)

| Variable | Description |
|----------|-------------|
| `VITE_ZOHO_ACCOUNT_ID` | Zoho Payments account ID |
| `VITE_ZOHO_API_KEY` | Zoho Payments public API key (for JS SDK) |

### Edge Functions (Supabase Dashboard > Edge Functions > Secrets)

| Variable | Description |
|----------|-------------|
| `ZOHO_CLIENT_ID` | OAuth client ID from Zoho API Console |
| `ZOHO_CLIENT_SECRET` | OAuth client secret |
| `ZOHO_REFRESH_TOKEN` | Long-lived refresh token (offline scope) |
| `ZOHO_WEBHOOK_SECRET` | Secret for HMAC webhook signature verification |
| `ZOHO_API_BASE` | API base URL (default: `https://payments.zoho.in/api/v1`) |
| `ZOHO_ACCOUNT_ID` | Zoho Payments account ID |
| `FRONTEND_URL` | Frontend URL for CORS (e.g. `https://vedicfinance.app`) |

## Zoho Dashboard Configuration

### 1. Create OAuth Client

1. Go to [Zoho API Console](https://api-console.zoho.in/)
2. Create a "Self Client" application
3. Generate a refresh token with scopes: `ZohoPayments.paymentsessions.CREATE`, `ZohoPayments.paymentsessions.READ`
4. Note the Client ID and Client Secret

### 2. Configure Webhook

1. In Zoho Payments Dashboard → Settings → Webhooks
2. Add a new webhook endpoint:
   - URL: `https://<project-ref>.supabase.co/functions/v1/payment-webhook`
   - Events to subscribe:
     - `payment.succeeded`
     - `payment.failed`
     - `payment_session.completed`
     - `payment_session.failed`
3. Copy the webhook secret (used as `ZOHO_WEBHOOK_SECRET`)

### 3. Get API Key

1. In Zoho Payments Dashboard → Settings → API Keys
2. Copy the publishable key (used as `VITE_ZOHO_API_KEY`)

## Payment Flow

1. User clicks "Pay ₹99" on `/payment`
2. Frontend calls `create-payment-order` edge function
3. Edge function creates a pending order in DB + Zoho checkout session
4. Frontend opens Zoho ZPayments widget with the session ID
5. User completes payment in the widget
6. **Dual confirmation:**
   - Zoho sends webhook → `payment-webhook` updates DB
   - Frontend polls `payment-status` → confirms from DB (or syncs with Zoho)
7. `has_paid=true` is set on `user_profiles`
8. User is redirected to `/kundali`

## Database Tables

### `payment_orders`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| order_id | text | Unique order reference (ORD-<uuid>) |
| user_id | uuid | References auth.users |
| amount | decimal(10,2) | Payment amount |
| currency | text | Currency code (INR) |
| status | text | pending / completed / failed / expired |
| zoho_session_id | text | Zoho checkout session ID |
| zoho_payment_id | text | Zoho payment ID (after completion) |
| idempotency_key | text | Prevents duplicate orders |
| created_at | timestamptz | Order creation time |
| updated_at | timestamptz | Last update time |
| expires_at | timestamptz | Order expiry (30 min from creation) |

### `webhook_events`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| event_id | text | Unique event ID from Zoho |
| event_type | text | Event type (payment.succeeded, etc.) |
| order_id | text | Associated order ID |
| processed_at | timestamptz | When the event was processed |

### `user_profiles.has_paid`

Boolean flag — `true` means user has lifetime access to Financial Kundali.

## Idempotency

- **Order creation:** SHA-256 hash of `user_id + "kundali" + minute_bucket` prevents duplicate orders within the same minute
- **Webhook processing:** `webhook_events.event_id` unique constraint prevents duplicate event processing
- **Status updates:** Multiple `has_paid=true` writes are idempotent (no harm)

## Security

- Webhook HMAC: `X-Zoho-Webhook-Signature` header verified with constant-time comparison
- JWT verification on `create-payment-order` and `payment-status`
- Service role key used for DB writes in edge functions (bypasses RLS)
- No user-facing endpoint can set `has_paid=true` directly

## Troubleshooting

### Token refresh failure

- Verify `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` are correct
- Check if the refresh token has been revoked in Zoho API Console
- Token endpoint: `https://accounts.zoho.in/oauth/v2/token`

### Webhook not received

- Verify webhook URL is correct in Zoho dashboard
- Check that `payment-webhook` function is deployed: `supabase functions list`
- Test with Zoho's "Send Test Webhook" feature
- Check edge function logs: `supabase functions logs payment-webhook`

### Payment stuck as pending

- The `payment-status` endpoint actively syncs with Zoho if DB says pending
- Stale orders auto-expire after 30 minutes (pg_cron)
- User can retry payment after expiry

### Widget not loading

- Verify `VITE_ZOHO_ACCOUNT_ID` and `VITE_ZOHO_API_KEY` are set
- Check browser console for SDK errors
- Ensure `https://payments.zoho.in/jslib/zpayments.js` loads successfully

## Deployment Checklist

- [ ] Run migration `009_payment_orders.sql` in Supabase SQL Editor
- [ ] Set all `ZOHO_*` secrets in Supabase Dashboard > Edge Functions > Secrets
- [ ] Deploy edge functions: `supabase functions deploy create-payment-order payment-webhook payment-status`
- [ ] Add `VITE_ZOHO_ACCOUNT_ID` and `VITE_ZOHO_API_KEY` to frontend env
- [ ] Configure webhook URL in Zoho Payments dashboard
- [ ] Subscribe to `payment.succeeded` and `payment.failed` events
- [ ] Test with Zoho test mode payment
- [ ] Verify webhook delivery in Zoho dashboard logs
- [ ] Confirm `has_paid` flag updates correctly
