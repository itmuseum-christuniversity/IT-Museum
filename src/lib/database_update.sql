-- Run this in your Supabase SQL Editor
ALTER TABLE articles 
ADD COLUMN cs_branches text[] DEFAULT '{}';
