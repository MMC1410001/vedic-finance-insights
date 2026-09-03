-- Add is_admin_generated flag to kundli_reports
-- Marks kundalis created directly from the admin panel (no auth, no payment)

ALTER TABLE kundli_reports
  ADD COLUMN IF NOT EXISTS is_admin_generated boolean NOT NULL DEFAULT false;

-- Index for fast admin panel queries
CREATE INDEX IF NOT EXISTS idx_reports_admin_generated
  ON kundli_reports(is_admin_generated)
  WHERE is_admin_generated = true;
