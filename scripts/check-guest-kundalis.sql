-- Quick Script: Check Recently Generated Guest Kundalis
-- Run this in Supabase SQL Editor to verify guest kundalis without logging in
-- This won't claim them or affect them in any way

-- ══════════════════════════════════════════════════════════════════════
-- Recent Guest Kundalis (Last 24 Hours)
-- ══════════════════════════════════════════════════════════════════════

SELECT 
  id,
  full_name,
  birth_date,
  birth_time,
  birth_place,
  financial_phase,
  session_id,
  share_slug,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 AS minutes_ago
FROM kundli_reports
WHERE user_id IS NULL                           -- Guest kundalis only
  AND session_id NOT LIKE 'canary-%'            -- Exclude canary probes
  AND created_at > NOW() - INTERVAL '24 hours'  -- Last 24 hours
ORDER BY created_at DESC
LIMIT 20;

-- ══════════════════════════════════════════════════════════════════════
-- Guest Kundali Count by Day (Last 7 Days)
-- ══════════════════════════════════════════════════════════════════════

SELECT 
  DATE(created_at) AS date,
  COUNT(*) AS guest_kundalis
FROM kundli_reports
WHERE user_id IS NULL
  AND session_id NOT LIKE 'canary-%'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ══════════════════════════════════════════════════════════════════════
-- Check Specific Guest Kundali by Name or Birth Date
-- ══════════════════════════════════════════════════════════════════════

-- Uncomment and modify to search for a specific guest kundali:
/*
SELECT 
  id,
  full_name,
  birth_date,
  birth_time,
  birth_place,
  share_slug,
  created_at
FROM kundli_reports
WHERE user_id IS NULL
  AND (
    full_name ILIKE '%John%'  -- Change this name
    OR birth_date = '1990-05-15'  -- Or this date
  )
ORDER BY created_at DESC;
*/

-- ══════════════════════════════════════════════════════════════════════
-- Reset a Kundali Back to Guest Status (Use with caution!)
-- ══════════════════════════════════════════════════════════════════════

-- If you accidentally claimed a guest kundali, run this to reset it:
/*
UPDATE kundli_reports
SET user_id = NULL
WHERE id = '<paste-kundali-id-here>';
*/
