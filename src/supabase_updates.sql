-- 1. Update the DEFAULT value for new submissions
-- Since we now start at 'submitted', make it the default.
ALTER TABLE articles 
ALTER COLUMN status 
SET DEFAULT 'submitted';

-- 2. Verify RLS Policies (Optional but Recommended)
-- Run this query to see if any policies restrict which status can be inserted.
-- Look for 'USING' or 'WITH CHECK' clauses that mention specific status values.
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'articles';

-- 3. If you find a policy like "Enable insert for authenticated users only with status 'reviewer_first'",
--    you might need to update it. Typically, policies allow INSERT without checking status, 
--    or check that status is the default. Since we updated the default, it should be fine.
