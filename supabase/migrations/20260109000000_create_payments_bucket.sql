-- Create storage bucket for payment screenshots if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('payments', 'payments', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for payments bucket
CREATE POLICY IF NOT EXISTS "Allow service role full access to payments"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'payments');

CREATE POLICY IF NOT EXISTS "Allow public read access to payments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payments');
