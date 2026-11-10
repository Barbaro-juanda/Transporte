-- Guardar la suscripción de notificaciones de este celular/navegador.
-- Si el mismo navegador ya estaba registrado con otro usuario (por ejemplo al probar como conductor y como
-- pasajera en el mismo equipo), la suscripción pasa al usuario actual en vez de fallar por privacidad (RLS).

create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sesión requerida'; end if;
  insert into push_subscriptions(user_id, endpoint, p256dh, auth)
    values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth;
end $$;

revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated, service_role;
