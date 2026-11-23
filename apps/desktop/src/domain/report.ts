// Relatório em Markdown no modelo de references/report-template.md da skill:
// o que mudou, o que não mudou e por quê.
import { formatGb, formatPercent, formatSignedGb as signedGb } from './format'
import type { ReportDto } from './models'
import { TIER_LABEL } from './selection'

function signedPoints(points: number): string {
  const rounded = Math.round(points * 10) / 10
  return `${rounded < 0 ? '-' : '+'}${formatPercent(Math.abs(rounded)).replace('%', '')} p.p.`
}

function list(lines: string[]): string[] {
  return lines.length > 0 ? lines : ['- nenhum']
}

export function reportMarkdown(report: ReportDto): string {
  const { initial, last } = report
  return [
    '# Relatório de limpeza',
    '',
    '## 1. Resultado',
    '',
    '| | Inicial | Final | Δ |',
    '|---|---|---|---|',
    `| Livre | ${formatGb(initial.freeBytes)} | ${formatGb(last.freeBytes)} | ${signedGb(report.freedBytes)} |`,
    `| Ocupação | ${formatPercent(initial.usedPercent)} | ${formatPercent(last.usedPercent)} | ${signedPoints(last.usedPercent - initial.usedPercent)} |`,
    '',
    '## 2. Por tier',
    '',
    '| Tier | Liberado | Previsto |',
    '|---|---|---|',
    ...report.runs.map(
      (r) => `| ${r.tier} — ${TIER_LABEL[r.tier]} | ${signedGb(r.freedBytes)} | ${formatGb(r.estimatedBytes)} |`,
    ),
    '',
    '## 3. Decisões que divergiram do plano',
    '',
    ...list(report.blocked.map((c) => `- ${c.label} → mantido: ${c.blockedReason}`)),
    '',
    '## 4. Pendências',
    '',
    ...list(report.pending.map((i) => `- ${i.label} (${i.status}): ${i.detail ?? ''}`)),
    '',
    '## 5. Não tocado (deliberado)',
    '',
    ...list(report.exclusions.map((e) => `- \`${e.pattern}\` — ${e.reason}`)),
    '',
  ].join('\n')
}
