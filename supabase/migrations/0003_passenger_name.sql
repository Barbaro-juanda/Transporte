-- La pasajera escribe su propio nombre la primera vez que entra.
-- name_confirmed = false hasta que lo hace; el conductor ya viene confirmado.

alter table profiles add column name_confirmed boolean not null default false;
update profiles set name_confirmed = true where role = 'driver';

create function public.set_my_name(p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'sesión requerida'; end if;
  if length(v_name) < 2 then raise exception 'escribe tu nombre (mínimo 2 letras)'; end if;
  update profiles set full_name = v_name, name_confirmed = true where id = auth.uid();
end $$;

revoke all on function public.set_my_name(text) from public, anon;
grant execute on function public.set_my_name(text) to authenticated, service_role;
