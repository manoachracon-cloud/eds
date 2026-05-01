-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.19
-- UX polish / mode démonstration
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

insert into public.settings (key, value, description, is_sensitive)
values
  ('ux_polish_enabled', 'true', 'Activation des finitions UX/UI V1.19.', false),
  ('demo_mode_available', 'true', 'Mode démonstration disponible côté application via NEXT_PUBLIC_DEMO_MODE.', false),
  ('empty_states_enabled', 'true', 'Activation des écrans vides premium.', false),
  ('skeleton_loading_enabled', 'true', 'Activation des skeleton loading.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();
