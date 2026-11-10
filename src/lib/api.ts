import { supabase } from './supabase'
import type {
  Adjustment, Announcement, AnnouncementKind, PassengerRow, PaymentMethod, Receipt, TripRow,
} from './types'
import type { Direction } from '../domain/time'

function fail(error: { message: string }): never {
  throw new Error(error.message)
}

async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) fail(error)
  return data as T
}

// ───── Configuración ─────

export async function getNoticeHours(): Promise<number> {
  const { data, error } = await supabase.from('settings').select('notice_hours').single()
  if (error) fail(error)
  return data.notice_hours as number
}

export async function setNoticeHours(hours: number) {
  const { error } = await supabase.from('settings').update({ notice_hours: hours }).eq('singleton', true)
  if (error) fail(error)
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const { data, error } = await supabase.from('payment_methods').select('id, label, details').order('created_at')
  if (error) fail(error)
  return data as PaymentMethod[]
}

export async function savePaymentMethod(m: { id?: string; label: string; details: string }) {
  const { error } = m.id
    ? await supabase.from('payment_methods').update({ label: m.label, details: m.details }).eq('id', m.id)
    : await supabase.from('payment_methods').insert({ label: m.label, details: m.details })
  if (error) fail(error)
}

export async function deletePaymentMethod(id: string) {
  const { error } = await supabase.from('payment_methods').delete().eq('id', id)
  if (error) fail(error)
}

// ───── Pasajeras ─────

type RawPassenger = {
  id: string; fare_cop: number; ida_time: string; regreso_time: string; active: boolean
  profiles: { full_name: string; email: string } | { full_name: string; email: string }[] | null
}

function toPassenger(p: RawPassenger, balance: number): PassengerRow {
  const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles
  return {
    id: p.id, fare_cop: p.fare_cop, ida_time: p.ida_time.slice(0, 5), regreso_time: p.regreso_time.slice(0, 5),
    active: p.active, full_name: prof?.full_name ?? '—', email: prof?.email ?? '', balance_cop: balance,
  }
}

export async function listPassengers(): Promise<PassengerRow[]> {
  const [p, b] = await Promise.all([
    supabase.from('passengers').select('id, fare_cop, ida_time, regreso_time, active, profiles(full_name, email)').order('active', { ascending: false }),
    supabase.from('passenger_balance').select('passenger_id, balance_cop'),
  ])
  if (p.error) fail(p.error)
  if (b.error) fail(b.error)
  const balances = new Map((b.data ?? []).map((r) => [r.passenger_id as string, Number(r.balance_cop)]))
  return (p.data as unknown as RawPassenger[])
    .map((row) => toPassenger(row, balances.get(row.id) ?? 0))
    .sort((a, b2) => Number(b2.active) - Number(a.active) || a.full_name.localeCompare(b2.full_name))
}

export async function getPassenger(id: string): Promise<PassengerRow> {
  const all = await listPassengers()
  const found = all.find((p) => p.id === id)
  if (!found) throw new Error('Pasajera no encontrada')
  return found
}

export async function getMyBalance(uid: string): Promise<number> {
  const { data, error } = await supabase.from('passenger_balance').select('balance_cop').eq('passenger_id', uid).maybeSingle()
  if (error) fail(error)
  return Number(data?.balance_cop ?? 0)
}

export async function invitePassenger(input: {
  email: string; full_name: string; fare_cop: number; ida_time: string; regreso_time: string
}) {
  const { data, error } = await supabase.functions.invoke('invite-passenger', { body: input })
  if (error) {
    // supabase-js oculta el cuerpo del error; intentamos leer el mensaje real de la función
    const ctx = (error as { context?: Response }).context
    const detail = ctx ? await ctx.json().catch(() => null) : null
    throw new Error(detail?.error ?? error.message)
  }
  return data as { id: string }
}

export const setFare = (passenger: string, fare: number) => rpc('set_fare', { p_passenger: passenger, p_fare_cop: fare })
export const setPickupTimes = (passenger: string, ida: string, regreso: string) =>
  rpc('set_pickup_times', { p_passenger: passenger, p_ida: ida, p_regreso: regreso })

export async function setPassengerActive(id: string, active: boolean) {
  const { error } = await supabase.from('passengers').update({ active }).eq('id', id)
  if (error) fail(error)
}

// ───── Avisos ─────

type RawAnnouncement = {
  id: string; date: string; kind: AnnouncementKind; note: string | null; created_at: string
  announcement_targets: { passenger_id: string }[]
}

export async function listAnnouncements(opts: { date?: string; from?: string; limit?: number }): Promise<Announcement[]> {
  let q = supabase.from('announcements').select('id, date, kind, note, created_at, announcement_targets(passenger_id)')
  if (opts.date) q = q.eq('date', opts.date)
  if (opts.from) q = q.gte('date', opts.from)
  const { data, error } = await q.order('date', { ascending: false }).order('created_at', { ascending: false }).limit(opts.limit ?? 100)
  if (error) fail(error)
  return (data as unknown as RawAnnouncement[]).map((a) => ({
    id: a.id, date: a.date, kind: a.kind, note: a.note, created_at: a.created_at,
    target_ids: a.announcement_targets.map((t) => t.passenger_id),
  }))
}

export const publishAnnouncement = (date: string, kind: AnnouncementKind, note: string, targets: string[] | null) =>
  rpc<string>('publish_announcement', { p_date: date, p_kind: kind, p_note: note, p_targets: targets })
export const updateAnnouncement = (id: string, kind: AnnouncementKind, note: string) =>
  rpc('update_announcement', { p_id: id, p_kind: kind, p_note: note })
export const deleteAnnouncement = (id: string) => rpc('delete_announcement', { p_id: id })

// ───── Viajes ─────

export async function listTrips(opts: { date?: string; from?: string; to?: string; passengerId?: string }): Promise<TripRow[]> {
  let q = supabase.from('trips').select('id, passenger_id, date, direction, status, fare_cop, pickup_time, void_reason')
  if (opts.date) q = q.eq('date', opts.date)
  if (opts.from) q = q.gte('date', opts.from)
  if (opts.to) q = q.lte('date', opts.to)
  if (opts.passengerId) q = q.eq('passenger_id', opts.passengerId)
  const { data, error } = await q.order('date').order('direction', { ascending: true })
  if (error) fail(error)
  return data as TripRow[]
}

export const reportAbsence = (date: string, direction: Direction) => rpc('report_absence', { p_date: date, p_direction: direction })
export const cancelAbsence = (date: string, direction: Direction) => rpc('cancel_absence', { p_date: date, p_direction: direction })
export const markNoShow = (passenger: string, date: string, direction: Direction) =>
  rpc('mark_no_show', { p_passenger: passenger, p_date: date, p_direction: direction })
export const undoNoShow = (passenger: string, date: string, direction: Direction) =>
  rpc('undo_no_show', { p_passenger: passenger, p_date: date, p_direction: direction })

// ───── Ajustes ─────

export async function listAdjustments(passengerId?: string): Promise<Adjustment[]> {
  let q = supabase.from('adjustments').select('id, passenger_id, amount_cop, reason, created_at')
  if (passengerId) q = q.eq('passenger_id', passengerId)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) fail(error)
  return data as Adjustment[]
}

export const addAdjustment = (passenger: string, amount: number, reason: string) =>
  rpc('add_adjustment', { p_passenger: passenger, p_amount_cop: amount, p_reason: reason })

// ───── Comprobantes ─────

export async function listReceipts(opts: { passengerId?: string; status?: Receipt['status'] } = {}): Promise<Receipt[]> {
  let q = supabase.from('receipts').select('id, passenger_id, amount_cop, image_path, status, reject_reason, duplicate_of, created_at')
  if (opts.passengerId) q = q.eq('passenger_id', opts.passengerId)
  if (opts.status) q = q.eq('status', opts.status)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(100)
  if (error) fail(error)
  return data as Receipt[]
}

async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Sube la captura al almacenamiento privado y registra el comprobante. */
export async function submitReceipt(uid: string, amount: number, file: File): Promise<{ id: string; duplicate: boolean }> {
  const hash = await sha256Hex(file)
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg'
  const path = `${uid}/${Date.now()}.${ext}`
  const up = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type || 'image/jpeg' })
  if (up.error) fail(up.error)
  const id = await rpc<string>('submit_receipt', { p_amount_cop: amount, p_image_path: path, p_image_hash: hash })
  const { data } = await supabase.from('receipts').select('duplicate_of').eq('id', id).single()
  return { id, duplicate: Boolean(data?.duplicate_of) }
}

export const reviewReceipt = (id: string, approve: boolean, amount: number | null, reason: string | null) =>
  rpc('review_receipt', { p_id: id, p_approve: approve, p_amount_cop: amount, p_reason: reason })

export async function receiptImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 300)
  if (error) fail(error)
  return data.signedUrl
}

// ───── Notificaciones push (el servidor decide destinatarios y texto) ─────

export type PushEvent =
  | { event: 'announcement'; id: string; updated?: boolean }
  | { event: 'absence'; date: string; direction: Direction }
  | { event: 'receipt_submitted'; id: string }
  | { event: 'receipt_reviewed'; id: string }

/** Nunca interrumpe la acción principal: si el push falla, el cambio ya quedó guardado. */
export async function notifyPush(payload: PushEvent) {
  try {
    await supabase.functions.invoke('send-push', { body: payload })
  } catch {
    /* sin push no pasa nada grave */
  }
}

export async function savePushSubscription(userId: string, sub: PushSubscriptionJSON) {
  const keys = sub.keys
  if (!sub.endpoint || !keys?.p256dh || !keys.auth) throw new Error('Suscripción incompleta')
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: userId, endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: 'endpoint' })
  if (error) fail(error)
}
