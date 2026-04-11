alter table public.clients
  add column if not exists first_booking_access_approved boolean not null default true;

alter table public.clients
  add column if not exists first_booking_access_requested_at timestamptz;

alter table public.clients
  alter column first_booking_access_approved set default false;
