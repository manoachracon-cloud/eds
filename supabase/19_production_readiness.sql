-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.18
-- Production readiness / statut intégrations
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

insert into public.settings (key, value, description, is_sensitive)
values
  ('production_readiness_enabled', 'true', 'Activation du module production readiness.', false),
  ('healthcheck_enabled', 'true', 'Activation de la route /api/health.', false),
  ('status_page_enabled', 'true', 'Activation de la page statut intégrations dans l’admin.', false),
  ('deployment_environment', '"production"', 'Environnement cible recommandé.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();

-- Vue simple pour vérifier les volumes critiques.
create or replace view public.platform_operational_summary as
select
  (select count(*) from public.clients) as clients_count,
  (select count(*) from public.bookings) as bookings_count,
  (select count(*) from public.services) as services_count,
  (select count(*) from public.employees) as employees_count,
  (select count(*) from public.notifications where status = 'failed') as failed_notifications_count,
  (select count(*) from public.notifications where status = 'pending') as pending_notifications_count,
  (select count(*) from public.gift_cards where status = 'active') as active_gift_cards_count,
  (select count(*) from public.aquasport_classes where status in ('open', 'full', 'closed')) as active_aquasport_classes_count;
