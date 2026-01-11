-- Fix meal_type mismatch: 'snack' -> 'School Snacks'
UPDATE meal_plans
SET meal_type = 'School Snacks'
WHERE meal_type = 'snack';