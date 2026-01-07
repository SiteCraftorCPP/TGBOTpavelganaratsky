-- Add format column to slots table
ALTER TABLE public.slots 
ADD COLUMN format text DEFAULT 'offline' CHECK (format IN ('online', 'offline'));