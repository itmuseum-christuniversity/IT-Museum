-- Rename column submitted_by_email to submitted_email in articles table
ALTER TABLE articles 
RENAME COLUMN submitted_by_email TO submitted_email;
