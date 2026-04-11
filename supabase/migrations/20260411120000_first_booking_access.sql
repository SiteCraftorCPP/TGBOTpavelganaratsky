alter table public.clients
  add column if not exists first_booking_access_requested_at timestamptz;

alter table public.clients
  add column if not exists first_booking_access_approved boolean;

update public.clients c
set first_booking_access_approved = false
where not exists (
  select 1 from public.bookings b where b.client_id = c.id
);

update public.clients c
set first_booking_access_approved = coalesce(c.first_booking_access_approved, false);

alter table public.clients
  alter column first_booking_access_approved set not null;

alter table public.clients
  alter column first_booking_access_approved set default false;
