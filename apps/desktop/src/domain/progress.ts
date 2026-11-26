// Progresso da varredura derivado na interface. O núcleo só informa
// { files, logicalBytes } (sem total nem caminho atual), então não há percentual
// honesto: o que dá para mostrar é tempo decorrido e ritmo (arquivos/s).

export interface ProgressSample {
  /** Instante da amostra (ms). */
  at: number
  files: number
}

/** Acrescenta a amostra e descarta as mais velhas que a janela. */
export function pushSample(samples: readonly ProgressSample[], sample: ProgressSample, windowMs = 10_000): ProgressSample[] {
  return [...samples, sample].filter((s) => sample.at - s.at <= windowMs)
}

/** Ritmos (arquivos/s) entre amostras consecutivas; intervalo nulo vale 0. */
export function rates(samples: readonly ProgressSample[]): number[] {
  return samples.slice(1).map((s, i) => {
    const prev = samples[i]!
    const dt = (s.at - prev.at) / 1000
    return dt > 0 ? Math.max(0, (s.files - prev.files) / dt) : 0
  })
}

/** Ritmo atual: o último intervalo; 0 com menos de duas amostras. */
export function currentRate(samples: readonly ProgressSample[]): number {
  return rates(samples).at(-1) ?? 0
}

/** Caminho SVG de uma série em `w`×`h`, com o máximo da série no topo. */
export function sparkPath(values: readonly number[], w: number, h: number): string {
  if (values.length < 2) return ''
  const max = Math.max(...values) || 1
  return values
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * w).toFixed(1)} ${(h - (v / max) * (h - 2)).toFixed(1)}`)
    .join(' ')
}

/** Tempo decorrido como mm:ss. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
