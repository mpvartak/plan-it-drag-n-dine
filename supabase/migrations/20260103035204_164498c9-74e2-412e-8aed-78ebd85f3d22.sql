-- Add ready_to_eat column to inventory_items table
ALTER TABLE public.inventory_items 
ADD COLUMN ready_to_eat boolean NOT NULL DEFAULT true;