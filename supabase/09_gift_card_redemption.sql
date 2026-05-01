-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.8
-- Utilisation des cartes cadeaux dans une réservation
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

do $$ begin
  alter type public.payment_status add value if not exists 'partially_paid';
exception when duplicate_object then null;
end $$;

alter table public.bookings
add column if not exists gift_card_code text;

alter table public.bookings
add column if not exists gift_card_amount_cents int not null default 0 check (gift_card_amount_cents >= 0);

alter table public.bookings
add column if not exists payment_due_cents int not null default 0 check (payment_due_cents >= 0);

create index if not exists idx_bookings_gift_card_code
on public.bookings(gift_card_code);

insert into public.settings (key, value, description, is_sensitive)
values
  ('gift_card_redemption_enabled', 'true', 'Activation de l’utilisation des cartes cadeaux dans le tunnel de réservation.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();

-- Note : la V1.8 applique la carte cadeau côté route serveur.
-- Pour une version bancaire critique, on pourra ensuite migrer la logique dans une fonction PostgreSQL transactionnelle.
