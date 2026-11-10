// Edge Function: envía notificaciones push. NO confía en el cliente: recibe solo el tipo de evento y un id,
// verifica quién llama y calcula ella misma los destinatarios y el texto.
//
// Eventos:
//   { event: 'announcement', id, updated? }     (solo conductor)  → pasajeras destinatarias
//   { event: 'absence', date, direction }       (pasajera)        → conductor
//   { event: 'receipt_submitted', id }          (pasajera dueña)  → conductor
//   { event: 'receipt_reviewed', id }           (solo conductor)  → pasajera dueña
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const KIND_TEXT: Record<string, string> = {
  subo: 'Sí hay viaje',
  no_subo: 'No puedo subir: no hay viaje de ida',
  no_bajo: 'No puedo bajarlas: no hay viaje de regreso',
}
const cop = (n: number) => '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'No autenticado' }, 401)

  const admin = createClient(url, service)
  const { data: me } = await admin.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle()
  if (!me) return json({ error: 'Sin perfil' }, 403)

  const body = await req.json().catch(() => ({}))
  let recipients: string[] = []
  let title = ''
  let text = ''
  let target = '/'

  if (body.event === 'announcement') {
    if (me.role !== 'driver') return json({ error: 'Solo el conductor' }, 403)
    const { data: a } = await admin.from('announcements').select('id, date, kind, note').eq('id', body.id).maybeSingle()
    if (!a) return json({ error: 'Aviso no encontrado' }, 404)
    const { data: t } = await admin.from('announcement_targets').select('passenger_id').eq('announcement_id', a.id)
    if (t && t.length > 0) {
      recipients = t.map((r) => r.passenger_id)
    } else {
      const { data: all } = await admin.from('passengers').select('id').eq('active', true)
      recipients = (all ?? []).map((r) => r.id)
    }
    title = body.updated ? 'Aviso actualizado' : 'Nuevo aviso de viaje'
    text = `${a.date}: ${KIND_TEXT[a.kind] ?? a.kind}${a.note ? ` · ${a.note}` : ''}`
    target = '/pasajera'
  } else if (body.event === 'absence') {
    const { data: trip } = await admin.from('trips').select('id').eq('passenger_id', user.id)
      .eq('date', body.date).eq('direction', body.direction).eq('void_reason', 'pasajera').maybeSingle()
    if (!trip) return json({ error: 'No hay aviso registrado' }, 404)
    const { data: drivers } = await admin.from('profiles').select('id').eq('role', 'driver')
    recipients = (drivers ?? []).map((r) => r.id)
    title = `${me.full_name} no va`
    text = `${body.direction === 'ida' ? 'Ida' : 'Regreso'} del ${body.date}`
    target = '/conductor'
  } else if (body.event === 'receipt_submitted') {
    const { data: r } = await admin.from('receipts').select('id, amount_cop, passenger_id').eq('id', body.id).maybeSingle()
    if (!r || r.passenger_id !== user.id) return json({ error: 'Comprobante no encontrado' }, 404)
    const { data: drivers } = await admin.from('profiles').select('id').eq('role', 'driver')
    recipients = (drivers ?? []).map((d) => d.id)
    title = 'Nuevo comprobante por revisar'
    text = `${me.full_name} envió ${cop(r.amount_cop)}`
    target = '/conductor/comprobantes'
  } else if (body.event === 'receipt_reviewed') {
    if (me.role !== 'driver') return json({ error: 'Solo el conductor' }, 403)
    const { data: r } = await admin.from('receipts').select('id, status, amount_cop, reject_reason, passenger_id').eq('id', body.id).maybeSingle()
    if (!r || r.status === 'pending') return json({ error: 'Comprobante no revisado' }, 404)
    recipients = [r.passenger_id]
    title = r.status === 'confirmed' ? 'Pago confirmado' : 'Comprobante rechazado'
    text = r.status === 'confirmed' ? `Se confirmó tu pago de ${cop(r.amount_cop)}` : (r.reject_reason ?? 'Revisa tu comprobante')
    target = '/pasajera/pagos'
  } else {
    return json({ error: 'Evento desconocido' }, 400)
  }

  if (recipients.length === 0) return json({ sent: 0 })
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', recipients)
  const payload = JSON.stringify({ title, body: text, url: target })

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
