-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.12
-- Horaires d’ouverture et fermetures exceptionnelles
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

create table if not exists public.business_breaks (
  id uuid primary key default gen_random_uuid(),
  day_of_week int not null check (day_of_week between 0 and 6), -- 0 = dimanche
  start_time time not null,
  end_time time not null,
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

drop trigger if exists trg_business_breaks_updated_at on public.business_breaks;
create trigger trg_business_breaks_updated_at
before update on public.business_breaks
for each row execute function public.set_updated_at();

create index if not exists idx_business_breaks_day_active
on public.business_breaks(day_of_week, is_active);

create table if not exists public.business_closures (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  scope text not null default 'all', -- all, esthetic, aquasport
  reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  check (scope in ('all', 'esthetic', 'aquasport'))
);

drop trigger if exists trg_business_closures_updated_at on public.business_closures;
create trigger trg_business_closures_updated_at
before update on public.business_closures
for each row execute function public.set_updated_at();

create index if not exists idx_business_closures_period_active
on public.business_closures(start_at, end_at, is_active);

alter table public.business_breaks enable row level security;
alter table public.business_closures enable row level security;

drop policy if exists "Public reads active business breaks" on public.business_breaks;
create policy "Public reads active business breaks"
on public.business_breaks
for select
to anon, authenticated
using (is_active = true or public.is_staff());

drop policy if exists "Admins manage business breaks" on public.business_breaks;
create policy "Admins manage business breaks"
on public.business_breaks
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public reads active business closures" on public.business_closures;
create policy "Public reads active business closures"
on public.business_closures
for select
to anon, authenticated
using (is_active = true or public.is_staff());

drop policy if exists "Admins manage business closures" on public.business_closures;
create policy "Admins manage business closures"
on public.business_closures
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.settings (key, value, description, is_sensitive)
values
  ('business_hours_admin_enabled', 'true', 'Activation de la gestion des horaires globaux dans l’admin.', false),
  ('business_breaks_enabled', 'true', 'Activation des pauses globales.', false),
  ('business_closures_enabled', 'true', 'Activation des fermetures exceptionnelles.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();

-- Exemple pause déjeuner globale, à décommenter si souhaité :
-- insert into public.business_breaks (day_of_week, start_time, end_time, label, is_active)
-- values
--   (1, '12:00', '13:00', 'Pause déjeuner', true),
--   (2, '12:00', '13:00', 'Pause déjeuner', true),
--   (3, '12:00', '13:00', 'Pause déjeuner', true),
--   (4, '12:00', '13:00', 'Pause déjeuner', true),
--   (5, '12:00', '13:00', 'Pause déjeuner', true)
-- on conflict do nothing;
