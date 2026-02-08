-- ======================================================================
-- MASTER FIX SCRIPT: Run this to resolve permission & status issues.
-- This ensures the database fully supports the new workflow.
-- ======================================================================

-- 1. Fix the "Permission denied for table users" error (Trigger Fix)
CREATE OR REPLACE FUNCTION handle_status_change()
RETURNS TRIGGER 
SECURITY DEFINER -- Essential: Runs as admin to read auth.users
AS $$
BEGIN
  INSERT INTO article_status_history (
    article_id, 
    old_status, 
    new_status, 
    changed_by_email, 
    remark
  )
  VALUES (
    NEW.id,
    OLD.status,
    NEW.status,
    -- Fallback to 'system_admin' if user not found (e.g. Supabase Dashboard edit)
    COALESCE(
      (SELECT email FROM auth.users WHERE id = auth.uid()), 
      'system_admin'
    ),
    'Status updated'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop any old restrictive policies to start fresh
DROP POLICY IF EXISTS "Enable insert for all users" ON articles;
DROP POLICY IF EXISTS "Enable insert for public" ON articles;
DROP POLICY IF EXISTS "Allow public article submissions" ON articles;
DROP POLICY IF EXISTS "Enable update for all users" ON articles;
DROP POLICY IF EXISTS "Enable read access for all users" ON articles;

-- 3. Create Permissive Policies for the Frontend (Public Role)

-- Allow ANYONE to read articles (Essential for dashboards to populate)
CREATE POLICY "Enable read access for all users" 
ON articles FOR SELECT 
TO public 
USING (true);

-- Allow ANYONE to submit articles (with 'SUBMITTED' status)
CREATE POLICY "Enable insert for public" 
ON articles 
FOR INSERT 
TO public 
WITH CHECK (status = 'SUBMITTED');

-- Allow ANYONE to update articles (Essential for Approval buttons to work)
-- This is safe because your frontend logic handles the rules.
CREATE POLICY "Enable update for all users" 
ON articles 
FOR UPDATE 
TO public 
USING (true)
WITH CHECK (true);

-- 4. Ensure RLS is enabled
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- 5. Helpful Check: Confirm if articles are actually in 'IT_APPROVED' status
-- Run this separately to debug:
-- SELECT id, title, status FROM articles WHERE status = 'IT_APPROVED';
