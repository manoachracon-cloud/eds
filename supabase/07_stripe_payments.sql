-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.6
-- Paiement Stripe
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

do $$ begin
  create type public.payment_status as enum (
    'unpaid',
    'pending',
    'paid',
    'failed',
    'cancelled',
    'refunded'
  );
exception when duplicate_object then null;
end $$;

alter table public.bookings
add column if not exists payment_status public.payment_status not null default 'unpaid';

alter table public.bookings
add column if not exists payment_amount_cents int;

alter table public.bookings
add column if not exists stripe_checkout_session_id text;

alter table public.bookings
add column if not exists stripe_payment_intent_id text;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  amount_cents int not null check (amount_cents >= 0),
  currency text not null default 'eur',
  payment_provider text not null default 'stripe',
  checkout_session_id text unique,
  payment_intent_id text,
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  refunded_at timestamptz,
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create index if not exists idx_payments_booking_id on public.payments(booking_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_payments_checkout_session_id on public.payments(checkout_session_id);
create index if not exists idx_payments_payment_intent_id on public.payments(payment_intent_id);

alter table public.payments enable row level security;

drop policy if exists "Staff reads payments" on public.payments;
create policy "Staff reads payments"
on public.payments
for select
to authenticated
using (public.is_staff());

drop policy if exists "Admins manage payments" on public.payments;
create policy "Admins manage payments"
on public.payments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.settings (key, value, description, is_sensitive)
values
  ('stripe_enabled', 'false', 'Activation du paiement Stripe.', false),
  ('stripe_currency', '"eur"', 'Devise Stripe par défaut.', false),
  ('payment_default_mode', '"pay_on_site"', 'Mode de paiement par défaut des prestations.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();

-- Exemple pour activer un acompte sur une prestation :
-- update public.services
-- set payment_mode = 'deposit_required', deposit_cents = 2000
-- where slug = 'massage-relaxant';
--
-- Exemple pour imposer le paiement complet :
-- update public.services
-- set payment_mode = 'full_payment_required'
-- where slug = 'aqua-bike';
