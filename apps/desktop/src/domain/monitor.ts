// Monitoramento em segundo plano: regras puras (o timer e os avisos ficam na
// apresentação). Nada aqui executa limpeza: só mede e agenda varredura (leitura).

const GIB = 1024 ** 3
/** Folga para rearmar o aviso: evita repetir enquanto o livre oscila no limite. */
const REARM = 1.1

export type ScanSchedule = 'off' | 'daily' | 'weekly' | 'monthly'

/** `alerted`: já avisou neste cruzamento do limite. Limite 0 desliga. */
export function lowSpace(alerted: boolean, freeBytes: number, thresholdGb: number): { alert: boolean; alerted: boolean } {
  if (thresholdGb <= 0) return { alert: false, alerted: false }
  const limit = thresholdGb * GIB
  if (freeBytes < limit) return { alert: !alerted, alerted: true }
  if (freeBytes >= limit * REARM) return { alert: false, alerted: false }
  return { alert: false, alerted }
}

const STEP_DAYS: Record<Exclude<ScanSchedule, 'off'>, number> = { daily: 1, weekly: 7, monthly: 30 }

/** Próxima varredura agendada a partir da última (ISO). Sem anterior válida: agora. */
export function nextScanAt(schedule: ScanSchedule, lastAt: string | null, now: Date): Date | null {
  if (schedule === 'off') return null
  const last = lastAt ? new Date(lastAt) : null
  if (!last || Number.isNaN(last.getTime())) return now
  return new Date(last.getTime() + STEP_DAYS[schedule] * 86_400_000)
}

export function isDue(next: Date | null, now: Date): boolean {
  return next !== null && next.getTime() <= now.getTime()
}
