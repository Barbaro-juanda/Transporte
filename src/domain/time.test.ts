import { describe, expect, it } from 'vitest'
import { canReportAbsence, isChargeable, pickupInstant } from './time'

describe('pickupInstant', () => {
  it('interpreta la fecha y hora en horario de Bogotá (UTC-5)', () => {
    expect(pickupInstant('2026-11-10', '06:56').toISOString()).toBe('2026-11-10T11:56:00.000Z')
  })
})

describe('canReportAbsence', () => {
  const pickup = pickupInstant('2026-11-10', '06:56')

  it('permite avisar exactamente 2 horas antes', () => {
    expect(canReportAbsence(new Date('2026-11-10T09:56:00Z'), pickup, 2)).toBe(true)
  })

  it('rechaza avisar un segundo después del límite', () => {
    expect(canReportAbsence(new Date('2026-11-10T09:56:01Z'), pickup, 2)).toBe(false)
  })

  it('rechaza avisar después de la hora de recogida', () => {
    expect(canReportAbsence(new Date('2026-11-10T12:30:00Z'), pickup, 2)).toBe(false)
  })

  it('respeta un plazo configurado distinto de 2 horas', () => {
    expect(canReportAbsence(new Date('2026-11-10T08:56:00Z'), pickup, 3)).toBe(true)
    expect(canReportAbsence(new Date('2026-11-10T08:56:01Z'), pickup, 3)).toBe(false)
  })

  it('permite avisar la noche anterior (límite cruza medianoche en Bogotá)', () => {
    const early = pickupInstant('2026-11-10', '00:30')
    expect(canReportAbsence(new Date('2026-11-10T03:30:00Z'), early, 2)).toBe(true)
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
