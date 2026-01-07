-- Add available_formats column to slots table
-- Values: 'offline', 'online', 'both'
ALTER TABLE public.slots 
ADD COLUMN IF NOT EXISTS available_formats text NOT NULL DEFAULT 'both';

-- Update existing slots to have 'both' as default
UPDATE public.slots SET available_formats = 'both' WHERE available_formats IS NULL;