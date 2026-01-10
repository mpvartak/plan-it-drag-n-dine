-- Add is_out_of_stock column to inventory_items
ALTER TABLE public.inventory_items 
ADD COLUMN is_out_of_stock boolean NOT NULL DEFAULT false;

-- Add index for efficient filtering
CREATE INDEX idx_inventory_items_out_of_stock ON public.inventory_items(user_id, is_out_of_stock);