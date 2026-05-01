-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.20
-- Sécurité & permissions avancées
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

-- Rôle courant : on tient maintenant compte de is_active.
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
    and is_active = true
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

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.user_role not null,
  section text not null,
  can_read boolean not null default true,
  can_write boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role, section)
);

drop trigger if exists trg_role_permissions_updated_at on public.role_permissions;
create trigger trg_role_permissions_updated_at
before update on public.role_permissions
for each row execute function public.set_updated_at();

alter table public.role_permissions enable row level security;

drop policy if exists "Staff reads role permissions" on public.role_permissions;
create policy "Staff reads role permissions"
on public.role_permissions
for select
to authenticated
using (public.is_staff());

drop policy if exists "Super admins manage role permissions" on public.role_permissions;
create policy "Super admins manage role permissions"
on public.role_permissions
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (severity in ('info', 'success', 'warning', 'error'))
);

create index if not exists idx_security_events_user_created_at
on public.security_events(user_id, created_at desc);

create index if not exists idx_security_events_type_created_at
on public.security_events(event_type, created_at desc);

alter table public.security_events enable row level security;

drop policy if exists "Admins read security events" on public.security_events;
create policy "Admins read security events"
on public.security_events
for select
to authenticated
using (public.is_admin());

drop policy if exists "Super admins manage security events" on public.security_events;
create policy "Super admins manage security events"
on public.security_events
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

insert into public.role_permissions (role, section, can_read, can_write, can_delete)
values
  ('super_admin','dashboard',true,true,true),
  ('super_admin','planning',true,true,true),
  ('super_admin','bookings',true,true,true),
  ('super_admin','requests',true,true,true),
  ('super_admin','services',true,true,true),
  ('super_admin','employees',true,true,true),
  ('super_admin','resources',true,true,true),
  ('super_admin','aquasport',true,true,true),
  ('super_admin','hours',true,true,true),
  ('super_admin','clients',true,true,true),
  ('super_admin','gift_cards',true,true,true),
  ('super_admin','analytics',true,true,true),
  ('super_admin','notifications',true,true,true),
  ('super_admin','system',true,true,true),
  ('super_admin','security',true,true,true),
  ('super_admin','settings',true,true,true),

  ('admin','dashboard',true,true,false),
  ('admin','planning',true,true,false),
  ('admin','bookings',true,true,false),
  ('admin','requests',true,true,false),
  ('admin','services',true,true,false),
  ('admin','employees',true,true,false),
  ('admin','resources',true,true,false),
  ('admin','aquasport',true,true,false),
  ('admin','hours',true,true,false),
  ('admin','clients',true,true,false),
  ('admin','gift_cards',true,true,false),
  ('admin','analytics',true,false,false),
  ('admin','notifications',true,true,false),
  ('admin','system',true,false,false),
  ('admin','settings',true,true,false),

  ('reception','dashboard',true,false,false),
  ('reception','planning',true,true,false),
  ('reception','bookings',true,true,false),
  ('reception','requests',true,true,false),
  ('reception','clients',true,true,false),
  ('reception','gift_cards',true,false,false),
  ('reception','notifications',true,true,false),

  ('employee_esthetic','dashboard',true,false,false),
  ('employee_esthetic','planning',true,false,false),
  ('employee_esthetic','bookings',true,true,false),
  ('employee_esthetic','clients',true,false,false),

  ('coach_aquasport','dashboard',true,false,false),
  ('coach_aquasport','planning',true,false,false),
  ('coach_aquasport','aquasport',true,true,false),
  ('coach_aquasport','clients',true,false,false)
on conflict (role, section) do update set
  can_read = excluded.can_read,
  can_write = excluded.can_write,
  can_delete = excluded.can_delete,
  updated_at = now();

insert into public.settings (key, value, description, is_sensitive)
values
  ('security_permissions_enabled', 'true', 'Activation des permissions avancées.', false),
  ('admin_access_enabled', 'true', 'Activation de l’accès admin.', false),
  ('api_admin_auth_required', 'true', 'Les routes API admin exigent un token Supabase valide.', false),
  ('security_events_enabled', 'true', 'Activation du journal des événements de sécurité.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();
