import { describe, expect, it } from 'vitest'
import { balanceLabel, formatBogotaDate, formatBogotaTime, formatCop } from './format'

describe('formatCop', () => {
  it('formatea pesos colombianos sin decimales', () => {
    expect(formatCop(12000)).toBe('$12.000')
    expect(formatCop(0)).toBe('$0')
  })

  it('formatea negativos con signo antes del símbolo', () => {
    expect(formatCop(-5000)).toBe('-$5.000')
  })
})

describe('balanceLabel', () => {
  it('muestra "Debes" cuando el saldo es positivo', () => {
    expect(balanceLabel(8000)).toEqual({ text: 'Debes $8.000', tone: 'debt' })
  })

  it('muestra saldo a favor cuando es negativo', () => {
    expect(balanceLabel(-1000)).toEqual({ text: 'Saldo a favor $1.000', tone: 'credit' })
  })

  it('muestra al día cuando es cero', () => {
    expect(balanceLabel(0)).toEqual({ text: 'Estás al día', tone: 'ok' })
  })
})

describe('formato de fecha y hora en Bogotá', () => {
  it('convierte un instante UTC a hora local de Bogotá', () => {
    const d = new Date('2026-11-10T11:56:00Z')
    expect(formatBogotaTime(d)).toMatch(/6:56/)
    expect(formatBogotaDate(d)).toMatch(/10/)
  })
})
