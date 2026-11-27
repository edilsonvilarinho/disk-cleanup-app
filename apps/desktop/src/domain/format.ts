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

/** Data local curta (`23/11`) ou completa com hora (`23/11/2026 14:48`). */
/** Data de calendário `AAAA-MM-DD` (sem hora): montada no fuso local para não voltar um dia. */
export function formatDay(day: string, locale = DEFAULT_LOCALE): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return day
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export function formatDate(iso: string, withTime = true, locale = DEFAULT_LOCALE): string {
  const options: Intl.DateTimeFormatOptions = withTime
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit' }
  return new Intl.DateTimeFormat(locale, options).format(new Date(iso))
}
