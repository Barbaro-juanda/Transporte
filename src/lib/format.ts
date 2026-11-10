const TZ = 'America/Bogota'

/** Pesos colombianos enteros: 12000 → "$12.000", -5000 → "-$5.000". */
export function formatCop(n: number): string {
  const abs = Math.abs(Math.round(n))
  const grouped = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${n < 0 ? '-' : ''}$${grouped}`
}

export type BalanceTone = 'debt' | 'credit' | 'ok'

/** Saldo positivo = la pasajera debe; negativo = saldo a favor. */
export function balanceLabel(balanceCop: number): { text: string; tone: BalanceTone } {
  if (balanceCop > 0) return { text: `Debes ${formatCop(balanceCop)}`, tone: 'debt' }
  if (balanceCop < 0) return { text: `Saldo a favor ${formatCop(-balanceCop)}`, tone: 'credit' }
  return { text: 'Estás al día', tone: 'ok' }
}

export function formatBogotaTime(d: Date): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(d)
}

export function formatBogotaDate(d: Date): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(d)
}

/** 'YYYY-MM-DD' de hoy en Bogotá. */
export function todayBogota(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** 'YYYY-MM-DD' → fecha legible ("lun, 10 nov"). */
export function formatDateString(date: string): string {
  return formatBogotaDate(new Date(`${date}T12:00:00-05:00`))
}
