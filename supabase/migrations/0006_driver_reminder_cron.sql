-- Recordatorio al conductor todos los días a las 7:00 p. m. de Bogotá (00:00 UTC): si falta el aviso de mañana,
-- la función remind-driver le manda una notificación.
-- Antes de ejecutar: reemplaza __CRON_SECRET__ por el mismo valor del secreto CRON_SECRET de las funciones.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('remind-driver') where exists (select 1 from cron.job where jobname = 'remind-driver');

select cron.schedule(
  'remind-driver',
  '0 0 * * *',
  $$
  select net.http_post(
    url := 'https://bkvhwchydzsnulyotsqz.supabase.co/functions/v1/remind-driver',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '__CRON_SECRET__'),
    body := '{}'::jsonb
  );
  $$
);
