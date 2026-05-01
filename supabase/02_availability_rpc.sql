-- =========================================================
-- Esthetic Diamonds & Spa — Supabase V1.13
-- RPC publique de disponibilités avec ressources physiques
-- À exécuter APRÈS les migrations utiles
-- =========================================================

create or replace function public.get_public_available_slots(
  p_service_id uuid,
  p_employee_id uuid default null,
  p_date date default current_date
)
returns table(slot_time text)
language plpgsql
security definer
set search_path = public
as $$
declare
  svc record;
  hours record;
  candidate timestamp;
  candidate_start timestamptz;
  candidate_end timestamptz;
  duration_total int;
  dow int;
  service_has_resources boolean;
begin
  dow := extract(dow from p_date)::int;

  select s.*, c.slug as category_slug
  into svc
  from public.services s
  join public.service_categories c on c.id = s.category_id
  where s.id = p_service_id
    and s.is_active = true;

  if not found then
    return;
  end if;

  select exists (
    select 1 from public.resource_services rs where rs.service_id = p_service_id
  )
  into service_has_resources;

  select *
  into hours
  from public.business_hours
  where day_of_week = dow;

  if not found or hours.is_closed = true or hours.opening_time is null or hours.closing_time is null then
    return;
  end if;

  duration_total := svc.duration_minutes + coalesce(svc.buffer_after_minutes, 0);

  for candidate in
    select generate_series(
      (p_date + hours.opening_time)::timestamp,
      (p_date + hours.closing_time)::timestamp - make_interval(mins => duration_total),
      interval '30 minutes'
    )
  loop
    candidate_start := candidate at time zone 'America/Guadeloupe';
    candidate_end := candidate_start + make_interval(mins => duration_total);

    -- Fermeture exceptionnelle globale ou ciblée
    if exists (
      select 1
      from public.business_closures bc
      where bc.is_active = true
        and bc.scope in (
          'all',
          case when svc.category_slug = 'aqua-sports' then 'aquasport' else 'esthetic' end
        )
        and tstzrange(bc.start_at, bc.end_at, '[)') && tstzrange(candidate_start, candidate_end, '[)')
    ) then
      continue;
    end if;

    -- Pause globale
    if exists (
      select 1
      from public.business_breaks bb
      where bb.is_active = true
        and bb.day_of_week = dow
        and tsrange((p_date + bb.start_time)::timestamp, (p_date + bb.end_time)::timestamp, '[)')
            && tsrange(candidate, candidate + make_interval(mins => duration_total), '[)')
    ) then
      continue;
    end if;

    -- Ressource obligatoire si la prestation est liée à au moins une ressource
    if service_has_resources and not exists (
      select 1
      from public.resource_services rs
      join public.resources r on r.id = rs.resource_id
      where rs.service_id = p_service_id
        and r.is_active = true
        and r.is_bookable = true
        and r.capacity >= case when svc.service_type = 'collective' then 1 else 1 end
        and not exists (
          select 1
          from public.bookings b
          where b.resource_id = r.id
            and b.status in ('pending', 'confirmed')
            and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(candidate_start, candidate_end, '[)')
        )
        and not exists (
          select 1
          from public.resource_time_off rt
          where rt.resource_id = r.id
            and tstzrange(rt.start_at, rt.end_at, '[)') && tstzrange(candidate_start, candidate_end, '[)')
        )
    ) then
      continue;
    end if;

    if exists (
      select 1
      from public.employee_services es
      join public.employees e on e.id = es.employee_id
      left join public.employee_working_hours ewh
        on ewh.employee_id = e.id
       and ewh.day_of_week = dow
      where es.service_id = p_service_id
        and e.is_active = true
        and e.is_bookable = true
        and (p_employee_id is null or e.id = p_employee_id)

        -- Si l’employé a des horaires spécifiques pour ce jour, ils priment.
        -- Sinon, on utilise les horaires globaux.
        and (
          ewh.id is null
          or (
            ewh.is_closed = false
            and ewh.start_time is not null
            and ewh.end_time is not null
            and candidate::time >= ewh.start_time
            and (candidate + make_interval(mins => duration_total))::time <= ewh.end_time
          )
        )

        and not exists (
          select 1
          from public.bookings b
          where b.employee_id = e.id
            and b.status in ('pending', 'confirmed')
            and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(candidate_start, candidate_end, '[)')
        )
        and not exists (
          select 1
          from public.employee_time_off t
          where t.employee_id = e.id
            and tstzrange(t.start_at, t.end_at, '[)') && tstzrange(candidate_start, candidate_end, '[)')
        )
    ) then
      slot_time := to_char(candidate, 'HH24:MI');
      return next;
    end if;
  end loop;
end;
$$;

grant execute on function public.get_public_available_slots(uuid, uuid, date) to anon, authenticated;
