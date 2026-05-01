-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1 Schema
-- Objectif : réservation en ligne + admin + planning + Aqua-sports
-- À exécuter dans Supabase > SQL Editor > New Query > Run
-- =========================================================

-- Extensions utiles
create extension if not exists pgcrypto;

-- =========================================================
-- 1. ENUMS
-- =========================================================

do $$ begin
  create type public.user_role as enum (
    'super_admin',
    'admin',
    'reception',
    'employee_esthetic',
    'coach_aquasport'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.service_type as enum (
    'individual',
    'collective',
    'gift_card'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.booking_status as enum (
    'pending',
    'confirmed',
    'cancelled',
    'done',
    'no_show',
    'rescheduled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.class_status as enum (
    'open',
    'full',
    'closed',
    'cancelled',
    'done'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.notification_channel as enum (
    'email',
    'sms',
    'whatsapp',
    'google_calendar',
    'internal'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.notification_status as enum (
    'pending',
    'sent',
    'failed',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_mode as enum (
    'pay_on_site',
    'deposit_required',
    'full_payment_required'
  );
exception when duplicate_object then null;
end $$;

-- =========================================================
-- 2. FONCTIONS UTILITAIRES
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Fonction RLS : rôle courant depuis Supabase Auth
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_profiles
  where user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in (
    'super_admin',
    'admin',
    'reception',
    'employee_esthetic',
    'coach_aquasport'
  ), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('super_admin', 'admin'), false)
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'super_admin', false)
$$;

-- =========================================================
-- 3. TABLES PRINCIPALES
-- =========================================================

-- Profils internes liés à Supabase Auth.
-- Ne pas modifier auth.users : on garde les informations métier ici.
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'reception',
  first_name text not null,
  last_name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

-- Employés affichables dans le planning.
-- Les contacts sensibles restent dans user_profiles / auth, pas en accès public.
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.user_profiles(user_id) on delete set null,
  first_name text not null,
  last_name text not null,
  public_display_name text generated always as (first_name || ' ' || left(last_name, 1) || '.') stored,
  role_title text not null,
  bio text,
  photo_url text,
  is_bookable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_service_categories_updated_at on public.service_categories;
create trigger trg_service_categories_updated_at
before update on public.service_categories
for each row execute function public.set_updated_at();

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  short_description text not null,
  long_description text,
  duration_minutes int not null check (duration_minutes > 0 and duration_minutes <= 480),
  price_cents int not null check (price_cents >= 0),
  service_type public.service_type not null default 'individual',
  capacity_max int not null default 1 check (capacity_max >= 1),
  buffer_before_minutes int not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes int not null default 0 check (buffer_after_minutes >= 0),
  payment_mode public.payment_mode not null default 'pay_on_site',
  deposit_cents int not null default 0 check (deposit_cents >= 0),
  image_url text,
  contraindications text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_services_updated_at on public.services;
create trigger trg_services_updated_at
before update on public.services
for each row execute function public.set_updated_at();

create table if not exists public.employee_services (
  employee_id uuid not null references public.employees(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (employee_id, service_id)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text not null,
  birth_date date,
  notes text,
  allergies text,
  contraindications text,
  gdpr_consent boolean not null default false,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

-- Horaires généraux de l’établissement
create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week int not null check (day_of_week between 0 and 6), -- 0 = dimanche
  opening_time time,
  closing_time time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (day_of_week)
);

drop trigger if exists trg_business_hours_updated_at on public.business_hours;
create trigger trg_business_hours_updated_at
before update on public.business_hours
for each row execute function public.set_updated_at();

-- Indisponibilités simples par employé
create table if not exists public.employee_time_off (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

drop trigger if exists trg_employee_time_off_updated_at on public.employee_time_off;
create trigger trg_employee_time_off_updated_at
before update on public.employee_time_off
for each row execute function public.set_updated_at();

-- Cours collectifs Aqua-sports
create table if not exists public.aquasport_classes (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete restrict,
  coach_employee_id uuid not null references public.employees(id) on delete restrict,
  title text not null,
  level text not null default 'tous niveaux',
  start_at timestamptz not null,
  end_at timestamptz not null,
  capacity_max int not null check (capacity_max > 0),
  status public.class_status not null default 'open',
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

drop trigger if exists trg_aquasport_classes_updated_at on public.aquasport_classes;
create trigger trg_aquasport_classes_updated_at
before update on public.aquasport_classes
for each row execute function public.set_updated_at();

create unique index if not exists idx_aquasport_classes_coach_start
on public.aquasport_classes(coach_employee_id, start_at)
where status in ('open', 'full', 'closed');

-- Réservations
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique default ('EDS-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  management_token uuid not null default gen_random_uuid(),

  client_id uuid not null references public.clients(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  employee_id uuid references public.employees(id) on delete set null,
  aquasport_class_id uuid references public.aquasport_classes(id) on delete set null,

  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes int not null,
  price_cents int not null,

  status public.booking_status not null default 'confirmed',
  client_comment text,
  internal_note text,

  google_calendar_event_id text,
  cancelled_at timestamptz,
  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (end_at > start_at)
);

drop trigger if exists trg_bookings_updated_at on public.bookings;
create trigger trg_bookings_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create index if not exists idx_bookings_start_at on public.bookings(start_at);
create index if not exists idx_bookings_client_id on public.bookings(client_id);
create index if not exists idx_bookings_employee_id on public.bookings(employee_id);
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_bookings_aquasport_class_id on public.bookings(aquasport_class_id);

-- Empêche deux RDV individuels sur le même employé au même début.
-- La logique fine de chevauchement complet doit être gérée côté API/Edge Function.
create unique index if not exists idx_bookings_unique_employee_start
on public.bookings(employee_id, start_at)
where status in ('pending', 'confirmed') and aquasport_class_id is null and employee_id is not null;

create table if not exists public.aquasport_participants (
  id uuid primary key default gen_random_uuid(),
  aquasport_class_id uuid not null references public.aquasport_classes(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  attendance_status text not null default 'registered',
  health_notes text,
  created_at timestamptz not null default now(),
  unique (aquasport_class_id, client_id),
  unique (booking_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  channel public.notification_channel not null,
  recipient text not null,
  subject text,
  message text not null,
  status public.notification_status not null default 'pending',
  provider text,
  provider_message_id text,
  sent_at timestamptz,
  failed_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  description text,
  is_sensitive boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 4. TRIGGERS MÉTIER RÉSERVATION
-- =========================================================

create or replace function public.prepare_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  svc record;
  cls record;
  existing_count int;
begin
  select *
  into svc
  from public.services
  where id = new.service_id
    and is_active = true;

  if not found then
    raise exception 'Service introuvable ou inactif.';
  end if;

  -- Hydrate prix/durée depuis la prestation pour éviter toute manipulation front.
  new.duration_minutes := svc.duration_minutes;
  new.price_cents := svc.price_cents;

  if new.status is null then
    new.status := 'confirmed';
  end if;

  -- Cas Aqua-sports : la date/heure/employé viennent de la classe.
  if new.aquasport_class_id is not null then
    select *
    into cls
    from public.aquasport_classes
    where id = new.aquasport_class_id
      and status in ('open', 'full', 'closed');

    if not found then
      raise exception 'Cours Aqua-sports introuvable.';
    end if;

    if cls.status <> 'open' then
      raise exception 'Ce cours Aqua-sports n''est pas ouvert aux inscriptions.';
    end if;

    new.start_at := cls.start_at;
    new.end_at := cls.end_at;
    new.employee_id := cls.coach_employee_id;

    select count(*)
    into existing_count
    from public.bookings b
    where b.aquasport_class_id = new.aquasport_class_id
      and b.status in ('pending', 'confirmed')
      and b.id <> coalesce(new.id, gen_random_uuid());

    if existing_count >= cls.capacity_max then
      raise exception 'Ce cours Aqua-sports est complet.';
    end if;
  else
    -- Cas rendez-vous individuel : start_at obligatoire.
    if new.start_at is null then
      raise exception 'Le créneau de départ est obligatoire.';
    end if;

    new.end_at := new.start_at
      + ((svc.duration_minutes + svc.buffer_after_minutes)::text || ' minutes')::interval;
  end if;

  if new.status = 'cancelled' and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prepare_booking on public.bookings;
create trigger trg_prepare_booking
before insert or update on public.bookings
for each row execute function public.prepare_booking();

create or replace function public.create_aquasport_participant_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.aquasport_class_id is not null and new.status in ('pending', 'confirmed') then
    insert into public.aquasport_participants (
      aquasport_class_id,
      booking_id,
      client_id,
      attendance_status
    )
    values (
      new.aquasport_class_id,
      new.id,
      new.client_id,
      'registered'
    )
    on conflict (booking_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_aquasport_participant_from_booking on public.bookings;
create trigger trg_aquasport_participant_from_booking
after insert or update on public.bookings
for each row execute function public.create_aquasport_participant_from_booking();

-- =========================================================
-- 5. ROW LEVEL SECURITY
-- =========================================================

alter table public.user_profiles enable row level security;
alter table public.employees enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.employee_services enable row level security;
alter table public.clients enable row level security;
alter table public.business_hours enable row level security;
alter table public.employee_time_off enable row level security;
alter table public.aquasport_classes enable row level security;
alter table public.bookings enable row level security;
alter table public.aquasport_participants enable row level security;
alter table public.notifications enable row level security;
alter table public.settings enable row level security;
alter table public.audit_logs enable row level security;

-- user_profiles
drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
on public.user_profiles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage profiles" on public.user_profiles;
create policy "Admins manage profiles"
on public.user_profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- categories
drop policy if exists "Public reads active categories" on public.service_categories;
create policy "Public reads active categories"
on public.service_categories
for select
to anon, authenticated
using (is_active = true or public.is_staff());

drop policy if exists "Admins manage categories" on public.service_categories;
create policy "Admins manage categories"
on public.service_categories
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- services
drop policy if exists "Public reads active services" on public.services;
create policy "Public reads active services"
on public.services
for select
to anon, authenticated
using (is_active = true or public.is_staff());

drop policy if exists "Admins manage services" on public.services;
create policy "Admins manage services"
on public.services
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- employees
drop policy if exists "Public reads active bookable employees" on public.employees;
create policy "Public reads active bookable employees"
on public.employees
for select
to anon, authenticated
using (is_active = true and is_bookable = true);

drop policy if exists "Admins manage employees" on public.employees;
create policy "Admins manage employees"
on public.employees
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- employee_services
drop policy if exists "Public reads employee services" on public.employee_services;
create policy "Public reads employee services"
on public.employee_services
for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage employee services" on public.employee_services;
create policy "Admins manage employee services"
on public.employee_services
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- clients
drop policy if exists "Public creates client profile" on public.clients;
create policy "Public creates client profile"
on public.clients
for insert
to anon, authenticated
with check (
  length(first_name) >= 1
  and length(last_name) >= 1
  and length(phone) >= 6
  and email like '%@%'
);

drop policy if exists "Staff reads clients" on public.clients;
create policy "Staff reads clients"
on public.clients
for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff updates clients" on public.clients;
create policy "Staff updates clients"
on public.clients
for update
to authenticated
using (public.is_staff())
with check (public.is_staff());

-- business_hours
drop policy if exists "Public reads business hours" on public.business_hours;
create policy "Public reads business hours"
on public.business_hours
for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage business hours" on public.business_hours;
create policy "Admins manage business hours"
on public.business_hours
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- employee_time_off
drop policy if exists "Staff reads time off" on public.employee_time_off;
create policy "Staff reads time off"
on public.employee_time_off
for select
to authenticated
using (public.is_staff());

drop policy if exists "Admins manage time off" on public.employee_time_off;
create policy "Admins manage time off"
on public.employee_time_off
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- aquasport_classes
drop policy if exists "Public reads open aquasport classes" on public.aquasport_classes;
create policy "Public reads open aquasport classes"
on public.aquasport_classes
for select
to anon, authenticated
using (status in ('open', 'full', 'closed') or public.is_staff());

drop policy if exists "Admins manage aquasport classes" on public.aquasport_classes;
create policy "Admins manage aquasport classes"
on public.aquasport_classes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- bookings
drop policy if exists "Public creates bookings" on public.bookings;
create policy "Public creates bookings"
on public.bookings
for insert
to anon, authenticated
with check (
  status in ('pending', 'confirmed')
);

drop policy if exists "Staff reads bookings" on public.bookings;
create policy "Staff reads bookings"
on public.bookings
for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff updates bookings" on public.bookings;
create policy "Staff updates bookings"
on public.bookings
for update
to authenticated
using (public.is_staff())
with check (public.is_staff());

-- aquasport_participants
drop policy if exists "Staff reads participants" on public.aquasport_participants;
create policy "Staff reads participants"
on public.aquasport_participants
for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff manages participants" on public.aquasport_participants;
create policy "Staff manages participants"
on public.aquasport_participants
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

-- notifications
drop policy if exists "Staff reads notifications" on public.notifications;
create policy "Staff reads notifications"
on public.notifications
for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff manages notifications" on public.notifications;
create policy "Staff manages notifications"
on public.notifications
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

-- settings
drop policy if exists "Staff reads settings" on public.settings;
create policy "Staff reads settings"
on public.settings
for select
to authenticated
using (public.is_staff() and (is_sensitive = false or public.is_admin()));

drop policy if exists "Admins manage settings" on public.settings;
create policy "Admins manage settings"
on public.settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- audit_logs
drop policy if exists "Admins read audit logs" on public.audit_logs;
create policy "Admins read audit logs"
on public.audit_logs
for select
to authenticated
using (public.is_admin());

drop policy if exists "Staff inserts audit logs" on public.audit_logs;
create policy "Staff inserts audit logs"
on public.audit_logs
for insert
to authenticated
with check (public.is_staff());

-- =========================================================
-- 6. SEED DATA V1
-- =========================================================

insert into public.service_categories (name, slug, description, display_order, is_active)
values
  ('Soins du visage', 'soins-du-visage', 'Soins personnalisés, éclat, anti-âge et hydratation.', 10, true),
  ('Épilation', 'epilation', 'Prestations d’épilation professionnelle.', 20, true),
  ('Beauté des mains', 'beaute-des-mains', 'Soins et mise en beauté des mains.', 30, true),
  ('Beauté des pieds', 'beaute-des-pieds', 'Soins et mise en beauté des pieds.', 40, true),
  ('Microshading / Cils', 'microshading-cils', 'Regard, cils et prestations beauté ciblées.', 50, true),
  ('Gommages corporels', 'gommages-corporels', 'Soin du corps et exfoliation.', 60, true),
  ('Massages', 'massages', 'Massages relaxants et soins bien-être.', 70, true),
  ('Soins minceur', 'soins-minceur', 'Prestations minceur et silhouette.', 80, true),
  ('Aqua-sports', 'aqua-sports', 'Aquabike, aquagym et activités aquatiques.', 90, true),
  ('Coffrets bien-être', 'coffrets-bien-etre', 'Cartes cadeaux, coffrets et offres spéciales.', 100, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.services (
  category_id,
  name,
  slug,
  short_description,
  duration_minutes,
  price_cents,
  service_type,
  capacity_max,
  image_url,
  is_featured,
  is_active
)
select c.id, s.name, s.slug, s.short_description, s.duration_minutes, s.price_cents, s.service_type::public.service_type, s.capacity_max, s.image_url, s.is_featured, true
from (
  values
    ('soins-du-visage', 'Soin visage éclat', 'soin-visage-eclat', 'Soin personnalisé pour illuminer le teint et retrouver une peau fraîche.', 45, 5500, 'individual', 1, 'https://www.estheticdiamonds.fr/ressources/images/5-shutterstock-1345010954_9430_lg.jpg', true),
    ('massages', 'Massage relaxant', 'massage-relaxant', 'Parenthèse sensorielle pour relâcher les tensions et apaiser le corps.', 60, 7500, 'individual', 1, 'https://www.estheticdiamonds.fr/ressources/images/Image-fx-1_3b15_lg.jpeg', true),
    ('epilation', 'Épilation laser diode', 'epilation-laser-diode', 'Solution moderne pour une peau lisse avec une approche professionnelle.', 40, 6500, 'individual', 1, 'https://www.estheticdiamonds.fr/ressources/images/customImage_d246_lg.jpeg', true),
    ('beaute-des-mains', 'Beauté des mains', 'beaute-des-mains', 'Mise en beauté soignée des mains dans un esprit propre et lumineux.', 50, 4800, 'individual', 1, 'https://www.estheticdiamonds.fr/ressources/images/2-shutterstock-1767055244_85b6_lg.jpg', true),
    ('gommages-corporels', 'Gommage corporel', 'gommage-corporel', 'Soin du corps pour une peau douce et une sensation de légèreté.', 45, 5900, 'individual', 1, 'https://www.estheticdiamonds.fr/ressources/images/Image-fx-1_3b15_lg.jpeg', false),
    ('aqua-sports', 'Aqua Bike', 'aqua-bike', 'Séance aquatique dynamique pour tonifier le corps en douceur.', 45, 2500, 'collective', 8, 'https://www.estheticdiamonds.fr/ressources/images/4-shutterstock-1443123710_520b_lg.jpg', true),
    ('aqua-sports', 'Aqua Gym', 'aqua-gym', 'Cours aquatique collectif pour renforcer le corps avec légèreté.', 45, 2200, 'collective', 12, 'https://www.estheticdiamonds.fr/ressources/images/4-shutterstock-1443123710_520b_lg.jpg', true),
    ('coffrets-bien-etre', 'Coffret bien-être', 'coffret-bien-etre', 'Offre cadeau idéale pour offrir une parenthèse de bien-être.', 60, 9000, 'gift_card', 1, 'https://www.estheticdiamonds.fr/ressources/images/5-shutterstock-1345010954_9430_lg.jpg', false)
) as s(category_slug, name, slug, short_description, duration_minutes, price_cents, service_type, capacity_max, image_url, is_featured)
join public.service_categories c on c.slug = s.category_slug
on conflict (slug) do update set
  name = excluded.name,
  short_description = excluded.short_description,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  service_type = excluded.service_type,
  capacity_max = excluded.capacity_max,
  image_url = excluded.image_url,
  is_featured = excluded.is_featured,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.employees (first_name, last_name, role_title, bio, is_bookable, is_active)
values
  ('Mélissa', 'D', 'Esthéticienne', 'Soins visage, épilation, beauté et prestations spa.', true, true),
  ('Laura', 'B', 'Spa praticienne', 'Massages, gommages corporels et soins bien-être.', true, true),
  ('Chloé', 'M', 'Coach Aqua-sports', 'Aquabike, aquagym et séances aquatiques.', true, true)
on conflict do nothing;

-- Association simple employés / prestations par rôle
insert into public.employee_services (employee_id, service_id)
select e.id, s.id
from public.employees e
join public.services s on (
  (e.role_title in ('Esthéticienne', 'Spa praticienne') and s.service_type in ('individual', 'gift_card'))
  or
  (e.role_title = 'Coach Aqua-sports' and s.service_type = 'collective')
)
on conflict do nothing;

insert into public.business_hours (day_of_week, opening_time, closing_time, is_closed)
values
  (0, '09:00', '13:00', false),
  (1, '09:00', '18:00', false),
  (2, '09:00', '18:00', false),
  (3, '09:00', '18:00', false),
  (4, '09:00', '18:00', false),
  (5, '09:00', '18:00', false),
  (6, null, null, true)
on conflict (day_of_week) do update set
  opening_time = excluded.opening_time,
  closing_time = excluded.closing_time,
  is_closed = excluded.is_closed,
  updated_at = now();

insert into public.settings (key, value, description, is_sensitive)
values
  ('business_name', '"Esthetic Diamonds & Spa"', 'Nom public de l’établissement.', false),
  ('business_phone', '"09 74 56 43 36"', 'Téléphone public.', false),
  ('business_address', '"Hôtel Saint-Georges, Rue Gratien Parize, 97120 Saint-Claude"', 'Adresse publique.', false),
  ('cancellation_min_hours', '24', 'Délai minimum recommandé pour annulation client.', false),
  ('google_calendar_enabled', 'false', 'Activation future Google Calendar.', false),
  ('whatsapp_enabled', 'false', 'Activation future WhatsApp Business.', false),
  ('stripe_enabled', 'false', 'Activation future paiement Stripe.', false)
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();

-- =========================================================
-- 7. NOTE IMPORTANTE POUR LE PREMIER SUPER ADMIN
-- =========================================================
-- Après avoir créé ton premier utilisateur dans Supabase Auth,
-- récupère son UUID dans Authentication > Users, puis exécute :
--
-- insert into public.user_profiles (user_id, role, first_name, last_name, phone, is_active)
-- values ('COLLER_UUID_ICI', 'super_admin', 'Prénom', 'Nom', '+590...', true)
-- on conflict (user_id) do update set role = 'super_admin', is_active = true;
--
-- =========================================================
-- FIN
-- =========================================================
