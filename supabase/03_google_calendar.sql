-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.2
-- Google Calendar support
-- À exécuter APRÈS 01_schema_v1.sql et 02_availability_rpc.sql
-- =========================================================

alter table public.employees
add column if not exists google_calendar_id text;

alter table public.bookings
add column if not exists google_calendar_calendar_id text;

insert into public.settings (key, value, description, is_sensitive)
values
  ('google_calendar_enabled', 'false', 'Activation Google Calendar.', false),
  ('google_calendar_default_calendar_id', '""', 'Calendrier Google principal utilisé pour les réservations.', true)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();
