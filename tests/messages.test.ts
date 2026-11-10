import { describe, expect, it } from 'vitest'
import { announcementText, bogotaToday, dayWord, driverReminder } from '../supabase/functions/_shared/messages'

describe('bogotaToday', () => {
  it('usa la fecha de Bogotá, no la de UTC (a las 11 p. m. en Bogotá ya es el día siguiente en UTC)', () => {
    expect(bogotaToday(new Date('2026-11-10T04:30:00Z'))).toBe('2026-11-09')
    expect(bogotaToday(new Date('2026-11-10T05:00:00Z'))).toBe('2026-11-10')
  })
})

describe('dayWord', () => {
  it('dice Hoy y Mañana, y cruza fin de mes y de año', () => {
    expect(dayWord('2026-11-10', '2026-11-10')).toBe('Hoy')
    expect(dayWord('2026-11-11', '2026-11-10')).toBe('Mañana')
    expect(dayWord('2026-12-01', '2026-11-30')).toBe('Mañana')
    expect(dayWord('2027-01-01', '2026-12-31')).toBe('Mañana')
  })

  it('para otras fechas da el día legible', () => {
    expect(dayWord('2026-11-13', '2026-11-10')).toMatch(/13/)
  })
})

describe('announcementText', () => {
  it('anuncia mañana con el tipo de aviso y la nota', () => {
    expect(announcementText({ date: '2026-11-11', kind: 'subo', note: 'Salgo 10 min tarde' }, '2026-11-10'))
      .toBe('Mañana: sí hay viaje · Salgo 10 min tarde')
  })

  it('sin nota no deja separadores sueltos', () => {
    expect(announcementText({ date: '2026-11-11', kind: 'no_subo', note: null }, '2026-11-10'))
      .toBe('Mañana: no hay viaje de ida')
    expect(announcementText({ date: '2026-11-10', kind: 'no_bajo', note: '  ' }, '2026-11-10'))
      .toBe('Hoy: no hay viaje de regreso')
  })
})

describe('driverReminder', () => {
  it('no recuerda nada si ya hay un aviso para mañana', () => {
    expect(driverReminder(true)).toBeNull()
  })

  it('recuerda publicar el aviso de mañana si falta', () => {
    expect(driverReminder(false)).toEqual({
      title: 'Falta el aviso de mañana',
      body: 'Publica si mañana subes o no, para que las pasajeras lo vean.',
    })
  })
})
