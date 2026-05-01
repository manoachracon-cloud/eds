-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.17
-- Relance / reprise d’erreur
-- À exécuter APRÈS les migrations précédentes
-- =========================================================

alter table public.notifications
add column if not exists retry_count int not null default 0 check (retry_count >= 0);

alter table public.notifications
add column if not exists last_retry_at timestamptz;

alter table public.notifications
add column if not exists resolved_at timestamptz;

alter table public.notifications
add column if not exists resolved_by uuid references auth.users(id) on delete set null;

alter table public.notifications
add column if not exists resolution_note text;

alter table public.notifications
add column if not exists retry_parent_id uuid references public.notifications(id) on delete set null;

alter table public.notifications
add column if not exists can_retry boolean not null default true;

alter table public.notifications
add column if not exists retry_action text;

alter table public.notifications
add column if not exists retry_payload jsonb not null default '{}'::jsonb;

create index if not exists idx_notifications_retry_parent
on public.notifications(retry_parent_id);

create index if not exists idx_notifications_resolved_at
on public.notifications(resolved_at);

create index if not exists idx_notifications_can_retry_status
on public.notifications(can_retry, status, created_at desc);

insert into public.settings (key, value, description, is_sensitive)
values
  ('error_recovery_enabled', 'true', 'Activation du module de relance / reprise d’erreur.', false),
  ('error_recovery_max_retries', '3', 'Nombre maximum de relances automatiques par notification.', false)
on conflict (key) do update set
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();

-- Les notifications échouées existantes deviennent relançables par défaut.
update public.notifications
set can_retry = true
where status = 'failed'
  and can_retry is distinct from true;
