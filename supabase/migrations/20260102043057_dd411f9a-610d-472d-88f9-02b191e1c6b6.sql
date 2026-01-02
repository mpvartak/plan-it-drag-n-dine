-- Create enum for inventory locations
CREATE TYPE public.inventory_location AS ENUM ('fridge', 'freezer', 'pantry');

-- Create inventory_items table
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT,
  location inventory_location NOT NULL DEFAULT 'pantry',
  expiration_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own inventory items"
ON public.inventory_items
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own inventory items"
ON public.inventory_items
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inventory items"
ON public.inventory_items
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own inventory items"
ON public.inventory_items
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_inventory_items_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();