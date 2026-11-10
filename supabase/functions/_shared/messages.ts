// Textos de las notificaciones. Sin dependencias de Deno: lo usan las Edge Functions y también las pruebas.

const TZ = 'America/Bogota'
const DAY_MS = 86_400_000

/** 'YYYY-MM-DD' del día actual en Bogotá. */
export function bogotaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** "Hoy", "Mañana" o el día legible ("vie, 13 nov"). */
export function dayWord(date: string, today: string): string {
  if (date === today) return 'Hoy'
  if (date === addDays(today, 1)) return 'Mañana'
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(`${date}T12:00:00Z`),
  )
}

const KIND_TEXT: Record<string, string> = {
  subo: 'sí hay viaje',
  no_subo: 'no hay viaje de ida',
  no_bajo: 'no hay viaje de regreso',
}

export function announcementText(a: { date: string; kind: string; note: string | null }, today: string): string {
  const note = (a.note ?? '').trim()
  return `${dayWord(a.date, today)}: ${KIND_TEXT[a.kind] ?? a.kind}${note ? ` · ${note}` : ''}`
}

/** Recordatorio para el conductor a las 7 p. m.; null si ya publicó el aviso de mañana. */
export function driverReminder(hasAnnouncementTomorrow: boolean): { title: string; body: string } | null {
  if (hasAnnouncementTomorrow) return null
  return {
    title: 'Falta el aviso de mañana',
    body: 'Publica si mañana subes o no, para que las pasajeras lo vean.',
  }
}
