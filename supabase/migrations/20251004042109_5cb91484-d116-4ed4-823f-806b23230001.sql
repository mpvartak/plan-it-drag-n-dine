-- Update the pohe image URL to use the public folder path
UPDATE public.meal_items 
SET image_url = '/images/pohe.png'
WHERE LOWER(name) = 'pohe';