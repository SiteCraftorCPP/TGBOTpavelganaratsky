-- Первичная модерация: новый клиент без записей в истории не видит календарь,
-- пока админ не нажмёт «Одобрить» в боте.
-- Выполните один раз на существующей БД.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS first_booking_access_approved BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS first_booking_access_requested_at TIMESTAMPTZ;

-- Уже существующие клиенты сохраняют доступ; новые строки без явного значения получают false.
ALTER TABLE clients
  ALTER COLUMN first_booking_access_approved SET DEFAULT false;
