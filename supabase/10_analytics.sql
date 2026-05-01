-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.9
-- Statistiques avancées
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

-- Index utiles pour les statistiques admin
create index if not exists idx_bookings_created_at on public.bookings(created_at);
create index if not exists idx_bookings_payment_status on public.bookings(payment_status);
create index if not exists idx_bookings_service_id_start_at on public.bookings(service_id, start_at);
create index if not exists idx_gift_cards_created_at on public.gift_cards(created_at);
create index if not exists idx_gift_card_redemptions_created_at on public.gift_card_redemptions(created_at);

-- Vue synthèse réservations par prestation
create or replace view public.analytics_service_performance as
select
  s.id as service_id,
  s.name as service_name,
  c.name as category_name,
  count(b.id) as total_bookings,
  count(b.id) filter (where b.status = 'confirmed') as confirmed_bookings,
  count(b.id) filter (where b.status = 'cancelled') as cancelled_bookings,
  count(b.id) filter (where b.status = 'done') as done_bookings,
  coalesce(sum(b.price_cents) filter (where b.status <> 'cancelled'), 0) as revenue_estimated_cents,
  coalesce(sum(b.payment_amount_cents) filter (where b.payment_status in ('paid', 'partially_paid')), 0) as revenue_paid_cents,
  coalesce(sum(b.gift_card_amount_cents), 0) as gift_card_used_cents
from public.services s
left join public.service_categories c on c.id = s.category_id
left join public.bookings b on b.service_id = s.id
group by s.id, s.name, c.name;

-- Vue synthèse clients
create or replace view public.analytics_client_performance as
select
  cl.id as client_id,
  cl.first_name,
  cl.last_name,
  cl.email,
  cl.phone,
  count(b.id) as total_bookings,
  max(b.start_at) as last_booking_at,
  coalesce(sum(b.price_cents) filter (where b.status <> 'cancelled'), 0) as revenue_estimated_cents
from public.clients cl
left join public.bookings b on b.client_id = cl.id
group by cl.id, cl.first_name, cl.last_name, cl.email, cl.phone;

-- RLS sur les vues : elles héritent des droits des tables via security_invoker.
-- Postgres 15+ supporte security_invoker sur les vues.
do $$
begin
  execute 'alter view public.analytics_service_performance set (security_invoker = true)';
exception when others then
  null;
end $$;

do $$
begin
  execute 'alter view public.analytics_client_performance set (security_invoker = true)';
exception when others then
  null;
end $$;

insert into public.settings (key, value, description, is_sensitive)
values
  ('analytics_enabled', 'true', 'Activation du module statistiques avancées.', false),
  ('analytics_export_csv_enabled', 'true', 'Activation des exports CSV depuis l’admin.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();
