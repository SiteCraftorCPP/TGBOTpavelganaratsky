-- Create payments table for storing payment screenshots
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  screenshot_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policies for service role
CREATE POLICY "Allow all for service role payments" 
ON public.payments 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Policy for anon read
CREATE POLICY "Allow read access for anon payments" 
ON public.payments 
FOR SELECT 
USING (true);

-- Policy for anon delete
CREATE POLICY "Allow delete for anon payments" 
ON public.payments 
FOR DELETE 
USING (true);

-- Create storage bucket for payment screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('payments', 'payments', true);

-- Storage policies
CREATE POLICY "Anyone can upload payment screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payments');

CREATE POLICY "Anyone can view payment screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'payments');

CREATE POLICY "Anyone can delete payment screenshots"
ON storage.objects FOR DELETE
USING (bucket_id = 'payments');