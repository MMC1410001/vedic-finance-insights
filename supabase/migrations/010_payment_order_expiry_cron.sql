-- ═══════════════════════════════════════════════════════════════════
-- 010: Payment order expiry via pg_cron + updated_at trigger
-- ═══════════════════════════════════════════════════════════════════

-- 1. Enable pg_cron extension (must be done by a superuser / dashboard)
-- Note: On Supabase hosted, pg_cron is pre-installed. Just enable it:
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Grant usage to postgres role (required on some Supabase setups)
GRANT USAGE ON SCHEMA cron TO postgres;

-- 3. Schedule job: expire pending orders every 10 minutes
-- Orders that are still 'pending' past their expires_at time get marked 'expired'
SELECT cron.schedule(
  'expire-pending-orders',
  '*/10 * * * *',
  $$
    UPDATE payment_orders
    SET status = 'expired', updated_at = now()
    WHERE status = 'pending'
      AND expires_at < now()
  $$
);

-- 4. Optional cleanup: remove webhook_events older than 30 days (weekly)
SELECT cron.schedule(
  'cleanup-old-webhook-events',
  '0 3 * * 0',
  $$
    DELETE FROM webhook_events
    WHERE processed_at < now() - interval '30 days'
  $$
);
