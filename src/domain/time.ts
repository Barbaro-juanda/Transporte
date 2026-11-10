// Reglas de fechas y plazos. Colombia no usa horario de verano: Bogotá es siempre UTC-5.
// Estas reglas se espejan en SQL (supabase/migrations/0001_schema.sql); el servidor es la autoridad.

export type Direction = 'ida' | 'regreso'
export type TripStatus = 'scheduled' | 'void'
export type Trip = { status: TripStatus; pickup: Date }

/** `date` = 'YYYY-MM-DD', `time` = 'HH:mm' (o 'HH:mm:ss'), ambos en hora de Bogotá. */
export function pickupInstant(date: string, time: string): Date {
  const hhmm = time.length >= 5 ? time.slice(0, 5) : time
  return new Date(`${date}T${hhmm}:00-05:00`)
}

/** Límite para avisar "hoy no voy": una hora fija (`cutoff`, 'HH:mm') del MISMO día del viaje, en Bogotá. */
export function absenceDeadline(date: string, cutoff: string): Date {
  return pickupInstant(date, cutoff)
}

/** Verdadero si `now` es igual o anterior al límite. */
export function canReportAbsence(now: Date, deadline: Date): boolean {
  return now.getTime() <= deadline.getTime()
}

/** Un viaje se cobra si está programado y ya llegó su hora de recogida. */
export function isChargeable(trip: Trip, now: Date): boolean {
  return trip.status === 'scheduled' && now.getTime() >= trip.pickup.getTime()
}
