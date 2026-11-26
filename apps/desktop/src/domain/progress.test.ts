import { describe, expect, it } from 'vitest'
import { clock, currentRate, pushSample, rates, sparkPath } from './progress'

describe('progresso da varredura', () => {
  it('mantém só as amostras da janela', () => {
    let s = pushSample([], { at: 0, files: 0 }, 1000)
    s = pushSample(s, { at: 500, files: 10 }, 1000)
    s = pushSample(s, { at: 1500, files: 30 }, 1000)
    expect(s.map((x) => x.at)).toEqual([500, 1500])
  })

  it('calcula ritmo por intervalo e o atual', () => {
    const s = [{ at: 0, files: 0 }, { at: 500, files: 100 }, { at: 500, files: 100 }, { at: 1500, files: 50 }]
    // intervalo nulo vale 0; queda (contador reiniciado) não vira ritmo negativo.
    expect(rates(s)).toEqual([200, 0, 0])
    expect(currentRate(s.slice(0, 2))).toBe(200)
    expect(currentRate([{ at: 0, files: 9 }])).toBe(0)
  })

  it('gera o caminho do sparkline e o relógio', () => {
    expect(sparkPath([1], 100, 10)).toBe('')
    expect(sparkPath([0, 0], 100, 10)).toBe('M0.0 10.0 L100.0 10.0')
    expect(sparkPath([0, 4], 100, 10)).toBe('M0.0 10.0 L100.0 2.0')
    expect(clock(65_400)).toBe('01:05')
    expect(clock(-5)).toBe('00:00')
  })
})
