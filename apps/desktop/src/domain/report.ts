// Relatório em Markdown no modelo de references/report-template.md da skill:
// o que mudou, o que não mudou e por quê — no idioma da interface.
import type { Locale, Params } from '../i18n/i18n'
import { formatGb, formatNumber, formatPercent, formatSignedGb } from './format'
import type { ReportDto } from './models'

export type Translate = (key: string, params?: Params) => string

export function reportMarkdown(report: ReportDto, t: Translate, locale: Locale): string {
  const intl = locale === 'pt' ? 'pt-BR' : 'en-US'
  const gb = (b: number) => formatGb(b, 1, intl)
  const signed = (b: number) => formatSignedGb(b, 1, intl)
  const percent = (v: number) => formatPercent(v, 1, intl)
  const points = (v: number) => {
    const rounded = Math.round(v * 10) / 10
    return `${rounded < 0 ? '-' : '+'}${formatNumber(Math.abs(rounded), 1, intl)} ${t('markdown.points')}`
  }
  const list = (lines: string[]) => (lines.length > 0 ? lines : [`- ${t('markdown.none')}`])
  const { initial, last } = report
  return [
    `# ${t('markdown.title')}`,
    '',
    `## ${t('markdown.result')}`,
    '',
    `| | ${t('markdown.initial')} | ${t('markdown.final')} | Δ |`,
    '|---|---|---|---|',
    `| ${t('markdown.free')} | ${gb(initial.freeBytes)} | ${gb(last.freeBytes)} | ${signed(report.freedBytes)} |`,
    `| ${t('markdown.occupancy')} | ${percent(initial.usedPercent)} | ${percent(last.usedPercent)} | ${points(last.usedPercent - initial.usedPercent)} |`,
    '',
    `## ${t('markdown.byTier')}`,
    '',
    `| ${t('markdown.tier')} | ${t('markdown.freed')} | ${t('markdown.estimated')} |`,
    '|---|---|---|',
    ...report.runs.map((r) => `| ${r.tier} — ${t(`tier.${r.tier}`)} | ${signed(r.freedBytes)} | ${gb(r.estimatedBytes)} |`),
    '',
    `## ${t('markdown.divergences')}`,
    '',
    ...list(
      report.blocked.map(
        (c) => `- ${c.label[locale]} → ${t('markdown.kept')}: ${c.blocked ? t(`block.${c.blocked.code}`, { value: c.blocked.value }) : ''}`,
      ),
    ),
    '',
    `## ${t('markdown.pending')}`,
    '',
    ...list(
      report.pending.map(
        (i) =>
          `- ${i.label[locale]} (${t(`status.${i.status}`)}): ${i.cause ? t(`cause.${i.cause.code}`, { detail: i.cause.detail ?? '', exitCode: i.cause.exitCode ?? '?' }) : ''}`,
      ),
    ),
    '',
    `## ${t('markdown.untouched')}`,
    '',
    ...list(report.exclusions.map((e) => `- \`${e.pattern}\` — ${e.reason[locale]}`)),
    '',
  ].join('\n')
}
