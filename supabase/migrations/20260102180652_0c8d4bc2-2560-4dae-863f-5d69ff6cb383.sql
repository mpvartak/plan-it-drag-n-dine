-- Add meal planning preferences column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN meal_preferences text;