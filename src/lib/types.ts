import type { Direction, TripStatus } from '../domain/time'

export type Role = 'driver' | 'passenger'
export type AnnouncementKind = 'subo' | 'no_subo' | 'no_bajo'
export type VoidReason = 'conductor' | 'pasajera' | 'no subió'

export type Profile = { id: string; role: Role; full_name: string; email: string }

export type PassengerRow = {
  id: string
  fare_cop: number
  ida_time: string
  regreso_time: string
  active: boolean
  full_name: string
  email: string
  balance_cop: number
}

export type TripRow = {
  id: string
  passenger_id: string
  date: string
  direction: Direction
  status: TripStatus
  fare_cop: number
  pickup_time: string
  void_reason: VoidReason | null
}

export type Announcement = {
  id: string
  date: string
  kind: AnnouncementKind
  note: string | null
  created_at: string
  target_ids: string[] // vacío = todas
}

export type Adjustment = { id: string; passenger_id: string; amount_cop: number; reason: string; created_at: string }

export type Receipt = {
  id: string
  passenger_id: string
  amount_cop: number
  image_path: string
  status: 'pending' | 'confirmed' | 'rejected'
  reject_reason: string | null
  duplicate_of: string | null
  created_at: string
}

export type PaymentMethod = { id: string; label: string; details: string }
