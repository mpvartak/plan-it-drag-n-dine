-- Remove the user_email column from feedback table
-- This eliminates the security risk of exposing email addresses
-- Email can be retrieved via user_id when needed by admins
ALTER TABLE public.feedback DROP COLUMN IF EXISTS user_email;