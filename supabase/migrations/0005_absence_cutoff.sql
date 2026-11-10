-- Plazo para "hoy no voy": una hora fija del MISMO día del viaje (por defecto 5:00 a. m., hora de Bogotá),
-- igual para ida y regreso. Reemplaza la regla anterior de "2 horas antes de la recogida". Editable en Ajustes.

alter table settings add column absence_cutoff time not null default '05:00';

create or replace function private.report_absence(p_uid uuid, p_date date, p_direction text, p_now timestamptz) returns void
language plpgsql as $$
declare
  v trips%rowtype;
begin
  select * into v from trips where passenger_id = p_uid and date = p_date and direction = p_direction;
  if not found then
    raise exception 'no hay viaje programado ese día';
  end if;
  if v.void_reason = 'pasajera' then
    return; -- ya había avisado
  end if;
  if v.status <> 'scheduled' then
    raise exception 'no hay viaje programado ese día';
  end if;
  if p_now > public.pickup_at(v.date, (select absence_cutoff from settings)) then
    raise exception 'plazo vencido: ya no puedes avisar para este viaje';
  end if;
  update trips set status = 'void', void_reason = 'pasajera' where id = v.id;
end $$;

create or replace function private.cancel_absence(p_uid uuid, p_date date, p_direction text, p_now timestamptz) returns void
language plpgsql as $$
declare
  v trips%rowtype;
begin
  select * into v from trips where passenger_id = p_uid and date = p_date and direction = p_direction;
  if not found or v.void_reason is distinct from 'pasajera' then
    raise exception 'no hay un aviso tuyo para cancelar';
  end if;
  if p_now > public.pickup_at(v.date, (select absence_cutoff from settings)) then
    raise exception 'plazo vencido: ya no puedes cambiar este aviso';
  end if;
  update trips set status = 'scheduled', void_reason = null where id = v.id;
end $$;
