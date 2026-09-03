# Zoho Payments Integration Guide

> A complete guide to integrating Zoho Payments into a web application, based on a production implementation with a Go backend (Gin) and Next.js frontend.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites & Setup](#prerequisites--setup)
4. [Backend Integration](#backend-integration)
5. [Frontend Integration](#frontend-integration)
6. [Webhook Handling](#webhook-handling)
7. [Payment Status Polling](#payment-status-polling)
8. [Security](#security)
9. [Error Handling & Edge Cases](#error-handling--edge-cases)
10. [Database Schema](#database-schema)
11. [Fee Calculation](#fee-calculation)
12. [Testing](#testing)

---

## Overview

### Payment Flow Summary

```
User clicks Pay -> Backend creates order -> Zoho Checkout Session created
-> User pays on Zoho widget -> Zoho sends webhook -> Backend confirms payment
-> Frontend polls status -> Shows confirmation
```

### Key Design Principles

- **Server-side price validation** — never trust the client for amounts
- **Idempotency** — prevent duplicate charges on retries
- **Webhook + Polling dual confirmation** — webhook is primary, polling is fallback
- **Tickets reserved ONLY after payment confirmation** — no premature inventory lock
- **HMAC signature verification** — all webhooks cryptographically verified
- **OAuth token auto-refresh** — handles token expiry transparently

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                            │
├─────────────────────────────────────────────────────────────────────┤
│  OrderSummary ──> POST /payments/create-order                       │
│       │                                                             │
│       ▼                                                             │
│  Zoho ZPayments Widget (client-side SDK)                            │
│       │                                                             │
│       ▼                                                             │
│  /payment/confirmation ──> polls GET /payments/status/:orderId      │
└─────────────────────────────────────────────────────────────────────┘
         │                          ▲
         │ Create Order             │ Status Response
         ▼                          │
┌─────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Go/Gin)                              │
├─────────────────────────────────────────────────────────────────────┤
│  PaymentController                                                  │
│    ├── CreatePaymentOrder()  → calls Zoho API                       │
│    ├── HandleWebhook()       → verifies HMAC, confirms payment      │
│    └── GetPaymentStatus()    → returns status, syncs with Zoho      │
│                                                                     │
│  ZohoService                                                        │
│    ├── CreateCheckoutSession()                                      │
│    ├── GetPaymentSessionStatus()                                    │
│    └── (auto token refresh on 401)                                  │
│                                                                     │
│  TransactionManager                                                 │
│    ├── SendPaymentEmails()                                          │
│    └── ReleaseTickets()                                             │
│                                                                     │
│  Queue (async)                                                      │
│    ├── payment.confirmed → emails + post-payment actions            │
│    └── payment.failed → cleanup                                     │
└─────────────────────────────────────────────────────────────────────┘
         │                          ▲
         │ POST /paymentsessions    │ POST webhook
         ▼                          │
┌─────────────────────────────────────────────────────────────────────┐
│                    ZOHO PAYMENTS GATEWAY                             │
│    - Handles card/UPI/netbanking                                    │
│    - PCI-DSS compliant                                              │
│    - Sends webhook on payment.succeeded / payment.failed            │
└─────────────────────────────────────────────────────────────────────┘
```

### Sequence Diagram

```
User        Frontend         Backend          Zoho            Database
 │              │               │               │                │
 │─Click Pay──▶│               │               │                │
 │              │──POST /create-order──▶        │                │
 │              │               │──validate ticket avail──────▶  │
 │              │               │◀─────────────OK────────────────│
 │              │               │──create pending transaction──▶ │
 │              │               │──POST /paymentsessions──▶      │
 │              │               │◀──checkout URL + sessionId─────│
 │              │◀──orderId, sessionId, amount──│                │
 │              │                               │                │
 │              │──open ZPayments widget────────▶                │
 │◀─────────────pay on Zoho────────────────────│                │
 │──────────────complete payment───────────────▶                │
 │              │               │◀──webhook (HMAC signed)────────│
 │              │               │──verify HMAC                   │
 │              │               │──update txn to completed──────▶│
 │              │               │──reserve tickets──────────────▶│
 │              │               │──200 OK──────▶                 │
 │              │               │                               │
 │◀─redirect to /confirmation──│               │                │
 │              │──GET /status/:orderId──▶      │                │
 │              │               │──query DB────────────────────▶ │
 │              │◀──status: completed───────────│                │
 │◀─show success│               │               │                │
```

---

## Prerequisites & Setup

### 1. Zoho Payments Account

1. Sign up at [payments.zoho.in](https://payments.zoho.in)
2. Complete KYC/business verification
3. Get your **Account ID** from the Zoho Payments dashboard

### 2. OAuth Credentials (Server-to-Server)

1. Go to [Zoho API Console](https://api-console.zoho.in)
2. Create a **Server-Based Application**
3. Set authorized redirect URI (can be your backend callback)
4. Note your **Client ID** and **Client Secret**
5. Generate an initial **Refresh Token** with scope: `ZohoPayments.fullaccess.all`

### 3. Webhook Configuration

1. In Zoho Payments dashboard → Settings → Webhooks
2. Add endpoint URL: `https://your-domain.com/api/payments/webhook`
3. Select events: `payment.succeeded`, `payment.failed`
4. Copy the **Webhook Secret** for HMAC verification

### 4. Frontend Widget (ZPayments JS SDK)

Load the Zoho Payments JS SDK in your frontend:
```html
<script src="https://payments.zoho.in/jslib/zpayments.js"></script>
```

### 5. Environment Variables

**Backend (.env)**
```env
# Zoho Payment Gateway
ZOHO_CLIENT_ID=1000.XXXXXXXXXXXXXXXXXXXXXXXXXX
ZOHO_CLIENT_SECRET=your_client_secret_here
ZOHO_WEBHOOK_SECRET=your_webhook_secret_here
ZOHO_ACCESS_TOKEN=1000.initial_access_token     # Will auto-refresh
ZOHO_REFRESH_TOKEN=1000.your_refresh_token
ZOHO_API_BASE=https://payments.zoho.in/api/v1   # India region
ZOHO_ACCOUNT_ID=your_account_id
FRONTEND_URL=https://your-frontend-domain.com
```

**Frontend (.env)**
```env
# Zoho Payments Widget (public keys only — safe for client-side)
NEXT_PUBLIC_ZOHO_ACCOUNT_ID=your_account_id
NEXT_PUBLIC_ZOHO_API_KEY=your_public_api_key
```

> **Note:** The API base URL varies by region:
> - India: `https://payments.zoho.in/api/v1`
> - US: `https://payments.zoho.com/api/v1`
> - EU: `https://payments.zoho.eu/api/v1`

---

## Backend Integration

### Config Struct

```go
type Config struct {
    ZohoClientID      string
    ZohoClientSecret  string
    ZohoWebhookSecret string
    ZohoAccessToken   string
    ZohoRefreshToken  string
    ZohoAPIBase       string // default: "https://payments.zoho.in/api/v1"
    ZohoAccountID     string
    FrontendURL       string
}
```

### Zoho Service — OAuth Token Management

Zoho uses OAuth 2.0 with refresh tokens. Access tokens expire (typically in 1 hour). Your service must handle automatic refresh:

```go
type ZohoServiceImpl struct {
    APIBase      string
    AccessToken  string
    RefreshToken string
    ClientID     string
    ClientSecret string
    AccountID    string
    HTTPClient   *http.Client

    mu          sync.Mutex
    tokenExpiry time.Time
}

// Refresh access token via Zoho's OAuth endpoint
func (z *ZohoServiceImpl) refreshAccessToken() error {
    z.mu.Lock()
    defer z.mu.Unlock()

    // Double-check: another goroutine may have already refreshed
    if time.Now().Before(z.tokenExpiry) {
        return nil
    }

    data := url.Values{}
    data.Set("refresh_token", z.RefreshToken)
    data.Set("client_id", z.ClientID)
    data.Set("client_secret", z.ClientSecret)
    data.Set("grant_type", "refresh_token")

    req, _ := http.NewRequest("POST",
        "https://accounts.zoho.in/oauth/v2/token",
        strings.NewReader(data.Encode()))
    req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

    resp, err := z.HTTPClient.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    var tokenResp struct {
        AccessToken string `json:"access_token"`
        ExpiresIn   int    `json:"expires_in"`
        Error       string `json:"error"`
    }
    json.NewDecoder(resp.Body).Decode(&tokenResp)

    if tokenResp.Error != "" || tokenResp.AccessToken == "" {
        return fmt.Errorf("token refresh failed: %s", tokenResp.Error)
    }

    z.AccessToken = tokenResp.AccessToken
    z.tokenExpiry = time.Now().Add(time.Duration(tokenResp.ExpiresIn-300) * time.Second)
    return nil
}
```

> **Important:** The OAuth endpoint URL varies by region:
> - India: `https://accounts.zoho.in/oauth/v2/token`
> - US: `https://accounts.zoho.com/oauth/v2/token`
> - EU: `https://accounts.zoho.eu/oauth/v2/token`

### Creating a Payment Session (Checkout)

This is the core API call that initiates a payment:

**Zoho API:** `POST /api/v1/paymentsessions?account_id={account_id}`

```go
type CreateCheckoutRequest struct {
    OrderID     string  // Your internal order reference
    Amount      float64 // Amount in currency units (e.g., rupees, not paise)
    Currency    string  // "INR", "USD", etc.
    Description string  // Shown to user on Zoho checkout
    BuyerEmail  string
    BuyerName   string
    SuccessURL  string  // Where Zoho redirects after success
    CancelURL   string  // Where Zoho redirects on cancel
}

type CheckoutResponse struct {
    CheckoutURL string // URL for redirect-based flow (not used with widget)
    SessionID   string // Used with the ZPayments JS widget
}

func (z *ZohoServiceImpl) CreateCheckoutSession(order CreateCheckoutRequest) (CheckoutResponse, error) {
    payload := map[string]interface{}{
        "amount":           fmt.Sprintf("%.2f", order.Amount), // String format required
        "currency":         order.Currency,
        "description":      order.Description,
        "reference_number": order.OrderID,  // Your order ID — returned in webhooks
    }

    body, _ := json.Marshal(payload)
    apiURL := z.APIBase + "/paymentsessions?account_id=" + z.AccountID

    // Retry once on 401 (token expired)
    for attempt := 0; attempt < 2; attempt++ {
        token, _ := z.getAccessToken()

        req, _ := http.NewRequest("POST", apiURL, bytes.NewReader(body))
        req.Header.Set("Authorization", "Zoho-oauthtoken "+token)
        req.Header.Set("Content-Type", "application/json")

        resp, err := z.HTTPClient.Do(req)
        if err != nil {
            return CheckoutResponse{}, err
        }
        defer resp.Body.Close()

        if resp.StatusCode == 401 && attempt == 0 {
            z.tokenExpiry = time.Time{} // force refresh
            continue
        }

        if resp.StatusCode != 200 && resp.StatusCode != 201 {
            respBody, _ := io.ReadAll(resp.Body)
            return CheckoutResponse{}, fmt.Errorf("Zoho API %d: %s", resp.StatusCode, respBody)
        }

        var zohoResp struct {
            PaymentsSession struct {
                PaymentsSessionID string `json:"payments_session_id"`
                URL               string `json:"url"`
            } `json:"payments_session"`
        }
        json.NewDecoder(resp.Body).Decode(&zohoResp)

        return CheckoutResponse{
            SessionID:   zohoResp.PaymentsSession.PaymentsSessionID,
            CheckoutURL: zohoResp.PaymentsSession.URL,
        }, nil
    }

    return CheckoutResponse{}, fmt.Errorf("failed after retry")
}
```

### Checking Payment Session Status

Used for polling-based confirmation (fallback when webhook is delayed):

**Zoho API:** `GET /api/v1/paymentsessions/{session_id}?account_id={account_id}`

```go
type ZohoPaymentStatus struct {
    Status    string // "completed", "succeeded", "paid", "failed", "cancelled", "pending"
    PaymentID string
    Amount    string
}

func (z *ZohoServiceImpl) GetPaymentSessionStatus(sessionID string) (*ZohoPaymentStatus, error) {
    apiURL := z.APIBase + "/paymentsessions/" + sessionID + "?account_id=" + z.AccountID

    // Same 401 retry pattern as CreateCheckoutSession
    token, _ := z.getAccessToken()
    req, _ := http.NewRequest("GET", apiURL, nil)
    req.Header.Set("Authorization", "Zoho-oauthtoken "+token)

    resp, err := z.HTTPClient.Do(req)
    // ... handle response

    var zohoResp struct {
        PaymentsSession struct {
            Status    string `json:"status"`
            PaymentID string `json:"payment_id"`
            Amount    string `json:"amount"`
        } `json:"payments_session"`
    }
    json.NewDecoder(resp.Body).Decode(&zohoResp)

    return &ZohoPaymentStatus{
        Status:    zohoResp.PaymentsSession.Status,
        PaymentID: zohoResp.PaymentsSession.PaymentID,
        Amount:    zohoResp.PaymentsSession.Amount,
    }, nil
}
```

### Creating Payment Links (Optional)

For shareable payment links (e.g., send via WhatsApp/email):

**Zoho API:** `POST /api/v1/paymentlinks?account_id={account_id}`

```go
payload := map[string]interface{}{
    "amount":       fmt.Sprintf("%.2f", amount),
    "currency":     "INR",
    "description":  "Payment for XYZ",
    "reference_id": "your-reference-id",
    "email":        "buyer@example.com",
    "phone":        "9876543210",
    "phone_country_code": "IN",
    "return_url":   "https://your-domain.com/payment/success",
}
```

---

## Frontend Integration

### Loading the Zoho Payments SDK

In Next.js, load the script using the `Script` component:

```tsx
import Script from 'next/script';

// In your layout or page:
<Script
  src="https://payments.zoho.in/jslib/zpayments.js"
  strategy="afterInteractive"
/>
```

### Initializing the ZPayments Widget

```tsx
const createZohoInstance = () => {
  if (typeof window === 'undefined' || !(window as any).ZPayments) {
    return null;
  }

  const config = {
    account_id: process.env.NEXT_PUBLIC_ZOHO_ACCOUNT_ID,
    domain: 'IN',  // 'IN' for India, 'COM' for US, 'EU' for Europe
    otherOptions: {
      api_key: process.env.NEXT_PUBLIC_ZOHO_API_KEY,
    },
  };

  return new (window as any).ZPayments(config);
};
```

### Complete Payment Flow (Frontend)

```tsx
const handlePayment = async () => {
  // 1. Create order on your backend
  const res = await fetch(`${BASE_URL}/payments/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ticketId: 123,
      eventId: 456,
      noOfTickets: 2,
      couponId: 0,
      email: 'buyer@example.com',
      name: 'John Doe',
    }),
  });

  const data = await res.json();
  // data = { orderId, checkoutUrl, paymentSessionId, amount, currency }

  // 2. Create Zoho widget instance
  const zohoInstance = createZohoInstance();
  if (!zohoInstance) {
    showError('Payment widget failed to load');
    return;
  }

  // 3. Open payment widget with session details
  try {
    const options = {
      amount: Number(data.amount).toFixed(2),
      currency_code: data.currency || 'INR',
      payments_session_id: data.paymentSessionId,
      currency_symbol: '₹',
      description: 'Your Purchase Description',
      reference_number: data.orderId,
    };

    await zohoInstance.requestPaymentMethod(options);

    // 4. Payment succeeded — redirect to confirmation page
    router.push(`/payment/confirmation?orderId=${data.orderId}`);

  } catch (widgetErr: any) {
    if (widgetErr?.code === 'widget_closed') {
      // User dismissed the widget — not an error
      console.log('Payment cancelled by user');
    } else {
      showError('Payment failed. Please try again.');
    }
  } finally {
    // Always close the widget instance
    if (zohoInstance?.close) {
      await zohoInstance.close();
    }
  }
};
```

### Handling Browser Back Button

Push a dummy history entry before opening the widget so the back button closes it instead of navigating away:

```tsx
// Before opening widget:
window.history.pushState({ zohoPaymentOpen: true }, '');
const handlePopState = () => {
  zohoInstance?.close();
  setIsCreatingOrder(false);
};
window.addEventListener('popstate', handlePopState);

// After payment completes:
window.removeEventListener('popstate', handlePopState);
if (window.history.state?.zohoPaymentOpen) {
  window.history.back(); // Remove the dummy entry
}
```

---

## Webhook Handling

### Webhook Payload Structure

Zoho sends a POST request to your webhook URL with this structure:

```json
{
  "event_id": 123456,
  "event_type": "payment.succeeded",
  "account_id": "60063233181",
  "event_object": {
    "payment": {
      "payment_id": "pay_xxxxxxxx",
      "reference_number": "ORD-uuid-here",
      "status": "succeeded",
      "amount": "1499.00",
      "currency": "INR",
      "date": 1719392400,
      "receipt_email": "buyer@example.com"
    }
  }
}
```

### Event Types

| Event Type | Meaning |
|---|---|
| `payment.succeeded` | Payment was successful |
| `payment.failed` | Payment failed |
| `payment.pending` | Payment is still processing |

### HMAC Signature Verification

Zoho signs webhooks with the header `X-Zoho-Webhook-Signature` in the format:

```
t=<unix_timestamp>,v=<hex_hmac_signature>
```

The signed data is: `<timestamp>.<raw_request_body>`

```go
import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "strings"
)

func VerifyZohoWebhookSignature(rawBody []byte, headerValue string, secret string) bool {
    // 1. Parse t= and v= from the header
    var timestamp, sig string
    for _, part := range strings.Split(headerValue, ",") {
        part = strings.TrimSpace(part)
        if strings.HasPrefix(part, "t=") {
            timestamp = strings.TrimPrefix(part, "t=")
        } else if strings.HasPrefix(part, "v=") {
            sig = strings.TrimPrefix(part, "v=")
        }
    }
    if timestamp == "" || sig == "" {
        return false
    }

    // 2. Construct signed payload: timestamp.rawBody
    signedPayload := []byte(timestamp + "." + string(rawBody))

    // 3. Compute HMAC-SHA256 with your webhook secret
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write(signedPayload)
    expectedMAC := mac.Sum(nil)

    // 4. Decode received hex signature
    receivedMAC, err := hex.DecodeString(sig)
    if err != nil {
        return false
    }

    // 5. Constant-time comparison (prevents timing attacks)
    return hmac.Equal(receivedMAC, expectedMAC)
}
```

### Webhook Handler Implementation

```go
func (pc *PaymentController) HandleWebhook(c *gin.Context) {
    // 1. Read raw body (needed for HMAC verification)
    rawBody, err := io.ReadAll(c.Request.Body)
    if err != nil {
        c.JSON(400, gin.H{"error": "Failed to read body"})
        return
    }

    // 2. Verify HMAC signature
    signature := c.GetHeader("X-Zoho-Webhook-Signature")
    if signature == "" {
        c.JSON(401, gin.H{"error": "Missing signature"})
        return
    }
    if !VerifyZohoWebhookSignature(rawBody, signature, cfg.ZohoWebhookSecret) {
        c.JSON(401, gin.H{"error": "Invalid signature"})
        return
    }

    // 3. Parse payload
    var payload WebhookPayload
    json.Unmarshal(rawBody, &payload)

    payment := payload.EventObject.Payment
    orderID := payment.ReferenceNumber  // This is YOUR order ID
    paymentID := payment.PaymentID

    // 4. Idempotency check — prevent processing same webhook twice
    webhookKey := sha256(paymentID + ":" + orderID + ":" + payload.EventType)
    if alreadyProcessed(webhookKey) {
        c.JSON(200, gin.H{"status": "received"})
        return
    }

    // 5. Look up your payment order by reference_number
    var paymentOrder PaymentOrder
    db.Where("order_id = ?", orderID).First(&paymentOrder)

    // 6. Validate amount matches (±0.01 tolerance for rounding)
    if math.Abs(amount - paymentOrder.Amount) > 0.01 {
        // Flag for manual review, still acknowledge webhook
        c.JSON(200, gin.H{"status": "received"})
        return
    }

    // 7. Process based on event type
    switch payload.EventType {
    case "payment.succeeded":
        // Update transaction status to completed
        // Reserve inventory (tickets/items)
        // Decrement coupon if used
        // Enqueue async work (emails, notifications)

    case "payment.failed":
        // Mark transaction as failed
        // Release any holds
        // Cancel linked records
    }

    // 8. Store idempotency record
    // 9. Respond 200 OK quickly (within 5 seconds)
    c.JSON(200, gin.H{"status": "received"})
}
```

> **Critical:** Always return 200 OK to Zoho within 5 seconds, even if async processing continues. Zoho will retry on non-2xx responses.

---

## Payment Status Polling

### Why Polling?

Webhooks are the primary confirmation mechanism, but they can be delayed or fail. Polling ensures the user gets timely confirmation even if the webhook is slow.

### Backend Status Endpoint

`GET /api/payments/status/:orderId`

The status endpoint does two things:
1. Returns the current status from your database
2. **If still pending**, proactively checks Zoho for the latest status and updates your DB

```go
func (pc *PaymentController) GetPaymentStatus(c *gin.Context) {
    orderID := c.Param("orderId")

    // 1. Query your DB
    var paymentOrder PaymentOrder
    db.Where("order_id = ? AND buyer_id = ?", orderID, authUser.ID).First(&paymentOrder)

    var transaction Transaction
    db.First(&transaction, paymentOrder.TransactionID)

    // 2. If still pending, check Zoho directly
    if transaction.PayStatus != "completed" && paymentOrder.ZohoSessionID != "" {
        zohoStatus, err := zohoService.GetPaymentSessionStatus(paymentOrder.ZohoSessionID)
        if err == nil {
            switch zohoStatus.Status {
            case "completed", "succeeded", "paid":
                // Update your DB — same logic as webhook handler
                // Reserve inventory, update transaction, etc.
            case "failed", "cancelled":
                // Mark as failed in your DB
            }
        }
    }

    // 3. Return current status
    c.JSON(200, gin.H{
        "orderId":       paymentOrder.OrderID,
        "paymentStatus": transaction.PayStatus,
        "transactionId": transaction.ID,
        "zohoPaymentId": transaction.ZohoPaymentID,
    })
}
```

### Frontend Polling with Exponential Backoff

```typescript
interface PollingConfig {
  maxAttempts: number;        // 15
  initialInterval: number;    // 2000ms
  maxInterval: number;        // 8000ms
  backoffMultiplier: number;  // 1.5
  absoluteTimeoutMs: number;  // 120000ms (2 minutes)
}

async function pollWithBackoff<T>(
  pollFn: () => Promise<T>,
  shouldContinue: (result: T) => boolean,
  config: PollingConfig,
  onAttempt?: (attempt: number, max: number) => void
): Promise<T> {
  let lastResult: T | undefined;
  const deadline = Date.now() + config.absoluteTimeoutMs;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    if (Date.now() >= deadline) break;

    onAttempt?.(attempt, config.maxAttempts);
    lastResult = await pollFn();

    if (!shouldContinue(lastResult)) return lastResult;

    // Exponential backoff: interval = min(initial * multiplier^attempt, max)
    const interval = Math.min(
      config.initialInterval * Math.pow(config.backoffMultiplier, attempt),
      config.maxInterval
    );
    await sleep(Math.min(interval, deadline - Date.now()));
  }

  return lastResult as T;
}

// Usage:
const result = await pollWithBackoff(
  async () => {
    const res = await fetch(`/api/payments/status/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return { status: data.paymentStatus, transactionId: data.transactionId };
  },
  (result) => result.status === 'pending', // Keep polling while pending
  { maxAttempts: 15, initialInterval: 2000, maxInterval: 8000,
    backoffMultiplier: 1.5, absoluteTimeoutMs: 120000 }
);
```

### Payment Confirmation Page States

The confirmation page handles 4 states:

| State | Meaning | UI |
|---|---|---|
| `loading` | Polling in progress | Spinner + "Verifying payment..." |
| `completed` | Payment confirmed | Green success card |
| `failed` | Payment failed | Red error card + retry button |
| `timeout` | Polling exhausted without answer | Yellow warning + order ID + support contact |

---

## Security

### 1. Server-Side Price Validation

**Never** trust the client for amounts. Always calculate prices server-side:

```go
// Calculate on server — client only sends item IDs and quantities
fees := CalculateFees(ticket.Price, body.NoOfTickets, discountPercent)
totalAmount := discountedSubtotal + fees.TotalBuyerFees
```

### 2. Idempotency Keys

Prevent duplicate charges from retries:

```go
// Server-generated idempotency key:
// SHA256(userID + itemID + quantity + minute_bucket)
minuteBucket := time.Now().Truncate(time.Minute).Unix()
raw := fmt.Sprintf("%d:%d:%d:%d:%d", userID, ticketID, eventID, qty, minuteBucket)
key := fmt.Sprintf("%x", sha256.Sum256([]byte(raw)))
```

If a duplicate request arrives within the minute window, return the cached response.

### 3. SELECT FOR UPDATE (Inventory Lock)

Prevent race conditions on inventory:

```go
tx.Clauses(clause.Locking{Strength: "UPDATE"}).
    Where("id = ?", ticketID).First(&ticket)
```

### 4. Webhook Signature Verification

Always verify HMAC before processing. See [Webhook Handling](#webhook-handling) section.

### 5. JWT Authentication

All payment endpoints (except webhook) require JWT authentication. The webhook uses HMAC instead.

### 6. User Scoping

Users can only query their own payment orders:

```go
db.Where("order_id = ? AND buyer_id = ?", orderID, authUser.UserID).First(&order)
```

---

## Error Handling & Edge Cases

### 1. Oversell Protection

Payment can succeed but inventory may have sold out between order creation and payment:

```go
available := ticket.NoOfTickets - ticket.NoOfTicketsSold
if available < paymentOrder.NoOfTickets {
    // Mark as "oversold" — requires manual refund
    tx.Model(&transaction).Update("order_status", "oversold")
    // Alert admin for refund processing
    go sendAdminAlert("OVERSOLD", orderID, amount)
    return
}
```

### 2. Payment Order Expiry

Orders that remain pending for too long (e.g., 30 minutes) should be cleaned up by a background job:

```go
paymentOrder := PaymentOrder{
    // ...
    ExpiresAt: time.Now().Add(30 * time.Minute),
}

// Cleanup job:
db.Model(&PaymentOrder{}).
    Where("status = ? AND expires_at < ?", "pending", time.Now()).
    Update("status", "expired")
```

### 3. Webhook Deduplication

Both the webhook and the polling endpoint can confirm a payment. Use dedup logic:

```go
// In the queue handler, check if already processed:
var completedCount int64
db.Model(&Event{}).
    Where("transaction_id = ? AND event_type = ? AND status = ?",
        txnID, "payment.confirmed", "completed").
    Count(&completedCount)
if completedCount > 0 {
    return nil // Already processed
}
```

### 4. Token Refresh Failure

If the refresh token is revoked or expired, fall back gracefully:

```go
if err := z.refreshAccessToken(); err != nil {
    // Fall back to the static token (may still work briefly)
    fmt.Printf("Token refresh failed, using static: %v\n", err)
    return z.AccessToken, nil
}
```

### 5. Widget Closed by User

The Zoho widget throws a specific error code when the user dismisses it:

```tsx
catch (widgetErr: any) {
    if (widgetErr?.code === 'widget_closed') {
        // User chose to cancel — not an error
    } else {
        showError('Payment failed');
    }
}
```

---

## Database Schema

### PaymentOrder Table

Tracks the lifecycle of a payment attempt:

```sql
CREATE TABLE payment_orders (
    id              SERIAL PRIMARY KEY,
    order_id        VARCHAR(50) UNIQUE NOT NULL,  -- "ORD-<uuid>"
    transaction_id  INTEGER REFERENCES transactions(id),
    buyer_id        INTEGER NOT NULL,
    ticket_id       INTEGER NOT NULL,
    event_id        INTEGER NOT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    currency        VARCHAR(10) DEFAULT 'INR',
    status          VARCHAR(20) DEFAULT 'pending',  -- pending, completed, failed, expired, oversold
    coupon_id       INTEGER DEFAULT 0,
    no_of_tickets   INTEGER NOT NULL,
    idempotency_key VARCHAR(64) UNIQUE NOT NULL,
    checkout_url    TEXT,
    zoho_session_id VARCHAR(100),
    expires_at      TIMESTAMP NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_po_buyer_status ON payment_orders(buyer_id, status);
CREATE INDEX idx_po_status_created ON payment_orders(status, created_at);
```

### Transaction Table

Core record of a purchase:

```sql
CREATE TABLE transactions (
    id                  SERIAL PRIMARY KEY,
    ticket_id           INTEGER NOT NULL,
    buyer_id            INTEGER NOT NULL,
    seller_id           INTEGER NOT NULL,
    pay_status          VARCHAR(20) DEFAULT 'pending',   -- pending, completed, failed
    order_status        VARCHAR(20) DEFAULT 'pending',   -- pending, confirmed, cancelled, oversold
    ear_marked          BOOLEAN DEFAULT TRUE,
    no_of_tickets       INTEGER NOT NULL,
    price               DECIMAL(10,2),          -- Original subtotal (before coupon)
    seller_platform_fee DECIMAL(10,2),          -- 7% of original subtotal
    buyer_service_fee   DECIMAL(10,2),          -- Total buyer fees
    buyer_flat_fee      DECIMAL(10,2) DEFAULT 0,
    pg_fee              DECIMAL(10,2) DEFAULT 0,
    processing_fee      DECIMAL(10,2) DEFAULT 0,
    net_earnings        DECIMAL(10,2),          -- Seller payout
    payout_date         TIMESTAMP,
    payout_status       VARCHAR(20) DEFAULT 'pending',
    email               VARCHAR(255),
    coupon_id           INTEGER DEFAULT 0,
    zoho_payment_id     VARCHAR(100),           -- From Zoho webhook
    zoho_order_id       VARCHAR(100),           -- Your order ID stored back
    payment_timestamp   TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
```

### Idempotency Records Table

```sql
CREATE TABLE idempotency_records (
    id              SERIAL PRIMARY KEY,
    idempotency_key VARCHAR(64) UNIQUE NOT NULL,
    user_id         INTEGER,
    endpoint        VARCHAR(50),     -- "payment-order" or "payment-webhook"
    response_status INTEGER,
    response_body   TEXT,
    processed_at    TIMESTAMP,
    expires_at      TIMESTAMP NOT NULL
);
```

---

## Fee Calculation

### Fee Structure

| Fee | Who Pays | Calculation |
|---|---|---|
| Seller Platform Fee | Seller (deducted from payout) | 7% of original subtotal, ceil |
| Buyer Flat Fee | Buyer (added to total) | Slab-based on original subtotal |
| PG Fee | Buyer (added to total) | 2.5% of (discounted subtotal + flat fee), ceil |

### Buyer Flat Fee Slabs

| Original Subtotal | Flat Fee |
|---|---|
| ₹0 (free) | ₹0 |
| ₹1 – ₹700 | ₹19 |
| ₹701 – ₹1,500 | ₹49 |
| ₹1,501 – ₹5,000 | ₹99 |
| > ₹5,000 | ₹149 |

### Calculation Example

```
Ticket price: ₹500, Quantity: 2, Coupon: 10% off

Original subtotal     = 500 × 2 = ₹1,000
Discounted subtotal   = 1,000 × 0.9 = ₹900
Seller fee            = ceil(1,000 × 0.07) = ₹70
Buyer flat fee        = ₹49 (slab for ₹1,000)
PG fee                = ceil((900 + 49) × 0.025) = ceil(23.73) = ₹24
Total buyer fees      = 49 + 24 = ₹73
Buyer pays            = 900 + 73 = ₹973
Seller receives       = 1,000 - 70 = ₹930
```

### Implementation

```go
func CalculateFees(listingPrice float64, quantity int, discountPercent float64) FeeCalculation {
    originalSubtotal := listingPrice * float64(quantity)
    if originalSubtotal == 0 {
        return FeeCalculation{} // Free — no fees
    }

    discountedSubtotal := originalSubtotal * (1 - discountPercent/100.0)
    sellerFee := math.Ceil(originalSubtotal * 0.07)
    buyerFlat := buyerFlatFeeSlab(originalSubtotal)
    pgFee := math.Ceil((discountedSubtotal + buyerFlat) * 0.025)

    return FeeCalculation{
        SellerPlatformFee: sellerFee,
        BuyerFlatFee:      buyerFlat,
        PGFee:             pgFee,
        TotalBuyerFees:    buyerFlat + pgFee,
        NetEarnings:       originalSubtotal - sellerFee,
    }
}
```

---

## Testing

### Testing Without Real Payments

1. **Use Zoho's test mode** — Zoho provides test credentials and test cards
2. **Mock the ZohoService interface** for unit tests:

```go
type MockZohoService struct {
    CreateCheckoutSessionFn    func(order CreateCheckoutRequest) (CheckoutResponse, error)
    GetPaymentSessionStatusFn  func(sessionID string) (*ZohoPaymentStatus, error)
}
```

3. **Test webhook handling** by sending crafted payloads with computed HMAC signatures:

```go
func TestWebhookHandler(t *testing.T) {
    payload := `{"event_type":"payment.succeeded","event_object":{"payment":{"payment_id":"test_pay","reference_number":"ORD-123","amount":"100.00"}}}`
    secret := "test_secret"
    timestamp := fmt.Sprintf("%d", time.Now().Unix())
    signedData := timestamp + "." + payload

    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(signedData))
    sig := hex.EncodeToString(mac.Sum(nil))
    header := fmt.Sprintf("t=%s,v=%s", timestamp, sig)

    req := httptest.NewRequest("POST", "/api/payments/webhook", strings.NewReader(payload))
    req.Header.Set("X-Zoho-Webhook-Signature", header)
    // ... test handler
}
```

### Key Test Scenarios

- Happy path: order creation → webhook → status confirmed
- Duplicate webhook (idempotency)
- Amount mismatch detection
- Oversell handling
- Token refresh on 401
- Widget closed by user (frontend)
- Polling timeout

---

## API Reference Summary

### Backend Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/payments/create-order` | JWT | Create payment order, returns Zoho session |
| `POST` | `/api/payments/webhook` | HMAC | Zoho webhook callback |
| `GET` | `/api/payments/status/:orderId` | JWT | Query payment status (with Zoho sync) |
| `GET` | `/api/payments/my-orders` | JWT | List user's pending/failed orders |

### Zoho API Endpoints Used

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/paymentsessions?account_id=X` | Create checkout session |
| `GET` | `/api/v1/paymentsessions/:id?account_id=X` | Get session status |
| `POST` | `/api/v1/paymentlinks?account_id=X` | Create shareable payment link |
| `POST` | `https://accounts.zoho.in/oauth/v2/token` | Refresh access token |

### Payment Status Lifecycle

```
pending ──→ completed (payment.succeeded webhook)
    │
    └──→ failed (payment.failed webhook)
    │
    └──→ expired (cleanup job after 30 min)
    │
    └──→ oversold (succeeded but no inventory)
```

---

## Checklist for New Project Integration

- [ ] Create Zoho Payments account and complete verification
- [ ] Set up OAuth app in Zoho API Console
- [ ] Generate refresh token with `ZohoPayments.fullaccess.all` scope
- [ ] Configure webhook URL in Zoho dashboard
- [ ] Set up environment variables (backend + frontend)
- [ ] Implement Zoho service with OAuth token refresh
- [ ] Implement payment order creation endpoint
- [ ] Implement webhook handler with HMAC verification
- [ ] Implement payment status endpoint with Zoho sync
- [ ] Add idempotency layer to prevent duplicates
- [ ] Load ZPayments JS SDK in frontend
- [ ] Implement widget-based payment flow
- [ ] Implement polling-based confirmation page
- [ ] Add payment order expiry cleanup job
- [ ] Test with Zoho test mode
- [ ] Switch to production credentials
