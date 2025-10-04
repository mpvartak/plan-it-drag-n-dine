-- Create meal_items table
CREATE TABLE public.meal_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meal_items
CREATE POLICY "Users can view their own meal items"
ON public.meal_items
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meal items"
ON public.meal_items
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meal items"
ON public.meal_items
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meal items"
ON public.meal_items
FOR DELETE
USING (auth.uid() = user_id);

-- Create recipes table (can have multiple recipes per meal item)
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_item_id UUID NOT NULL REFERENCES public.meal_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  recipe_type TEXT NOT NULL CHECK (recipe_type IN ('url', 'instructions')),
  title TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recipes
CREATE POLICY "Users can view their own recipes"
ON public.recipes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recipes"
ON public.recipes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipes"
ON public.recipes
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipes"
ON public.recipes
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp for meal_items
CREATE OR REPLACE FUNCTION public.update_meal_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_meal_items_updated_at
BEFORE UPDATE ON public.meal_items
FOR EACH ROW
EXECUTE FUNCTION public.update_meal_items_updated_at();

-- Create trigger to update updated_at timestamp for recipes
CREATE OR REPLACE FUNCTION public.update_recipes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_recipes_updated_at
BEFORE UPDATE ON public.recipes
FOR EACH ROW
EXECUTE FUNCTION public.update_recipes_updated_at();