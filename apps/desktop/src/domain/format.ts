// Formatação por idioma (locale do Intl: 'pt-BR' | 'en-US').
// GB = 1024³ (mesma unidade do Explorer e do PowerShell).

export const GIB = 1024 ** 3
const DEFAULT_LOCALE = 'pt-BR'

const fixed = (digits: number, locale: string) =>
  new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })

export function formatNumber(value: number, digits = 1, locale = DEFAULT_LOCALE): string {
  return fixed(digits, locale).format(value)
}

export function formatGb(bytes: number, digits = 1, locale = DEFAULT_LOCALE): string {
  return `${formatNumber(bytes / GIB, digits, locale)} GB`
}

export function formatPercent(value: number, digits = 1, locale = DEFAULT_LOCALE): string {
  return `${formatNumber(value, digits, locale)}%`
}

export function formatCount(value: number, locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale).format(value)
}

export function formatDuration(ms: number, locale = DEFAULT_LOCALE): string {
  const seconds = ms / 1000
  if (seconds < 60) return `${formatNumber(seconds, 1, locale)} s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} min ${Math.round(seconds - minutes * 60)} s`
}

/** Largura CSS de uma barra relativa ao maior valor da série (0–100%). */
export function barWidth(value: number, max: number): string {
  if (max <= 0) return '0%'
  return `${Math.min(100, Math.round((value / max) * 1000) / 10)}%`
}

/** `+24,8 GB` / `-1,0 GB`: variação de espaço livre. */
export function formatSignedGb(bytes: number, digits = 1, locale = DEFAULT_LOCALE): string {
  return `${bytes < 0 ? '-' : '+'}${formatGb(Math.abs(bytes), digits, locale)}`
}
