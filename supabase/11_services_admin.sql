-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.10
-- Gestion complète des prestations dans l’admin
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

-- Les champs nécessaires existent déjà dans services.
-- Cette migration ajoute surtout des index utiles pour la gestion admin.

create index if not exists idx_services_category_id on public.services(category_id);
create index if not exists idx_services_is_active on public.services(is_active);
create index if not exists idx_services_service_type on public.services(service_type);
create index if not exists idx_services_payment_mode on public.services(payment_mode);
create index if not exists idx_employee_services_service_id on public.employee_services(service_id);
create index if not exists idx_employee_services_employee_id on public.employee_services(employee_id);

insert into public.settings (key, value, description, is_sensitive)
values
  ('services_admin_enabled', 'true', 'Activation de la gestion complète des prestations dans l’admin.', false),
  ('services_images_external_urls_enabled', 'true', 'Autorise les URL d’images externes pour les prestations.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();
