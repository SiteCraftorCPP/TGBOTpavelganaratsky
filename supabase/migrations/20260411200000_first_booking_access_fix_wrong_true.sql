-- Сброс ошибочного true у клиентов без записей (старая миграция с DEFAULT true).
update public.clients c
set first_booking_access_approved = false
where not exists (
  select 1 from public.bookings b where b.client_id = c.id
);
