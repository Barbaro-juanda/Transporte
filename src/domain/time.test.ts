import { describe, expect, it } from 'vitest'
import { absenceDeadline, canReportAbsence, isChargeable, pickupInstant } from './time'

describe('pickupInstant', () => {
  it('interpreta la fecha y hora en horario de Bogotá (UTC-5)', () => {
    expect(pickupInstant('2026-11-10', '06:56').toISOString()).toBe('2026-11-10T11:56:00.000Z')
  })
})

describe('plazo para avisar "hoy no voy" (hora fija del mismo día)', () => {
  const deadline = absenceDeadline('2026-11-10', '05:00')

  it('el plazo es las 5:00 a. m. de Bogotá del mismo día', () => {
    expect(deadline.toISOString()).toBe('2026-11-10T10:00:00.000Z')
  })

  it('permite avisar exactamente a las 5:00 a. m.', () => {
    expect(canReportAbsence(new Date('2026-11-10T10:00:00Z'), deadline)).toBe(true)
  })

  it('rechaza avisar un segundo después', () => {
    expect(canReportAbsence(new Date('2026-11-10T10:00:01Z'), deadline)).toBe(false)
  })

  it('permite avisar desde la noche anterior', () => {
    expect(canReportAbsence(new Date('2026-11-10T00:30:00Z'), deadline)).toBe(true)
  })

  it('respeta una hora de corte distinta configurada', () => {
    const late = absenceDeadline('2026-11-10', '06:30')
    expect(canReportAbsence(new Date('2026-11-10T11:30:00Z'), late)).toBe(true)
    expect(canReportAbsence(new Date('2026-11-10T11:30:01Z'), late)).toBe(false)
  })
})

describe('isChargeable', () => {
  const pickup = pickupInstant('2026-11-10', '06:56')

  it('no cobra un viaje anulado', () => {
    expect(isChargeable({ status: 'void', pickup }, new Date('2026-11-10T20:00:00Z'))).toBe(false)
  })

  it('no cobra un viaje programado antes de su hora de recogida', () => {
    expect(isChargeable({ status: 'scheduled', pickup }, new Date('2026-11-10T11:55:59Z'))).toBe(false)
  })

  it('cobra un viaje programado una vez pasa la hora de recogida', () => {
    expect(isChargeable({ status: 'scheduled', pickup }, new Date('2026-11-10T11:56:00Z'))).toBe(true)
  })
})
