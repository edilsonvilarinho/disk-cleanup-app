// Cartão-resumo do relatório em SVG puro (sem foreignObject: o WebKit bloqueia
// canvas desenhado a partir dele). Sempre tema claro; fonte do sistema, porque
// SVG usado como imagem não enxerga as webfonts da página. Ver design/README.md.

import type { Locale } from '../i18n/i18n'
import { formatCount, formatDate, formatGb, formatPercent, formatSignedGb } from './format'
import type { ReportDto, Tier } from './models'
import type { Translate } from './report'

export const CARD_WIDTH = 1200
export const CARD_PENDING_LIMIT = 5

const PAD = 56
const GAP = 16
const SANS = "'Segoe UI', system-ui, -apple-system, Roboto, Ubuntu, 'Helvetica Neue', Arial, sans-serif"
const MONO = "'Cascadia Mono', Consolas, 'SF Mono', Menlo, 'DejaVu Sans Mono', monospace"

/** Tokens do tema claro (design/prototypes/assets/app.css). */
const C = {
  bg: '#FFFFFF',
  border: '#E4E4E7',
  text: '#0A0A0A',
  muted: '#5F646D',
  track: '#ECECEE',
  tier: { A: '#0D9488', B: '#7C3AED', C: '#B45309', D: '#DB2777' } as Record<Tier, string>,
}

export interface ReportCardInput {
  report: ReportDto
  t: Translate
  locale: Locale
  generatedAt: Date
  volumeRoot: string
  version: string | null
}

export interface ReportCard {
  svg: string
  width: number
  height: number
}

/** Texto de dado vira texto, nunca marcação. */
export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!)
}

/** Sem medir texto: corta pelo número de caracteres. */
export function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

interface TextOpts {
  size: number
  fill?: string
  weight?: number
  mono?: boolean
  anchor?: 'start' | 'end'
  caps?: boolean
}

function text(x: number, y: number, value: string, o: TextOpts): string {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `font-family="${o.mono ? MONO : SANS}"`,
    `font-size="${o.size}"`,
    `fill="${o.fill ?? C.text}"`,
    o.weight ? `font-weight="${o.weight}"` : '',
    o.anchor === 'end' ? 'text-anchor="end"' : '',
    o.caps ? 'letter-spacing="1.2"' : '',
  ].filter(Boolean)
  return `<text ${attrs.join(' ')}>${escapeXml(o.caps ? value.toUpperCase() : value)}</text>`
}

export function reportCardSvg(input: ReportCardInput): ReportCard {
  const { report, t, locale } = input
  const intl = locale === 'pt' ? 'pt-BR' : 'en-US'
  const gb = (b: number) => formatGb(b, 1, intl)
  const out: string[] = []
  const inner = CARD_WIDTH - PAD * 2
  let y = PAD

  // Cabeçalho
  out.push(text(PAD, y + 14, t('reportCard.eyebrow'), { size: 14, fill: C.muted, weight: 600, caps: true }))
  y += 30
  out.push(text(PAD, y + 34, t('report.title'), { size: 36, weight: 700 }))
  y += 48
  out.push(
    text(PAD, y + 20, `${input.volumeRoot} · ${formatDate(input.generatedAt.toISOString(), true, intl)}`, {
      size: 18,
      fill: C.muted,
    }),
  )
  y += 48

  // KPIs
  const kpiW = (inner - GAP * 3) / 4
  const kpiH = 132
  const kpis: [string, string, string][] = [
    [t('report.freed'), formatSignedGb(report.freedBytes, 1, intl), t('report.estimated', { size: gb(report.estimatedBytes) })],
    [t('report.free'), gb(report.last.freeBytes), t('report.before', { value: gb(report.initial.freeBytes) })],
    [
      t('report.occupancy'),
      formatPercent(report.last.usedPercent, 1, intl),
      t('report.before', { value: formatPercent(report.initial.usedPercent, 1, intl) }),
    ],
    [t('report.pending'), formatCount(report.pending.length, intl), t('report.executed', { n: report.itemCount })],
  ]
  kpis.forEach(([label, value, hint], i) => {
    const x = PAD + i * (kpiW + GAP)
    out.push(`<rect x="${x}" y="${y}" width="${kpiW}" height="${kpiH}" rx="12" fill="${C.bg}" stroke="${C.border}"/>`)
    out.push(text(x + 20, y + 34, label, { size: 16, fill: C.muted }))
    out.push(text(x + 20, y + 80, value, { size: 34, weight: 600, mono: true }))
    out.push(text(x + 20, y + 112, clip(hint, 30), { size: 14, fill: C.muted }))
  })
  y += kpiH + 40

  // Liberado por tier: barra na cor do tier + rótulo + valor (cor nunca sozinha).
  out.push(text(PAD, y + 20, t('report.byTier'), { size: 20, weight: 600 }))
  out.push(text(PAD + inner, y + 20, t('report.measured'), { size: 14, fill: C.muted, anchor: 'end' }))
  y += 40
  const maxFreed = Math.max(0, ...report.runs.map((r) => Math.max(r.freedBytes, r.estimatedBytes)))
  const labelW = 260
  const valueW = 240
  const barX = PAD + labelW
  const barW = inner - labelW - valueW
  for (const run of report.runs) {
    const color = C.tier[run.tier]
    out.push(`<rect x="${PAD}" y="${y + 6}" width="14" height="14" rx="3" fill="${color}"/>`)
    out.push(text(PAD + 24, y + 19, `${run.tier} · ${t(`tier.${run.tier}`)}`, { size: 17, weight: 600 }))
    out.push(`<rect x="${barX}" y="${y + 7}" width="${barW}" height="12" rx="4" fill="${C.track}"/>`)
    const w = maxFreed > 0 ? Math.max(0, (run.freedBytes / maxFreed) * barW) : 0
    if (w > 0) out.push(`<rect x="${barX}" y="${y + 7}" width="${w.toFixed(1)}" height="12" rx="4" fill="${color}"/>`)
    out.push(
      text(PAD + inner, y + 19, `${formatSignedGb(run.freedBytes, 1, intl)} / ${gb(run.estimatedBytes)}`, {
        size: 16,
        mono: true,
        anchor: 'end',
      }),
    )
    y += 36
  }
  y += 24

  // Pendências: só o nome e o status (caminhos longos não cabem num cartão).
  out.push(text(PAD, y + 20, t('report.pending'), { size: 20, weight: 600 }))
  y += 40
  const pending = report.pending.slice(0, CARD_PENDING_LIMIT)
  if (pending.length === 0) {
    out.push(text(PAD, y + 18, t('report.noPending'), { size: 16, fill: C.muted }))
    y += 30
  }
  for (const item of pending) {
    out.push(`<circle cx="${PAD + 5}" cy="${y + 13}" r="4" fill="${C.muted}"/>`)
    out.push(text(PAD + 20, y + 19, clip(item.label[locale], 80), { size: 16 }))
    out.push(text(PAD + inner, y + 19, t(`status.${item.status}`), { size: 15, fill: C.muted, anchor: 'end' }))
    y += 30
  }
  const rest = report.pending.length - pending.length
  if (rest > 0) {
    out.push(text(PAD + 20, y + 19, t('reportCard.more', { n: rest }), { size: 15, fill: C.muted }))
    y += 30
  }
  y += 24

  // Rodapé
  out.push(`<line x1="${PAD}" x2="${PAD + inner}" y1="${y}" y2="${y}" stroke="${C.border}"/>`)
  y += 30
  const version = input.version ? `v${input.version}` : ''
  out.push(text(PAD, y, t('reportCard.footer', { version }).trim(), { size: 14, fill: C.muted }))
  const height = Math.ceil(y + PAD - 16)

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${height}" viewBox="0 0 ${CARD_WIDTH} ${height}">` +
    `<rect width="100%" height="100%" fill="${C.bg}"/>` +
    out.join('') +
    '</svg>'
  return { svg, width: CARD_WIDTH, height }
}

/** `disk-cleanup-relatorio-2026-11-23.png` (data local). */
export function reportCardFileName(prefix: string, at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${prefix}-${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}.png`
}
