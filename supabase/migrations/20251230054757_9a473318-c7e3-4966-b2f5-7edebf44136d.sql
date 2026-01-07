-- Fix function search path mutable warning
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER update_slots_updated_at
    BEFORE UPDATE ON public.slots
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bot_settings_updated_at
    BEFORE UPDATE ON public.bot_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Drop restrictive RLS policies and add permissive ones for service role access
-- These tables are accessed via edge functions using service role, so we need anon access for admin panel

-- clients table
DROP POLICY IF EXISTS "Allow all for service role" ON public.clients;
CREATE POLICY "Allow read access for anon"
ON public.clients
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow all for service role"
ON public.clients
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- bookings table
DROP POLICY IF EXISTS "Allow all for service role" ON public.bookings;
CREATE POLICY "Allow read access for anon"
ON public.bookings
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow all for service role"
ON public.bookings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- slots table
DROP POLICY IF EXISTS "Allow all for service role" ON public.slots;
CREATE POLICY "Allow read access for anon"
ON public.slots
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow insert update for anon"
ON public.slots
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow update for anon"
ON public.slots
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow delete for anon"
ON public.slots
FOR DELETE
TO anon
USING (true);

CREATE POLICY "Allow all for service role slots"
ON public.slots
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- diary_entries table
DROP POLICY IF EXISTS "Allow all for service role" ON public.diary_entries;
CREATE POLICY "Allow read access for anon diary"
ON public.diary_entries
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow all for service role diary"
ON public.diary_entries
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- sos_requests table
DROP POLICY IF EXISTS "Allow all for service role" ON public.sos_requests;
CREATE POLICY "Allow read access for anon sos"
ON public.sos_requests
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow update for anon sos"
ON public.sos_requests
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all for service role sos"
ON public.sos_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- bot_settings table
DROP POLICY IF EXISTS "Allow all for service role" ON public.bot_settings;
CREATE POLICY "Allow read access for anon settings"
ON public.bot_settings
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow all for service role settings"
ON public.bot_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);