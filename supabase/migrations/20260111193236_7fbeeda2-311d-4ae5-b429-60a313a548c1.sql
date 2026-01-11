-- Normalize meal_items JSON: convert {name} to {text} for all affected rows
-- This ensures consistent schema across all meal_plans records

UPDATE meal_plans
SET meal_items = (
  SELECT jsonb_agg(
    CASE 
      WHEN item ? 'name' AND NOT (item ? 'text') THEN
        (item - 'name') || jsonb_build_object('text', item->>'name')
      ELSE item
    END
  )
  FROM jsonb_array_elements(meal_items) AS item
)
WHERE meal_items IS NOT NULL
  AND meal_items::text LIKE '%"name":%'
  AND meal_items::text NOT LIKE '%"text":%';