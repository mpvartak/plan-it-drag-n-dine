-- Add image_url column to meal_items table
ALTER TABLE public.meal_items 
ADD COLUMN image_url TEXT;

-- Update the pohe item to have an image URL
UPDATE public.meal_items 
SET image_url = '/src/assets/pohe.png'
WHERE LOWER(name) = 'pohe';