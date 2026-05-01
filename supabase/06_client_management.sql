-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.5
-- Gestion client avec lien unique
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

-- Les réservations ont déjà management_token dans le schéma V1.
-- Cet index accélère la recherche par token.
create index if not exists idx_bookings_management_token
on public.bookings (management_token);

create table if not exists public.booking_change_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  requested_date date,
  requested_time time,
  message text,
  status text not null default 'pending',
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_booking_change_requests_updated_at on public.booking_change_requests;
create trigger trg_booking_change_requests_updated_at
before update on public.booking_change_requests
for each row execute function public.set_updated_at();

alter table public.booking_change_requests enable row level security;

drop policy if exists "Staff reads booking change requests" on public.booking_change_requests;
create policy "Staff reads booking change requests"
on public.booking_change_requests
for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff updates booking change requests" on public.booking_change_requests;
create policy "Staff updates booking change requests"
on public.booking_change_requests
for update
to authenticated
using (public.is_staff())
with check (public.is_staff());

-- Les demandes client passent par une route serveur service_role, donc pas besoin d'INSERT public direct.

insert into public.settings (key, value, description, is_sensitive)
values
  ('client_management_enabled', 'true', 'Activation du lien unique client pour gérer une réservation.', false),
  ('client_cancellation_min_hours', '24', 'Délai minimum d’annulation client en heures.', false),
  ('client_modification_request_enabled', 'true', 'Activation des demandes de modification client.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();
