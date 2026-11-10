import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

const stub = readFileSync('tests/db/stub.sql', 'utf8')
const migration = readFileSync('supabase/migrations/0001_schema.sql', 'utf8')
const nameMigration = readFileSync('supabase/migrations/0003_passenger_name.sql', 'utf8')
const pushMigration = readFileSync('supabase/migrations/0004_push_subscription.sql', 'utf8')

const D = '00000000-0000-0000-0000-0000000000d1' // conductor
const A = '00000000-0000-0000-0000-0000000000a1' // pasajera Ana, tarifa 4000
const B = '00000000-0000-0000-0000-0000000000b1' // pasajera Bea, tarifa 5000
const FUT = '2099-03-02' // fecha futura: sus viajes aún no son cobrables
const PAST = '2020-03-02' // fecha pasada: sus viajes ya son cobrables

let db: PGlite

async function as(uid: string) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid])
}
async function rows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows
}
async function publish(date: string, kind: string, note: string | null, targets: string[] | null) {
  const r = await rows<{ id: string }>(`select publish_announcement($1::date, $2, $3, $4::uuid[]) as id`, [date, kind, note, targets])
  return r[0].id
}
const trips = (date: string, passenger: string) =>
  rows<{ direction: string; status: string; void_reason: string | null; fare_cop: number; pickup_time: string }>(
    `select direction, status, void_reason, fare_cop, pickup_time::text from trips where date = $1::date and passenger_id = $2 order by direction`,
    [date, passenger],
  )

beforeEach(async () => {
  db = new PGlite()
  await db.exec(stub)
  await db.exec(migration)
  await db.exec(nameMigration)
  await db.exec(pushMigration)
  await db.exec(`
    insert into auth.users(id, email) values ('${D}','d@x.co'), ('${A}','a@x.co'), ('${B}','b@x.co');
    insert into profiles(id, role, full_name, email) values
      ('${D}','driver','Conductor','d@x.co'), ('${A}','passenger','Ana','a@x.co'), ('${B}','passenger','Bea','b@x.co');
    insert into passengers(id, fare_cop) values ('${A}', 4000), ('${B}', 5000);
  `)
})

describe('avisos y viajes', () => {
  it('"Subo" para todas programa ida y regreso con la tarifa y hora de cada pasajera', async () => {
    await as(D)
    await publish(FUT, 'subo', null, null)
    expect(await trips(FUT, A)).toEqual([
      { direction: 'ida', status: 'scheduled', void_reason: null, fare_cop: 4000, pickup_time: '06:56:00' },
      { direction: 'regreso', status: 'scheduled', void_reason: null, fare_cop: 4000, pickup_time: '12:00:00' },
    ])
    expect((await trips(FUT, B))[0].fare_cop).toBe(5000)
  })

  it('un aviso individual "No puedo bajarlas" anula solo el regreso de esa pasajera', async () => {
    await as(D)
    await publish(FUT, 'subo', null, null)
    await publish(FUT, 'no_bajo', 'Tengo reunión', [A])
    const a = await trips(FUT, A)
    expect(a.find((t) => t.direction === 'regreso')).toMatchObject({ status: 'void', void_reason: 'conductor' })
    expect(a.find((t) => t.direction === 'ida')?.status).toBe('scheduled')
    expect((await trips(FUT, B)).every((t) => t.status === 'scheduled')).toBe(true)
  })

  it('editar un aviso recalcula sin duplicar viajes ni perder la ausencia de la pasajera', async () => {
    await as(D)
    const id = await publish(FUT, 'subo', null, null)
    await db.query(`select private.report_absence($1, $2::date, 'ida', $3::timestamptz)`, [B, FUT, '2099-03-01T00:00:00Z'])
    await db.query(`select update_announcement($1::uuid, 'no_subo', 'Carro dañado')`, [id])
    const b = await trips(FUT, B)
    expect(b.filter((t) => t.direction === 'ida')).toEqual([
      { direction: 'ida', status: 'void', void_reason: 'pasajera', fare_cop: 5000, pickup_time: '06:56:00' },
    ])
    const a = await trips(FUT, A)
    expect(a.filter((t) => t.direction === 'ida')).toHaveLength(1)
    expect(a.find((t) => t.direction === 'ida')).toMatchObject({ status: 'void', void_reason: 'conductor' })
  })

  it('solo el conductor puede publicar avisos', async () => {
    await as(A)
    await expect(publish(FUT, 'subo', null, null)).rejects.toThrow(/conductor/)
  })
})

describe('"hoy no voy" y "no subió"', () => {
  beforeEach(async () => {
    await as(D)
    await publish(FUT, 'subo', null, null)
  })
  // La ida de FUT es a las 06:56 Bogotá = 11:56 UTC; el límite con plazo de 2 h son las 09:56 UTC.
  const report = (now: string) =>
    db.query(`select private.report_absence($1, $2::date, 'ida', $3::timestamptz)`, [A, FUT, now])

  it('permite avisar exactamente 2 horas antes', async () => {
    await report('2099-03-02T09:56:00Z')
    expect((await trips(FUT, A))[0]).toMatchObject({ status: 'void', void_reason: 'pasajera' })
  })

  it('rechaza avisar un segundo después del límite', async () => {
    await expect(report('2099-03-02T09:56:01Z')).rejects.toThrow(/plazo vencido/)
    expect((await trips(FUT, A))[0].status).toBe('scheduled')
  })

  it('respeta el plazo configurado en la app', async () => {
    await db.exec(`update settings set notice_hours = 3`)
    await expect(report('2099-03-02T08:56:01Z')).rejects.toThrow(/plazo vencido/)
    await report('2099-03-02T08:56:00Z')
  })

  it('no se puede avisar si no hay viaje ese día', async () => {
    await expect(
      db.query(`select private.report_absence($1, '2099-04-01'::date, 'ida', $2::timestamptz)`, [A, '2099-03-01T00:00:00Z']),
    ).rejects.toThrow(/no hay viaje/)
  })

  it('cancelar el aviso reactiva el viaje, salvo que lo haya anulado el conductor', async () => {
    await report('2099-03-02T09:00:00Z')
    await db.query(`select private.cancel_absence($1, $2::date, 'ida', $3::timestamptz)`, [A, FUT, '2099-03-02T09:30:00Z'])
    expect((await trips(FUT, A))[0].status).toBe('scheduled')

    await as(D)
    await publish(FUT, 'no_subo', null, [A])
    await expect(
      db.query(`select private.cancel_absence($1, $2::date, 'ida', $3::timestamptz)`, [A, FUT, '2099-03-02T09:30:00Z']),
    ).rejects.toThrow()
    expect((await trips(FUT, A))[0].status).toBe('void')
  })

  it('el conductor marca "no subió" aunque haya pasado el plazo, y se puede deshacer', async () => {
    await as(D)
    await db.query(`select mark_no_show($1, $2::date, 'ida')`, [A, FUT])
    expect((await trips(FUT, A))[0]).toMatchObject({ status: 'void', void_reason: 'no subió' })
    await db.query(`select undo_no_show($1, $2::date, 'ida')`, [A, FUT])
    expect((await trips(FUT, A))[0].status).toBe('scheduled')
  })

  it('una pasajera no puede marcar "no subió"', async () => {
    await as(A)
    await expect(db.query(`select mark_no_show($1, $2::date, 'ida')`, [B, FUT])).rejects.toThrow(/conductor/)
  })
})

describe('tarifas y saldo', () => {
  async function pastTrip(passenger: string, fare: number, direction = 'ida', status = 'scheduled') {
    await db.query(
      `insert into trips(passenger_id, date, direction, status, void_reason, fare_cop, pickup_time) values ($1, $2::date, $3, $4, $5, $6, '06:56')`,
      [passenger, PAST, direction, status, status === 'void' ? 'conductor' : null, fare],
    )
  }
  const balance = async (p: string) =>
    (await rows<{ balance_cop: string }>(`select balance_cop::text from passenger_balance where passenger_id = $1`, [p]))[0].balance_cop

  it('cambiar la tarifa solo afecta viajes futuros de esa pasajera', async () => {
    await as(D)
    await pastTrip(A, 4000)
    await publish(FUT, 'subo', null, null)
    await db.query(`select set_fare($1, 6000)`, [A])
    expect((await rows<{ fare_cop: number }>(`select fare_cop from trips where date = $1::date and passenger_id = $2`, [PAST, A]))[0].fare_cop).toBe(4000)
    expect((await trips(FUT, A)).every((t) => t.fare_cop === 6000)).toBe(true)
    expect((await trips(FUT, B)).every((t) => t.fare_cop === 5000)).toBe(true)
    expect((await rows<{ fare_cop: number }>(`select fare_cop from passengers where id = $1`, [A]))[0].fare_cop).toBe(6000)
  })

  it('saldo = viajes cobrables + ajustes − pagos confirmados; negativo es saldo a favor', async () => {
    await as(D)
    await pastTrip(A, 4000, 'ida')
    await pastTrip(A, 4000, 'regreso')
    await db.query(`select add_adjustment($1, 1000, 'Cargo extra peaje')`, [A])
    await as(A)
    const id = (await rows<{ id: string }>(`select submit_receipt(10000, 'A/1.jpg', 'h1') as id`))[0].id
    expect(await balance(A)).toBe('9000') // el comprobante pendiente aún no descuenta
    await as(D)
    await db.query(`select review_receipt($1::uuid, true, null, null)`, [id])
    expect(await balance(A)).toBe('-1000')
  })

  it('los viajes futuros y los anulados no suman al saldo', async () => {
    await as(D)
    await publish(FUT, 'subo', null, null)
    await pastTrip(A, 4000, 'ida', 'void')
    expect(await balance(A)).toBe('0')
  })

  it('un ajuste exige motivo, monto distinto de cero y ser conductor', async () => {
    await as(D)
    await expect(db.query(`select add_adjustment($1, 500, '  ')`, [A])).rejects.toThrow(/motivo/)
    await expect(db.query(`select add_adjustment($1, 0, 'x')`, [A])).rejects.toThrow()
    await as(A)
    await expect(db.query(`select add_adjustment($1, -500, 'Descuento')`, [A])).rejects.toThrow(/conductor/)
  })
})

describe('comprobantes', () => {
  it('marca como repetida una captura con el mismo hash', async () => {
    await as(A)
    const first = (await rows<{ id: string }>(`select submit_receipt(10000, 'A/1.jpg', 'h1') as id`))[0].id
    const second = (await rows<{ id: string }>(`select submit_receipt(10000, 'A/2.jpg', 'h1') as id`))[0].id
    const r = await rows<{ duplicate_of: string | null }>(`select duplicate_of from receipts where id = $1::uuid`, [second])
    expect(r[0].duplicate_of).toBe(first)
  })

  it('confirmar dos veces el mismo comprobante descuenta una sola vez', async () => {
    await db.query(`insert into trips(passenger_id, date, direction, status, fare_cop, pickup_time) values ($1, $2::date, 'ida', 'scheduled', 8000, '06:56')`, [A, PAST])
    await as(A)
    const id = (await rows<{ id: string }>(`select submit_receipt(5000, 'A/1.jpg', 'h1') as id`))[0].id
    await as(D)
    await db.query(`select review_receipt($1::uuid, true, null, null)`, [id])
    await db.query(`select review_receipt($1::uuid, true, null, null)`, [id])
    const b = await rows<{ balance_cop: string }>(`select balance_cop::text from passenger_balance where passenger_id = $1`, [A])
    expect(b[0].balance_cop).toBe('3000')
  })

  it('el conductor puede corregir el monto al confirmar', async () => {
    await as(A)
    const id = (await rows<{ id: string }>(`select submit_receipt(5000, 'A/1.jpg', 'h1') as id`))[0].id
    await as(D)
    await db.query(`select review_receipt($1::uuid, true, 4500, null)`, [id])
    expect((await rows<{ amount_cop: number }>(`select amount_cop from receipts where id = $1::uuid`, [id]))[0].amount_cop).toBe(4500)
  })

  it('rechazar exige un motivo y deja el saldo intacto', async () => {
    await as(A)
    const id = (await rows<{ id: string }>(`select submit_receipt(5000, 'A/1.jpg', 'h1') as id`))[0].id
    await as(D)
    await expect(db.query(`select review_receipt($1::uuid, false, null, '')`, [id])).rejects.toThrow(/motivo/)
    await db.query(`select review_receipt($1::uuid, false, null, 'No aparece la transferencia')`, [id])
    expect((await rows<{ status: string }>(`select status from receipts where id = $1::uuid`, [id]))[0].status).toBe('rejected')
  })

  it('una pasajera no puede revisar comprobantes', async () => {
    await as(A)
    const id = (await rows<{ id: string }>(`select submit_receipt(5000, 'A/1.jpg', 'h1') as id`))[0].id
    await expect(db.query(`select review_receipt($1::uuid, true, null, null)`, [id])).rejects.toThrow(/conductor/)
  })

  it('rechaza montos no positivos', async () => {
    await as(A)
    await expect(db.query(`select submit_receipt(0, 'A/1.jpg', 'h1')`)).rejects.toThrow()
  })
})

describe('nombre de la pasajera al entrar', () => {
  const profile = async (id: string) =>
    (await rows<{ full_name: string; name_confirmed: boolean }>(`select full_name, name_confirmed from profiles where id = $1`, [id]))[0]

  it('una pasajera nueva aparece sin nombre confirmado', async () => {
    expect((await profile(A)).name_confirmed).toBe(false)
  })

  it('la pasajera guarda su nombre (sin espacios sobrantes) y queda confirmado', async () => {
    await as(A)
    await db.query(`select set_my_name('  Ana María  ')`)
    expect(await profile(A)).toEqual({ full_name: 'Ana María', name_confirmed: true })
    expect((await profile(B)).name_confirmed).toBe(false)
  })

  it('rechaza un nombre vacío o de una sola letra', async () => {
    await as(A)
    await expect(db.query(`select set_my_name('   ')`)).rejects.toThrow(/nombre/)
    await expect(db.query(`select set_my_name('A')`)).rejects.toThrow(/nombre/)
  })

  it('sin sesión no se puede cambiar el nombre', async () => {
    await as('')
    await expect(db.query(`select set_my_name('Pepe')`)).rejects.toThrow(/sesión/)
  })
})

describe('suscripciones de notificaciones', () => {
  const owners = () => rows<{ user_id: string }>(`select user_id from push_subscriptions where endpoint = 'https://push/e1'`)

  it('guarda la suscripción de quien la envía', async () => {
    await as(A)
    await db.query(`select save_push_subscription('https://push/e1', 'k1', 'a1')`)
    expect(await owners()).toEqual([{ user_id: A }])
  })

  it('si el mismo celular entra con otro usuario, la suscripción pasa a ese usuario sin error', async () => {
    await as(D)
    await db.query(`select save_push_subscription('https://push/e1', 'k1', 'a1')`)
    await as(A)
    await db.query(`select save_push_subscription('https://push/e1', 'k2', 'a2')`)
    expect(await owners()).toEqual([{ user_id: A }])
  })

  it('sin sesión no se puede guardar', async () => {
    await as('')
    await expect(db.query(`select save_push_subscription('https://push/e1', 'k', 'a')`)).rejects.toThrow(/sesión/)
  })
})

describe('privacidad (RLS)', () => {
  beforeEach(async () => {
    await as(D)
    await publish(FUT, 'subo', null, null)
    await as(B)
    await db.query(`select submit_receipt(7000, 'B/1.jpg', 'hb')`)
    await db.exec(`insert into adjustments(passenger_id, amount_cop, reason) values ('${B}', 100, 'x')`)
    await as(A)
    await db.exec(`set role authenticated`)
  })

  it('una pasajera solo ve sus propios viajes, comprobantes, ajustes y saldo', async () => {
    expect(await rows(`select 1 from trips where passenger_id = $1`, [B])).toHaveLength(0)
    expect(await rows(`select 1 from receipts where passenger_id = $1`, [B])).toHaveLength(0)
    expect(await rows(`select 1 from adjustments where passenger_id = $1`, [B])).toHaveLength(0)
    expect(await rows(`select 1 from passengers where id = $1`, [B])).toHaveLength(0)
    expect(await rows(`select 1 from passenger_balance where passenger_id = $1`, [B])).toHaveLength(0)
    expect((await rows(`select 1 from trips`)).length).toBe(2)
  })

  it('una pasajera no puede modificar tarifas ni escribir viajes directamente', async () => {
    expect(await rows(`update passengers set fare_cop = 1 returning id`)).toHaveLength(0)
    await expect(db.query(`insert into trips(passenger_id, date, direction, fare_cop, pickup_time) values ('${A}', '2099-05-05', 'ida', 1, '06:56')`)).rejects.toThrow()
  })

  it('una pasajera solo ve los avisos dirigidos a ella o a todas', async () => {
    await db.exec(`reset role`)
    await as(D)
    await publish('2099-03-03', 'no_subo', 'Solo Bea', [B])
    await as(A)
    await db.exec(`set role authenticated`)
    const seen = await rows<{ date: string }>(`select date::text from announcements order by date`)
    expect(seen.map((r) => r.date)).toEqual([FUT])
  })
})
