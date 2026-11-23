import { describe, expect, it } from 'vitest'
import { barWidth, formatCount, formatDuration, formatGb, formatPercent, GIB } from './format'

describe('format', () => {
  it('formata GB em binário (1024³) com vírgula decimal', () => {
    expect(formatGb(891.4 * GIB)).toBe('891,4 GB')
    expect(formatGb(15.35 * GIB, 2)).toBe('15,35 GB')
    expect(formatGb(0)).toBe('0,0 GB')
  })

  it('formata percentual, contagem e duração', () => {
    expect(formatPercent(93.456)).toBe('93,5%')
    expect(formatPercent(6.5, 0)).toBe('7%')
    expect(formatCount(1284316)).toBe('1.284.316')
    expect(formatDuration(12_345)).toBe('12,3 s')
    expect(formatDuration(222_000)).toBe('3 min 42 s')
    expect(formatDuration(120_000)).toBe('2 min 0 s')
  })

  it('calcula a largura da barra relativa ao maior valor', () => {
    expect(barWidth(50, 200)).toBe('25%')
    expect(barWidth(200, 200)).toBe('100%')
    expect(barWidth(5, 0)).toBe('0%')
    expect(barWidth(300, 200)).toBe('100%')
  })
})
