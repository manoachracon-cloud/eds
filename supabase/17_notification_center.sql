-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.16
-- Centre de notifications / journal d’activité
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

alter table public.notifications
add column if not exists event_type text;

alter table public.notifications
add column if not exists severity text not null default 'info';

alter table public.notifications
add column if not exists is_read boolean not null default false;

alter table public.notifications
add column if not exists read_at timestamptz;

alter table public.notifications
add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.notifications
add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_severity_check'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
    add constraint notifications_severity_check
    check (severity in ('info', 'success', 'warning', 'error'))
    not valid;
  end if;

  alter table public.notifications validate constraint notifications_severity_check;
exception when others then
  null;
end $$;

drop trigger if exists trg_notifications_updated_at on public.notifications;
create trigger trg_notifications_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

create index if not exists idx_notifications_status_created_at
on public.notifications(status, created_at desc);

create index if not exists idx_notifications_channel_created_at
on public.notifications(channel, created_at desc);

create index if not exists idx_notifications_is_read_created_at
on public.notifications(is_read, created_at desc);

create index if not exists idx_notifications_severity_created_at
on public.notifications(severity, created_at desc);

create index if not exists idx_notifications_event_type
on public.notifications(event_type);

create index if not exists idx_audit_logs_created_at
on public.audit_logs(created_at desc);

create index if not exists idx_audit_logs_entity
on public.audit_logs(entity_type, entity_id);

create index if not exists idx_audit_logs_action
on public.audit_logs(action);

-- Normalisation de sévérité sur l’existant.
update public.notifications
set severity = case
  when status = 'failed' then 'error'
  when status = 'sent' then 'success'
  when status = 'pending' then 'warning'
  else 'info'
end
where severity = 'info';

-- Fonction générique d’audit.
create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id uuid;
begin
  if tg_op = 'INSERT' then
    v_entity_id := new.id;
    insert into public.audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
    values (auth.uid(), lower(tg_op), tg_table_name, v_entity_id, null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    v_entity_id := new.id;
    insert into public.audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
    values (auth.uid(), lower(tg_op), tg_table_name, v_entity_id, to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    v_entity_id := old.id;
    insert into public.audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
    values (auth.uid(), lower(tg_op), tg_table_name, v_entity_id, to_jsonb(old), null);
    return old;
  end if;

  return null;
end;
$$;

-- Triggers d’audit sur les tables critiques.
drop trigger if exists audit_bookings on public.bookings;
create trigger audit_bookings
after insert or update or delete on public.bookings
for each row execute function public.write_audit_log();

drop trigger if exists audit_services on public.services;
create trigger audit_services
after insert or update or delete on public.services
for each row execute function public.write_audit_log();

drop trigger if exists audit_employees on public.employees;
create trigger audit_employees
after insert or update or delete on public.employees
for each row execute function public.write_audit_log();

drop trigger if exists audit_resources on public.resources;
create trigger audit_resources
after insert or update or delete on public.resources
for each row execute function public.write_audit_log();

drop trigger if exists audit_aquasport_classes on public.aquasport_classes;
create trigger audit_aquasport_classes
after insert or update or delete on public.aquasport_classes
for each row execute function public.write_audit_log();

drop trigger if exists audit_gift_cards on public.gift_cards;
create trigger audit_gift_cards
after insert or update or delete on public.gift_cards
for each row execute function public.write_audit_log();

insert into public.settings (key, value, description, is_sensitive)
values
  ('notification_center_enabled', 'true', 'Activation du centre de notifications admin.', false),
  ('audit_logs_enabled', 'true', 'Activation du journal d’activité admin.', false),
  ('notification_center_retention_days', '180', 'Durée indicative de conservation des notifications.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();
