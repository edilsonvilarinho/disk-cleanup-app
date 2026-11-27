import { describe, expect, it } from 'vitest'
import { lowSpace, nextScanAt, isDue } from './monitor'

const GB = 1024 ** 3

describe('alerta de pouco espaço', () => {
  it('avisa uma vez ao cruzar o limite e só rearma depois de recuperar 10%', () => {
    let alerted = false
    const step = (freeGb: number) => {
      const r = lowSpace(alerted, freeGb * GB, 15)
      alerted = r.alerted
      return r.alert
    }
    expect(step(20)).toBe(false)
    expect(step(14)).toBe(true)
    expect(step(13)).toBe(false) // já avisou
    expect(step(16)).toBe(false) // acima do limite, mas sem folga de 10%
    expect(alerted).toBe(true)
    expect(step(16.6)).toBe(false) // rearmou
    expect(alerted).toBe(false)
    expect(step(10)).toBe(true)
  })

  it('limite 0 desliga o alerta', () => {
    expect(lowSpace(false, 0, 0)).toEqual({ alert: false, alerted: false })
  })
})

describe('varredura agendada', () => {
  const now = new Date('2026-11-27T12:00:00Z')

  it('calcula a próxima a partir da última; sem varredura anterior, já é hora', () => {
    expect(nextScanAt('off', null, now)).toBeNull()
    expect(nextScanAt('weekly', null, now)).toEqual(now)
    const last = '2026-11-20T09:00:00Z'
    expect(nextScanAt('daily', last, now)!.toISOString()).toBe('2026-11-21T09:00:00.000Z')
    expect(nextScanAt('weekly', last, now)!.toISOString()).toBe('2026-11-27T09:00:00.000Z')
    expect(nextScanAt('monthly', last, now)!.toISOString()).toBe('2026-12-20T09:00:00.000Z')
    expect(nextScanAt('weekly', 'data inválida', now)).toEqual(now)
  })

  it('está na hora quando a próxima já passou', () => {
    expect(isDue(null, now)).toBe(false)
    expect(isDue(new Date('2026-11-27T11:59:59Z'), now)).toBe(true)
    expect(isDue(new Date('2026-11-28T00:00:00Z'), now)).toBe(false)
  })
})
