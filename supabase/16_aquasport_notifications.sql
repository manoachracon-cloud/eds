-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.15
-- Notifications groupées Aqua-sports
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

alter table public.aquasport_classes
add column if not exists last_notified_at timestamptz;

alter table public.aquasport_classes
add column if not exists last_notification_type text;

alter table public.aquasport_waitlist
add column if not exists last_notified_at timestamptz;

alter table public.aquasport_waitlist
add column if not exists last_notification_type text;

create index if not exists idx_aquasport_waitlist_last_notified
on public.aquasport_waitlist(last_notified_at);

insert into public.settings (key, value, description, is_sensitive)
values
  ('aquasport_group_notifications_enabled', 'true', 'Activation des notifications groupées Aqua-sports.', false),
  ('aquasport_waitlist_auto_notify_enabled', 'true', 'Activation de la notification automatique liste d’attente quand une place se libère.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();
