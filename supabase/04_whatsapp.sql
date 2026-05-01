-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.3
-- WhatsApp Business support
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

insert into public.settings (key, value, description, is_sensitive)
values
  ('whatsapp_enabled', 'false', 'Activation WhatsApp Business Cloud API.', false),
  ('whatsapp_internal_mode', '"text"', 'Mode notification interne : text ou template.', false),
  ('whatsapp_internal_to', '""', 'Numéro WhatsApp interne recevant les réservations.', true),
  ('whatsapp_template_name', '"internal_booking_notification"', 'Nom du template WhatsApp interne si mode template.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();
