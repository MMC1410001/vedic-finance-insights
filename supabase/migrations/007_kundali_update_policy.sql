-- Add UPDATE policy for kundli_reports so orphaned reports can be claimed by users
-- This fixes the issue where reports saved with user_id=null cannot be updated

-- Allow authenticated users to update reports that belong to them or are unclaimed
create policy "users can claim and update reports" on kundli_reports
  for update using (
    user_id = auth.uid()
    or user_id is null
  ) with check (
    user_id = auth.uid()
  );
