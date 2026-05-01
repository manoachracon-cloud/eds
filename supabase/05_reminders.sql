-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.4
-- Rappels automatiques client
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

alter table public.notifications
add column if not exists reminder_type text;

create unique index if not exists idx_notifications_unique_reminder_per_booking
on public.notifications (booking_id, reminder_type)
where reminder_type is not null
  and status in ('pending', 'sent');

insert into public.settings (key, value, description, is_sensitive)
values
  ('reminders_enabled', 'true', 'Activation des rappels automatiques client.', false),
  ('reminder_24h_enabled', 'true', 'Activation du rappel 24h avant rendez-vous.', false),
  ('reminder_2h_enabled', 'true', 'Activation du rappel 2h avant rendez-vous.', false),
  ('reminder_channel_email', 'true', 'Activation du canal e-mail pour les rappels.', false),
  ('reminder_window_minutes', '35', 'Fenêtre de détection des rendez-vous à rappeler.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();
