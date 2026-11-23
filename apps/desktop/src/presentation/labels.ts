import type { Risk } from '../domain/models'

const RISK_LABEL: Record<Risk, string> = {
  none: 'nenhum',
  low: 'baixo',
  redownload: 're-download',
  'long-running': 'operação longa',
}

export function riskLabel(risk: Risk): string {
  return RISK_LABEL[risk]
}

/** `C:\` → `C:` (formato do plan.json da skill); `/` permanece. */
export function volumeLabel(root: string): string {
  const trimmed = root.replace(/[\\/]+$/, '')
  return trimmed === '' ? root : trimmed
}
