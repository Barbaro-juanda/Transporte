-- Esquema, reglas de negocio y privacidad (RLS) de la app de transporte.
-- Las reglas de cobro y de plazo viven AQUÍ (no en el celular): el servidor es la autoridad.
-- Convención: saldo positivo = la pasajera debe; negativo = saldo a favor. Todo en COP enteros.

create schema if not exists private;

-- ───────────────────────── Tablas ─────────────────────────

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('driver', 'passenger')),
  full_name text not null,
  email text not null unique
);

create table passengers (
  id uuid primary key references profiles(id) on delete cascade,
  fare_cop integer not null default 0 check (fare_cop >= 0),
  ida_time time not null default '06:56',
  regreso_time time not null default '12:00',
  active boolean not null default true
);

create table settings (
  singleton boolean primary key default true check (singleton),
  notice_hours integer not null default 2 check (notice_hours >= 0)
);
insert into settings default values;

create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  details text not null,
  created_at timestamptz not null default now()
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  kind text not null check (kind in ('subo', 'no_subo', 'no_bajo')),
  note text,
  created_at timestamptz not null default clock_timestamp()
);
create index announcements_date_idx on announcements(date);

-- Sin filas = el aviso es para todas las pasajeras activas.
create table announcement_targets (
  announcement_id uuid not null references announcements(id) on delete cascade,
  passenger_id uuid not null references passengers(id) on delete cascade,
  primary key (announcement_id, passenger_id)
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references passengers(id) on delete cascade,
  date date not null,
  direction text not null check (direction in ('ida', 'regreso')),
  status text not null default 'scheduled' check (status in ('scheduled', 'void')),
  fare_cop integer not null check (fare_cop >= 0),
  pickup_time time not null,
  void_reason text check (void_reason in ('conductor', 'pasajera', 'no subió')),
  unique (passenger_id, date, direction),
  check ((status = 'void') = (void_reason is not null))
);

create table adjustments (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references passengers(id) on delete cascade,
  amount_cop integer not null check (amount_cop <> 0),
  reason text not null check (length(trim(reason)) > 0),
  created_at timestamptz not null default now()
);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references passengers(id) on delete cascade,
  amount_cop integer not null check (amount_cop > 0),
  image_path text not null,
  image_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  reject_reason text,
  duplicate_of uuid references receipts(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Ayudantes ─────────────────────────

create function public.is_driver() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'driver')
$$;

-- Instante exacto de recogida (fecha + hora en horario de Bogotá).
create function public.pickup_at(p_date date, p_time time) returns timestamptz
language sql stable as $$
  select (p_date + p_time) at time zone 'America/Bogota'
$$;

create function public.announcement_visible(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_driver()
    or (
      exists (select 1 from passengers where id = auth.uid() and active)
      and (
        not exists (select 1 from announcement_targets where announcement_id = p_id)
        or exists (select 1 from announcement_targets where announcement_id = p_id and passenger_id = auth.uid())
      )
    )
$$;

-- ───────────────────────── Saldo ─────────────────────────
-- Cobrable = viaje programado cuya hora de recogida ya pasó. Los anulados nunca suman.

create view passenger_balance with (security_invoker = true) as
select
  p.id as passenger_id,
  coalesce((select sum(t.fare_cop) from trips t
             where t.passenger_id = p.id and t.status = 'scheduled'
               and public.pickup_at(t.date, t.pickup_time) <= now()), 0)
  + coalesce((select sum(a.amount_cop) from adjustments a where a.passenger_id = p.id), 0)
  - coalesce((select sum(r.amount_cop) from receipts r where r.passenger_id = p.id and r.status = 'confirmed'), 0)
  as balance_cop
from passengers p;

-- ───────────────────────── Lógica interna (schema private) ─────────────────────────

-- Recalcula los viajes de un día repitiendo, en orden, todos los avisos de esa fecha.
-- Conserva lo que decidió la pasajera ("pasajera") o el conductor ("no subió"),
-- y no toca los viajes cuya hora de recogida ya pasó (conservan su tarifa).
create function private.rebuild_day(p_date date, p_now timestamptz) returns void
language plpgsql as $$
declare
  a record;
  v_pid uuid;
  v_dir text;
begin
  delete from trips
   where date = p_date
     and (void_reason is null or void_reason = 'conductor')
     and public.pickup_at(date, pickup_time) > p_now;

  for a in select * from announcements where date = p_date order by created_at, id loop
    for v_pid in
      select p.id from passengers p
       where p.active
         and (
           not exists (select 1 from announcement_targets x where x.announcement_id = a.id)
           or exists (select 1 from announcement_targets x where x.announcement_id = a.id and x.passenger_id = p.id)
         )
    loop
      foreach v_dir in array (case a.kind
                                when 'subo' then array['ida', 'regreso']
                                when 'no_subo' then array['ida']
                                else array['regreso']
                              end) loop
        insert into trips(passenger_id, date, direction, status, void_reason, fare_cop, pickup_time)
        select p.id, p_date, v_dir,
               case when a.kind = 'subo' then 'scheduled' else 'void' end,
               case when a.kind = 'subo' then null else 'conductor' end,
               p.fare_cop,
               case v_dir when 'ida' then p.ida_time else p.regreso_time end
          from passengers p where p.id = v_pid
        on conflict (passenger_id, date, direction) do update
          set status = excluded.status, void_reason = excluded.void_reason
          where trips.void_reason is null or trips.void_reason = 'conductor';
      end loop;
    end loop;
  end loop;
end $$;

create function private.report_absence(p_uid uuid, p_date date, p_direction text, p_now timestamptz) returns void
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
  if p_now > public.pickup_at(v.date, v.pickup_time) - make_interval(hours => (select notice_hours from settings)) then
    raise exception 'plazo vencido: ya no puedes avisar para este viaje';
  end if;
  update trips set status = 'void', void_reason = 'pasajera' where id = v.id;
end $$;

create function private.cancel_absence(p_uid uuid, p_date date, p_direction text, p_now timestamptz) returns void
language plpgsql as $$
declare
  v trips%rowtype;
begin
  select * into v from trips where passenger_id = p_uid and date = p_date and direction = p_direction;
  if not found or v.void_reason is distinct from 'pasajera' then
    raise exception 'no hay un aviso tuyo para cancelar';
  end if;
  if p_now > public.pickup_at(v.date, v.pickup_time) - make_interval(hours => (select notice_hours from settings)) then
    raise exception 'plazo vencido: ya no puedes cambiar este aviso';
  end if;
  update trips set status = 'scheduled', void_reason = null where id = v.id;
end $$;

-- ───────────────────────── Funciones públicas (RPC) ─────────────────────────

create function public.publish_announcement(p_date date, p_kind text, p_note text, p_targets uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_driver() then raise exception 'Solo el conductor puede publicar avisos'; end if;
  insert into announcements(date, kind, note) values (p_date, p_kind, nullif(trim(p_note), '')) returning id into v_id;
  if p_targets is not null and coalesce(array_length(p_targets, 1), 0) > 0 then
    insert into announcement_targets(announcement_id, passenger_id) select v_id, unnest(p_targets);
  end if;
  perform private.rebuild_day(p_date, now());
  return v_id;
end $$;

create function public.update_announcement(p_id uuid, p_kind text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_date date;
begin
  if not is_driver() then raise exception 'Solo el conductor puede editar avisos'; end if;
  update announcements set kind = p_kind, note = nullif(trim(p_note), '') where id = p_id returning date into v_date;
  if v_date is null then raise exception 'el aviso no existe'; end if;
  perform private.rebuild_day(v_date, now());
end $$;

create function public.delete_announcement(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_date date;
begin
  if not is_driver() then raise exception 'Solo el conductor puede borrar avisos'; end if;
  delete from announcements where id = p_id returning date into v_date;
  if v_date is not null then perform private.rebuild_day(v_date, now()); end if;
end $$;

create function public.report_absence(p_date date, p_direction text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sesión requerida'; end if;
  perform private.report_absence(auth.uid(), p_date, p_direction, now());
end $$;

create function public.cancel_absence(p_date date, p_direction text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sesión requerida'; end if;
  perform private.cancel_absence(auth.uid(), p_date, p_direction, now());
end $$;

create function public.mark_no_show(p_passenger uuid, p_date date, p_direction text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_driver() then raise exception 'Solo el conductor puede marcar "no subió"'; end if;
  update trips set status = 'void', void_reason = 'no subió'
   where passenger_id = p_passenger and date = p_date and direction = p_direction;
  if not found then raise exception 'no hay viaje programado ese día'; end if;
end $$;

create function public.undo_no_show(p_passenger uuid, p_date date, p_direction text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_driver() then raise exception 'Solo el conductor puede deshacer "no subió"'; end if;
  update trips set status = 'scheduled', void_reason = null
   where passenger_id = p_passenger and date = p_date and direction = p_direction and void_reason = 'no subió';
end $$;

-- Cambia la tarifa de una pasajera: solo afecta viajes con recogida futura.
create function public.set_fare(p_passenger uuid, p_fare_cop integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_driver() then raise exception 'Solo el conductor puede cambiar tarifas'; end if;
  if p_fare_cop < 0 then raise exception 'la tarifa no puede ser negativa'; end if;
  update passengers set fare_cop = p_fare_cop where id = p_passenger;
  update trips set fare_cop = p_fare_cop
   where passenger_id = p_passenger and public.pickup_at(date, pickup_time) > now();
end $$;

create function public.set_pickup_times(p_passenger uuid, p_ida time, p_regreso time)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_driver() then raise exception 'Solo el conductor puede cambiar horas'; end if;
  update passengers set ida_time = p_ida, regreso_time = p_regreso where id = p_passenger;
  update trips set pickup_time = case direction when 'ida' then p_ida else p_regreso end
   where passenger_id = p_passenger and public.pickup_at(date, pickup_time) > now();
end $$;

create function public.add_adjustment(p_passenger uuid, p_amount_cop integer, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_driver() then raise exception 'Solo el conductor puede hacer ajustes'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'el motivo es obligatorio'; end if;
  if p_amount_cop = 0 then raise exception 'el monto no puede ser cero'; end if;
  insert into adjustments(passenger_id, amount_cop, reason) values (p_passenger, p_amount_cop, trim(p_reason))
    returning id into v_id;
  return v_id;
end $$;

create function public.submit_receipt(p_amount_cop integer, p_image_path text, p_image_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_dup uuid;
begin
  if not exists (select 1 from passengers where id = auth.uid() and active) then
    raise exception 'solo una pasajera activa puede enviar comprobantes';
  end if;
  if p_amount_cop is null or p_amount_cop <= 0 then raise exception 'el monto debe ser mayor que cero'; end if;
  select id into v_dup from receipts where passenger_id = auth.uid() and image_hash = p_image_hash order by created_at limit 1;
  insert into receipts(passenger_id, amount_cop, image_path, image_hash, duplicate_of)
    values (auth.uid(), p_amount_cop, p_image_path, p_image_hash, v_dup) returning id into v_id;
  return v_id;
end $$;

-- Idempotente: revisar un comprobante que ya no está pendiente no cambia nada.
create function public.review_receipt(p_id uuid, p_approve boolean, p_amount_cop integer, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v receipts%rowtype;
begin
  if not is_driver() then raise exception 'Solo el conductor puede revisar comprobantes'; end if;
  select * into v from receipts where id = p_id for update;
  if not found then raise exception 'el comprobante no existe'; end if;
  if v.status <> 'pending' then return; end if;
  if p_approve then
    update receipts set status = 'confirmed', amount_cop = coalesce(p_amount_cop, amount_cop), reviewed_at = now() where id = p_id;
  else
    if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'el motivo es obligatorio'; end if;
    update receipts set status = 'rejected', reject_reason = trim(p_reason), reviewed_at = now() where id = p_id;
  end if;
end $$;

-- ───────────────────────── Privacidad (RLS) ─────────────────────────
-- Cada pasajera ve solo lo suyo. Las escrituras de negocio pasan por las funciones de arriba.

alter table profiles enable row level security;
alter table passengers enable row level security;
alter table settings enable row level security;
alter table payment_methods enable row level security;
alter table announcements enable row level security;
alter table announcement_targets enable row level security;
alter table trips enable row level security;
alter table adjustments enable row level security;
alter table receipts enable row level security;
alter table push_subscriptions enable row level security;

create policy profiles_select on profiles for select to authenticated using (id = auth.uid() or is_driver());
create policy passengers_select on passengers for select to authenticated using (id = auth.uid() or is_driver());
create policy passengers_driver_write on passengers for all to authenticated using (is_driver()) with check (is_driver());
create policy settings_select on settings for select to authenticated using (true);
create policy settings_driver_update on settings for update to authenticated using (is_driver()) with check (is_driver());
create policy payment_methods_select on payment_methods for select to authenticated using (true);
create policy payment_methods_driver_write on payment_methods for all to authenticated using (is_driver()) with check (is_driver());
create policy announcements_select on announcements for select to authenticated using (announcement_visible(id));
create policy announcement_targets_select on announcement_targets for select to authenticated using (is_driver() or passenger_id = auth.uid());
create policy trips_select on trips for select to authenticated using (passenger_id = auth.uid() or is_driver());
create policy adjustments_select on adjustments for select to authenticated using (passenger_id = auth.uid() or is_driver());
create policy receipts_select on receipts for select to authenticated using (passenger_id = auth.uid() or is_driver());
create policy push_subscriptions_own on push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Los anónimos no ejecutan nada; las funciones internas (schema private) no se exponen por la API.
revoke all on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
