// Edge Function: la llama el programador de Supabase (pg_cron) todos los días a las 7:00 p. m. de Bogotá.
// Si el conductor aún no publicó el aviso de mañana, le manda una notificación. Se protege con un secreto compartido.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { addDays, bogotaToday, driverReminder } from '../_shared/messages.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'No autorizado' }, 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const tomorrow = addDays(bogotaToday(), 1)

  const { count, error } = await admin.from('announcements').select('id', { count: 'exact', head: true }).eq('date', tomorrow)
  if (error) return json({ error: error.message }, 500)

  const reminder = driverReminder((count ?? 0) > 0)
  if (!reminder) return json({ sent: 0, reason: 'ya hay aviso para mañana' })

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )
  const { data: drivers } = await admin.from('profiles').select('id').eq('role', 'driver')
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', (drivers ?? []).map((d) => d.id))

  const payload = JSON.stringify({ ...reminder, url: '/conductor' })
  let sent = 0
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
      sent++
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
    }
  }))
  return json({ sent })
})
