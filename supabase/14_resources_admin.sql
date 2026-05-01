-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.13
-- Gestion des ressources physiques
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

do $$ begin
  create type public.resource_type as enum (
    'treatment_room',
    'aquasport_pool',
    'equipment',
    'other'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  resource_type public.resource_type not null default 'treatment_room',
  location text,
  capacity int not null default 1 check (capacity >= 1),
  description text,
  is_active boolean not null default true,
  is_bookable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_resources_updated_at on public.resources;
create trigger trg_resources_updated_at
before update on public.resources
for each row execute function public.set_updated_at();

create table if not exists public.resource_services (
  resource_id uuid not null references public.resources(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (resource_id, service_id)
);

create table if not exists public.resource_time_off (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

drop trigger if exists trg_resource_time_off_updated_at on public.resource_time_off;
create trigger trg_resource_time_off_updated_at
before update on public.resource_time_off
for each row execute function public.set_updated_at();

alter table public.bookings
add column if not exists resource_id uuid references public.resources(id) on delete set null;

create index if not exists idx_resources_active_bookable on public.resources(is_active, is_bookable);
create index if not exists idx_resource_services_service_id on public.resource_services(service_id);
create index if not exists idx_resource_services_resource_id on public.resource_services(resource_id);
create index if not exists idx_resource_time_off_resource_id_start on public.resource_time_off(resource_id, start_at);
create index if not exists idx_bookings_resource_id_start on public.bookings(resource_id, start_at);

create unique index if not exists idx_bookings_unique_resource_start
on public.bookings(resource_id, start_at)
where status in ('pending', 'confirmed') and resource_id is not null;

alter table public.resources enable row level security;
alter table public.resource_services enable row level security;
alter table public.resource_time_off enable row level security;

drop policy if exists "Public reads active bookable resources" on public.resources;
create policy "Public reads active bookable resources"
on public.resources
for select
to anon, authenticated
using ((is_active = true and is_bookable = true) or public.is_staff());

drop policy if exists "Admins manage resources" on public.resources;
create policy "Admins manage resources"
on public.resources
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public reads resource services" on public.resource_services;
create policy "Public reads resource services"
on public.resource_services
for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage resource services" on public.resource_services;
create policy "Admins manage resource services"
on public.resource_services
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Staff reads resource time off" on public.resource_time_off;
create policy "Staff reads resource time off"
on public.resource_time_off
for select
to authenticated
using (public.is_staff());

drop policy if exists "Admins manage resource time off" on public.resource_time_off;
create policy "Admins manage resource time off"
on public.resource_time_off
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.settings (key, value, description, is_sensitive)
values
  ('resources_admin_enabled', 'true', 'Activation de la gestion des ressources physiques.', false),
  ('resources_conflict_check_enabled', 'true', 'Activation de la vérification anti-conflit des ressources.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();

-- Exemples à adapter :
-- insert into public.resources (name, resource_type, location, capacity, description)
-- values
--   ('Cabine soin 1', 'treatment_room', 'Spa', 1, 'Cabine soins visage et corps'),
--   ('Bassin Aqua-sports', 'aquasport_pool', 'Espace Aqua', 12, 'Bassin pour aquabike et aquagym'),
--   ('Aqua Bike 1', 'equipment', 'Espace Aqua', 1, 'Vélo aquatique');
