-- ═══════════════════════════════════════════════════════════════════
-- 009: Payment Orders + has_paid flag for Zoho Payments integration
-- ═══════════════════════════════════════════════════════════════════

-- 1. Add has_paid column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS has_paid boolean DEFAULT false;

-- 2. Create payment_orders table
CREATE TABLE IF NOT EXISTS payment_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        text UNIQUE NOT NULL,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          decimal(10,2) NOT NULL,
  currency        text NOT NULL DEFAULT 'INR',
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  zoho_session_id text,
  zoho_payment_id text,
  idempotency_key text UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);

-- 3. Create webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS webhook_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      text UNIQUE NOT NULL,
  event_type    text NOT NULL,
  order_id      text,
  processed_at  timestamptz NOT NULL DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for payment_orders
-- Users can only read their own orders
CREATE POLICY "users read own orders" ON payment_orders
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (edge functions) can do everything — bypasses RLS automatically
-- No INSERT/UPDATE/DELETE policies for regular users (only service_role writes)

-- 6. RLS policies for webhook_events
-- No user access — only service_role key writes/reads
-- (No policies = no access for non-service-role)

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_status ON payment_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order_id ON payment_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_idempotency ON payment_orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);

-- 8. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_payment_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_orders_updated_at ON payment_orders;
CREATE TRIGGER trg_payment_orders_updated_at
  BEFORE UPDATE ON payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_orders_updated_at();
