-- Fix missing columns and policies for kundali history & profile features
-- Run this in Supabase SQL Editor if migrations 004 and 007 were never applied

-- ═══════════════════════════════════════════════════════════════════
-- 1. Add missing columns to kundli_reports
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE kundli_reports ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE kundli_reports ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE kundli_reports ADD COLUMN IF NOT EXISTS share_slug text UNIQUE;
ALTER TABLE kundli_reports ADD COLUMN IF NOT EXISTS birth_date text;
ALTER TABLE kundli_reports ADD COLUMN IF NOT EXISTS birth_time text;
ALTER TABLE kundli_reports ADD COLUMN IF NOT EXISTS birth_place text;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Add missing column to user_birth_details
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE user_birth_details ADD COLUMN IF NOT EXISTS full_name text;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Create indexes for performance
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_reports_user ON kundli_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_share_slug ON kundli_reports(share_slug);

-- ═══════════════════════════════════════════════════════════════════
-- 4. Update RLS policies
-- ═══════════════════════════════════════════════════════════════════

-- Remove the old "allow everything" policy
DROP POLICY IF EXISTS "anon full access reports" ON kundli_reports;

-- Allow insert for anyone (guest or authenticated)
DROP POLICY IF EXISTS "anyone can insert reports" ON kundli_reports;
CREATE POLICY "anyone can insert reports" ON kundli_reports
  FOR INSERT WITH CHECK (true);

-- Allow users to read their own reports + shared reports
DROP POLICY IF EXISTS "users read own reports" ON kundli_reports;
CREATE POLICY "users read own reports" ON kundli_reports
  FOR SELECT USING (
    user_id = auth.uid()
    OR share_slug IS NOT NULL
  );

-- Allow public read for shared reports (via share_slug)
DROP POLICY IF EXISTS "public read shared reports" ON kundli_reports;
CREATE POLICY "public read shared reports" ON kundli_reports
  FOR SELECT USING (share_slug IS NOT NULL);

-- Allow authenticated users to update reports that belong to them or are unclaimed
DROP POLICY IF EXISTS "users can claim and update reports" ON kundli_reports;
CREATE POLICY "users can claim and update reports" ON kundli_reports
  FOR UPDATE USING (
    user_id = auth.uid()
    OR user_id IS NULL
  ) WITH CHECK (
    user_id = auth.uid()
  );
