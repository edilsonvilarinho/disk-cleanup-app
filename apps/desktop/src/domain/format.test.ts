import { describe, expect, it } from 'vitest'
import { barWidth, formatCount, formatDay, formatDuration, formatGb, formatPercent, formatSignedGb, GIB } from './format'

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

  it('respeita o idioma: ponto decimal e separador de milhar do inglês', () => {
    expect(formatGb(891.4 * GIB, 1, 'en-US')).toBe('891.4 GB')
    expect(formatPercent(93.456, 1, 'en-US')).toBe('93.5%')
    expect(formatCount(1284316, 'en-US')).toBe('1,284,316')
    expect(formatDuration(12_345, 'en-US')).toBe('12.3 s')
    expect(formatSignedGb(-GIB, 1, 'en-US')).toBe('-1.0 GB')
  })

  it('formata variação de espaço com sinal', () => {
    expect(formatSignedGb(24.8 * GIB)).toBe('+24,8 GB')
    expect(formatSignedGb(-GIB)).toBe('-1,0 GB')
    expect(formatSignedGb(0)).toBe('+0,0 GB')
  })

  it('calcula a largura da barra relativa ao maior valor', () => {
    expect(barWidth(50, 200)).toBe('25%')
    expect(barWidth(200, 200)).toBe('100%')
    expect(barWidth(5, 0)).toBe('0%')
    expect(barWidth(300, 200)).toBe('100%')
  })
})

describe('formatDay', () => {
  it('data de calendário (AAAA-MM-DD) no dia certo em qualquer fuso, com ano', () => {
    expect(formatDay('2026-11-27', 'pt-BR')).toBe('27 de nov. de 2026')
    expect(formatDay('2026-01-01', 'en-US')).toBe('Jan 1, 2026')
    expect(formatDay('2026-1-1', 'pt-BR')).toBe('2026-1-1')
  })
})
