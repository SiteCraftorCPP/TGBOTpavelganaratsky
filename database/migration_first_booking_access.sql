-- Первичная модерация: без истории записей в bookings самозапись только после одобрения админом.
-- Не используем DEFAULT true при ADD — иначе все существующие клиенты получают true и обходят модерацию.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS first_booking_access_requested_at TIMESTAMPTZ;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS first_booking_access_approved BOOLEAN;

-- Заполнить NULL и исправить ошибочные true у клиентов без единой записи в истории
UPDATE clients c
SET first_booking_access_approved = false
WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.client_id = c.id);

UPDATE clients c
SET first_booking_access_approved = COALESCE(c.first_booking_access_approved, false);

ALTER TABLE clients
  ALTER COLUMN first_booking_access_approved SET NOT NULL;

ALTER TABLE clients
  ALTER COLUMN first_booking_access_approved SET DEFAULT false;
