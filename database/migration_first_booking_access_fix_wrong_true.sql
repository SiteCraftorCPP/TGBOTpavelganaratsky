-- Одноразовое исправление, если уже выполняли старую миграцию с DEFAULT true:
-- у всех без истории записей сбрасываем одобрение, чтобы снова требовалась модерация.

UPDATE clients c
SET first_booking_access_approved = false
WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.client_id = c.id);
