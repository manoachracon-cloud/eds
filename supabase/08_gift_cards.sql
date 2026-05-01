-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.7
-- Cartes cadeaux / coffrets
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

do $$ begin
  create type public.gift_card_status as enum (
    'pending',
    'active',
    'used',
    'expired',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

create or replace function public.generate_gift_card_code()
returns text
language plpgsql
as $$
declare
  code text;
begin
  code := 'EDS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  return code;
end;
$$;

create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default public.generate_gift_card_code(),
  buyer_name text not null,
  buyer_email text not null,
  recipient_name text,
  recipient_email text,
  message text,
  amount_cents int not null check (amount_cents >= 0),
  balance_cents int not null check (balance_cents >= 0),
  currency text not null default 'eur',
  status public.gift_card_status not null default 'pending',
  expires_at timestamptz,
  paid_at timestamptz,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_gift_cards_updated_at on public.gift_cards;
create trigger trg_gift_cards_updated_at
before update on public.gift_cards
for each row execute function public.set_updated_at();

create index if not exists idx_gift_cards_code on public.gift_cards(code);
create index if not exists idx_gift_cards_status on public.gift_cards(status);
create index if not exists idx_gift_cards_buyer_email on public.gift_cards(buyer_email);
create index if not exists idx_gift_cards_recipient_email on public.gift_cards(recipient_email);
create index if not exists idx_gift_cards_stripe_checkout_session_id on public.gift_cards(stripe_checkout_session_id);

create table if not exists public.gift_card_redemptions (
  id uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references public.gift_cards(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  amount_cents int not null check (amount_cents > 0),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_gift_card_redemptions_gift_card_id
on public.gift_card_redemptions(gift_card_id);

alter table public.gift_cards enable row level security;
alter table public.gift_card_redemptions enable row level security;

drop policy if exists "Staff reads gift cards" on public.gift_cards;
create policy "Staff reads gift cards"
on public.gift_cards
for select
to authenticated
using (public.is_staff());

drop policy if exists "Admins manage gift cards" on public.gift_cards;
create policy "Admins manage gift cards"
on public.gift_cards
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Staff reads gift card redemptions" on public.gift_card_redemptions;
create policy "Staff reads gift card redemptions"
on public.gift_card_redemptions
for select
to authenticated
using (public.is_staff());

drop policy if exists "Admins manage gift card redemptions" on public.gift_card_redemptions;
create policy "Admins manage gift card redemptions"
on public.gift_card_redemptions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.settings (key, value, description, is_sensitive)
values
  ('gift_cards_enabled', 'true', 'Activation des cartes cadeaux digitales.', false),
  ('gift_card_default_expiry_months', '12', 'Durée de validité par défaut des cartes cadeaux.', false),
  ('gift_card_min_amount_cents', '1000', 'Montant minimum carte cadeau.', false),
  ('gift_card_max_amount_cents', '100000', 'Montant maximum carte cadeau.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();
