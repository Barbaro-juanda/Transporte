// Edge Function: el conductor registra una pasajera (crea su usuario de Auth, su perfil y su fila de pasajera).
// Solo el conductor puede llamarla. La pasajera luego entra con su correo + código de verificación.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'No autenticado' }, 401)

  const admin = createClient(url, service)
  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'driver') return json({ error: 'Solo el conductor puede registrar pasajeras' }, 403)

  const body = await req.json().catch(() => ({}))
  const email = String(body.email ?? '').trim().toLowerCase()
  const fullName = String(body.full_name ?? '').trim()
  const fare = Number(body.fare_cop)
  const ida = String(body.ida_time ?? '06:56')
  const regreso = String(body.regreso_time ?? '12:00')

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Correo no válido' }, 400)
  if (!fullName) return json({ error: 'Falta el nombre' }, 400)
  if (!Number.isInteger(fare) || fare < 0) return json({ error: 'Tarifa no válida' }, 400)
  if (!TIME.test(ida) || !TIME.test(regreso)) return json({ error: 'Hora no válida (usa HH:mm)' }, 400)

  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (createError || !created.user) {
    const exists = /already|registered|exists/i.test(createError?.message ?? '')
    return json({ error: exists ? 'Ese correo ya está registrado' : (createError?.message ?? 'No se pudo crear el usuario') }, exists ? 409 : 400)
  }

  const id = created.user.id
  const { error: profileError } = await admin.from('profiles').insert({ id, role: 'passenger', full_name: fullName, email })
  const { error: passengerError } = profileError
    ? { error: profileError }
    : await admin.from('passengers').insert({ id, fare_cop: fare, ida_time: ida, regreso_time: regreso })
  if (profileError || passengerError) {
    await admin.auth.admin.deleteUser(id) // deshace todo si algo falló
    return json({ error: (profileError ?? passengerError)!.message }, 500)
  }
  return json({ id })
})
