-- Fix security vulnerability: Remove overly permissive profile access
-- Drop the existing policy that allows everyone to view all profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create a secure policy that only allows users to view their own profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Optional: If you need authenticated users to view each other's profiles for social features,
-- you can use this policy instead (but be careful about privacy implications):
-- CREATE POLICY "Authenticated users can view profiles" 
-- ON public.profiles 
-- FOR SELECT 
-- TO authenticated
-- USING (true);