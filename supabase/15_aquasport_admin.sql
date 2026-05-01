-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.14
-- Aqua-sports avancé : cours, participants, liste d’attente
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

alter table public.aquasport_classes
add column if not exists resource_id uuid references public.resources(id) on delete set null;

alter table public.aquasport_classes
add column if not exists registered_count int not null default 0 check (registered_count >= 0);

alter table public.aquasport_classes
add column if not exists waitlist_count int not null default 0 check (waitlist_count >= 0);

alter table public.aquasport_classes
add column if not exists registration_closes_at timestamptz;

alter table public.aquasport_classes
add column if not exists cancellation_reason text;

alter table public.aquasport_classes
add column if not exists internal_note text;

create index if not exists idx_aquasport_classes_service_start
on public.aquasport_classes(service_id, start_at);

create index if not exists idx_aquasport_classes_status_start
on public.aquasport_classes(status, start_at);

create index if not exists idx_aquasport_classes_resource_start
on public.aquasport_classes(resource_id, start_at);

do $$ begin
  create type public.waitlist_status as enum (
    'waiting',
    'contacted',
    'converted',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.aquasport_waitlist (
  id uuid primary key default gen_random_uuid(),
  aquasport_class_id uuid not null references public.aquasport_classes(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  desired_level text,
  health_notes text,
  message text,
  status public.waitlist_status not null default 'waiting',
  contacted_at timestamptz,
  converted_booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (aquasport_class_id, client_id)
);

drop trigger if exists trg_aquasport_waitlist_updated_at on public.aquasport_waitlist;
create trigger trg_aquasport_waitlist_updated_at
before update on public.aquasport_waitlist
for each row execute function public.set_updated_at();

create index if not exists idx_aquasport_waitlist_class_status
on public.aquasport_waitlist(aquasport_class_id, status);

create index if not exists idx_aquasport_waitlist_client
on public.aquasport_waitlist(client_id);

alter table public.aquasport_waitlist enable row level security;

drop policy if exists "Staff reads aquasport waitlist" on public.aquasport_waitlist;
create policy "Staff reads aquasport waitlist"
on public.aquasport_waitlist
for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff manages aquasport waitlist" on public.aquasport_waitlist;
create policy "Staff manages aquasport waitlist"
on public.aquasport_waitlist
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

-- Les clients rejoignent la liste d’attente via route serveur service_role.
-- Pas d’INSERT public direct nécessaire.

create or replace function public.sync_aquasport_class_counts(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registered int;
  v_waiting int;
  v_capacity int;
begin
  select count(*)
  into v_registered
  from public.aquasport_participants
  where aquasport_class_id = p_class_id
    and attendance_status in ('registered', 'present');

  select count(*)
  into v_waiting
  from public.aquasport_waitlist
  where aquasport_class_id = p_class_id
    and status = 'waiting';

  select capacity_max
  into v_capacity
  from public.aquasport_classes
  where id = p_class_id;

  update public.aquasport_classes
  set
    registered_count = coalesce(v_registered, 0),
    waitlist_count = coalesce(v_waiting, 0),
    status = case
      when status = 'cancelled' then 'cancelled'::public.class_status
      when status = 'done' then 'done'::public.class_status
      when coalesce(v_registered, 0) >= v_capacity then 'full'::public.class_status
      when status = 'closed' then 'closed'::public.class_status
      else 'open'::public.class_status
    end
  where id = p_class_id;
end;
$$;

insert into public.settings (key, value, description, is_sensitive)
values
  ('aquasport_admin_enabled', 'true', 'Activation de la gestion Aqua-sports avancée.', false),
  ('aquasport_waitlist_enabled', 'true', 'Activation de la liste d’attente Aqua-sports.', false),
  ('aquasport_attendance_enabled', 'true', 'Activation du suivi des présences Aqua-sports.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();
