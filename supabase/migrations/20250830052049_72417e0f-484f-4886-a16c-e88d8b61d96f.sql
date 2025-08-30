-- Create grocery_lists table to store AI-generated grocery lists
CREATE TABLE public.grocery_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start_date DATE NOT NULL,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint: one grocery list per user per week
  UNIQUE(user_id, week_start_date)
);

-- Enable Row Level Security
ALTER TABLE public.grocery_lists ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own grocery lists" 
ON public.grocery_lists 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own grocery lists" 
ON public.grocery_lists 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own grocery lists" 
ON public.grocery_lists 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own grocery lists" 
ON public.grocery_lists 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_grocery_lists_updated_at
BEFORE UPDATE ON public.grocery_lists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();