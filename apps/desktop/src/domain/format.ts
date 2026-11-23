// Formatação pt-BR. GB = 1024³ (mesma unidade do Explorer e do PowerShell).

export const GIB = 1024 ** 3

const fixed = (digits: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export function formatGb(bytes: number, digits = 1): string {
  return `${fixed(digits).format(bytes / GIB)} GB`
}

export function formatPercent(value: number, digits = 1): string {
  return `${fixed(digits).format(value)}%`
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}

export function formatDuration(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 60) return `${fixed(1).format(seconds)} s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} min ${Math.round(seconds - minutes * 60)} s`
}

/** Largura CSS de uma barra relativa ao maior valor da série (0–100%). */
export function barWidth(value: number, max: number): string {
  if (max <= 0) return '0%'
  return `${Math.min(100, Math.round((value / max) * 1000) / 10)}%`
}

/** `+24,8 GB` / `-1,0 GB`: variação de espaço livre. */
export function formatSignedGb(bytes: number, digits = 1): string {
  return `${bytes < 0 ? '-' : '+'}${formatGb(Math.abs(bytes), digits)}`
}
