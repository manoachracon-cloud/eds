-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.11
-- Gestion complète des employés
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

create table if not exists public.employee_working_hours (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0 = dimanche
  start_time time,
  end_time time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, day_of_week),
  check (
    is_closed = true
    or (
      start_time is not null
      and end_time is not null
      and end_time > start_time
    )
  )
);

drop trigger if exists trg_employee_working_hours_updated_at on public.employee_working_hours;
create trigger trg_employee_working_hours_updated_at
before update on public.employee_working_hours
for each row execute function public.set_updated_at();

create index if not exists idx_employee_working_hours_employee_id
on public.employee_working_hours(employee_id);

create index if not exists idx_employee_time_off_employee_id_start
on public.employee_time_off(employee_id, start_at);

alter table public.employee_working_hours enable row level security;

drop policy if exists "Staff reads employee working hours" on public.employee_working_hours;
create policy "Staff reads employee working hours"
on public.employee_working_hours
for select
to authenticated
using (public.is_staff());

drop policy if exists "Admins manage employee working hours" on public.employee_working_hours;
create policy "Admins manage employee working hours"
on public.employee_working_hours
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Lecture publique limitée utile pour afficher les disponibilités générales si besoin.
drop policy if exists "Public reads active employee working hours" on public.employee_working_hours;
create policy "Public reads active employee working hours"
on public.employee_working_hours
for select
to anon
using (
  exists (
    select 1
    from public.employees e
    where e.id = employee_working_hours.employee_id
      and e.is_active = true
      and e.is_bookable = true
  )
);

insert into public.settings (key, value, description, is_sensitive)
values
  ('employees_admin_enabled', 'true', 'Activation de la gestion complète des employés dans l’admin.', false),
  ('employee_working_hours_enabled', 'true', 'Activation des horaires hebdomadaires par employé.', false),
  ('employee_time_off_enabled', 'true', 'Activation des congés et indisponibilités par employé.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();
