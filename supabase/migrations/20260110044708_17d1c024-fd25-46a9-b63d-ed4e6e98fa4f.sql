-- Create table for daily meal logs
CREATE TABLE public.daily_meal_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  log_date DATE NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  meal_type TEXT,
  status TEXT NOT NULL CHECK (status IN ('as_planned', 'skipped', 'substituted')),
  substitute_name TEXT,
  is_unplanned BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date, item_id)
);

-- Create table for grocery purchases
CREATE TABLE public.daily_grocery_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  log_date DATE NOT NULL,
  item_name TEXT NOT NULL,
  quantity TEXT,
  cost DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for eating out entries
CREATE TABLE public.daily_eating_out (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  log_date DATE NOT NULL,
  description TEXT NOT NULL,
  cost DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for waste entries
CREATE TABLE public.daily_waste_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  log_date DATE NOT NULL,
  item_name TEXT NOT NULL,
  quantity TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('expired', 'spoiled', 'didnt_like', 'too_much')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.daily_meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_grocery_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_eating_out ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_waste_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_meal_logs
CREATE POLICY "Users can view their own meal logs"
ON public.daily_meal_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meal logs"
ON public.daily_meal_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meal logs"
ON public.daily_meal_logs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meal logs"
ON public.daily_meal_logs FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for daily_grocery_purchases
CREATE POLICY "Users can view their own grocery purchases"
ON public.daily_grocery_purchases FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own grocery purchases"
ON public.daily_grocery_purchases FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own grocery purchases"
ON public.daily_grocery_purchases FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own grocery purchases"
ON public.daily_grocery_purchases FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for daily_eating_out
CREATE POLICY "Users can view their own eating out entries"
ON public.daily_eating_out FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own eating out entries"
ON public.daily_eating_out FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own eating out entries"
ON public.daily_eating_out FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own eating out entries"
ON public.daily_eating_out FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for daily_waste_logs
CREATE POLICY "Users can view their own waste logs"
ON public.daily_waste_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own waste logs"
ON public.daily_waste_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own waste logs"
ON public.daily_waste_logs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own waste logs"
ON public.daily_waste_logs FOR DELETE
USING (auth.uid() = user_id);

-- Add indexes for better query performance
CREATE INDEX idx_daily_meal_logs_user_date ON public.daily_meal_logs(user_id, log_date);
CREATE INDEX idx_daily_grocery_purchases_user_date ON public.daily_grocery_purchases(user_id, log_date);
CREATE INDEX idx_daily_eating_out_user_date ON public.daily_eating_out(user_id, log_date);
CREATE INDEX idx_daily_waste_logs_user_date ON public.daily_waste_logs(user_id, log_date);

-- Add updated_at triggers
CREATE TRIGGER update_daily_meal_logs_updated_at
BEFORE UPDATE ON public.daily_meal_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_grocery_purchases_updated_at
BEFORE UPDATE ON public.daily_grocery_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_eating_out_updated_at
BEFORE UPDATE ON public.daily_eating_out
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_waste_logs_updated_at
BEFORE UPDATE ON public.daily_waste_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();