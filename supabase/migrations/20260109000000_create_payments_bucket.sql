-- Create storage bucket for payment screenshots if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('payments', 'payments', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for payments bucket
-- Drop existing policies if they exist (to avoid errors)
DROP POLICY IF EXISTS "Allow service role full access to payments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to payments" ON storage.objects;

-- Create policies
CREATE POLICY "Allow service role full access to payments"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'payments');

CREATE POLICY "Allow public read access to payments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payments');
