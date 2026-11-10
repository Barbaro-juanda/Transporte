import type { ReactNode } from 'react'
import { formatBogotaTime } from '../lib/format'
import { Skeleton } from './Motion'
import { pickupInstant, type Direction } from '../domain/time'
import type { AnnouncementKind, TripRow } from '../lib/types'

export const DIR_LABEL: Record<Direction, string> = { ida: 'Ida', regreso: 'Regreso' }

export const KIND_LABEL: Record<AnnouncementKind, string> = {
  subo: 'Subo',
  no_subo: 'No puedo subir',
  no_bajo: 'No puedo bajarlas',
}

export const KIND_HELP: Record<AnnouncementKind, string> = {
  subo: 'Sí hay viaje (ida y regreso)',
  no_subo: 'No hay viaje de ida',
  no_bajo: 'No hay viaje de regreso',
}

export function tripChip(t: Pick<TripRow, 'status' | 'void_reason'>): { text: string; tone: 'ok' | 'warn' | 'bad' } {
  if (t.status === 'scheduled') return { text: 'Programado', tone: 'ok' }
  if (t.void_reason === 'pasajera') return { text: 'No va (avisó)', tone: 'warn' }
  if (t.void_reason === 'no subió') return { text: 'No subió', tone: 'warn' }
  return { text: 'Sin viaje', tone: 'bad' }
}

export const tripTime = (t: Pick<TripRow, 'date' | 'pickup_time'>) => formatBogotaTime(pickupInstant(t.date, t.pickup_time))

export function Chip({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  return <span className={`chip ${tone}`}>{children}</span>
}

export function Loading() {
  return <Skeleton />
}

export function ErrorMsg({ message }: { message?: string | null }) {
  return message ? <p className="error" role="alert">{message}</p> : null
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted center">{children}</p>
}
