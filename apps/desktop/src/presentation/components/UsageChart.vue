<script setup lang="ts">
// Linha do espaço usado por varredura. Uma série (sem legenda), eixo Y de 0 à
// capacidade, crosshair + tooltip por ponteiro e teclado (←/→). Especificação
// em design/README.md → "Gráfico de linha".
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { GIB } from '../../domain/format'
import { useI18n } from '../i18n'

export interface UsagePoint {
  id: string
  at: string
  usedBytes: number
}

const props = defineProps<{ points: UsagePoint[]; capacityBytes: number; highlight?: string[] }>()
const { t, gb, signedGb, date, count } = useI18n()

const host = ref<HTMLElement | null>(null)
const width = ref(800)
const H = 260
const M = { t: 16, r: 72, b: 28, l: 44 }
let observer: ResizeObserver | null = null

onMounted(() => {
  if (!host.value) return
  width.value = Math.max(320, host.value.clientWidth || 800)
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(320, Math.round(entry.contentRect.width))
  })
  observer.observe(host.value)
})
onBeforeUnmount(() => observer?.disconnect())

const innerW = computed(() => width.value - M.l - M.r)
const innerH = H - M.t - M.b
const capGb = computed(() => Math.max(props.capacityBytes, ...props.points.map((p) => p.usedBytes)) / GIB)

const times = computed(() => props.points.map((p) => Date.parse(p.at)))
function x(i: number): number {
  const ts = times.value
  const t0 = ts[0] ?? 0
  const t1 = ts[ts.length - 1] ?? 0
  return M.l + (t1 === t0 ? innerW.value / 2 : ((ts[i]! - t0) / (t1 - t0)) * innerW.value)
}
const y = (gbValue: number) => M.t + innerH - (gbValue / capGb.value) * innerH
const yBytes = (bytes: number) => y(bytes / GIB)

/** Passo "redondo" (1/2/2,5/5 × 10ⁿ) para ~4 divisões até a capacidade. */
const ticks = computed(() => {
  const raw = capGb.value / 4
  const mag = 10 ** Math.floor(Math.log10(raw || 1))
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag
  const out: number[] = []
  for (let v = 0; v <= capGb.value + 1e-9; v += step) out.push(v)
  return out
})

/** Inteiro com separador de milhar; passo fracionário (volumes < 10 GB) com uma casa. */
const tickLabel = (v: number) => (Number.isInteger(v) ? count(v) : gb(v * GIB).replace(' GB', ''))

/** Datas do eixo X sem sobreposição; primeira e última sempre visíveis. */
const xLabels = computed(() => {
  const shown: number[] = []
  props.points.forEach((_, i) => {
    const last = shown[shown.length - 1]
    if (last === undefined || x(i) - x(last) >= 48) shown.push(i)
  })
  const end = props.points.length - 1
  if (end > 0 && shown[shown.length - 1] !== end) {
    if (x(end) - x(shown[shown.length - 1]!) < 48) shown.pop()
    shown.push(end)
  }
  return shown
})

const linePath = computed(() => props.points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${yBytes(p.usedBytes)}`).join(' '))
const areaPath = computed(() => {
  const n = props.points.length
  if (!n) return ''
  return `M${x(0)},${y(0)} ${props.points.map((p, i) => `L${x(i)},${yBytes(p.usedBytes)}`).join(' ')} L${x(n - 1)},${y(0)} Z`
})

const active = ref<number | null>(null)
const lastIndex = computed(() => props.points.length - 1)

function nearest(px: number): number {
  let best = 0
  let dist = Infinity
  props.points.forEach((_, i) => {
    const d = Math.abs(x(i) - px)
    if (d < dist) {
      dist = d
      best = i
    }
  })
  return best
}

function onMove(event: PointerEvent) {
  const svg = (event.currentTarget as SVGElement).ownerSVGElement
  const rect = svg?.getBoundingClientRect()
  if (!rect || !rect.width) return
  active.value = nearest(((event.clientX - rect.left) * width.value) / rect.width)
}

function onKey(event: KeyboardEvent) {
  const current = active.value ?? lastIndex.value
  if (event.key === 'ArrowRight') active.value = Math.min(lastIndex.value, current + 1)
  else if (event.key === 'ArrowLeft') active.value = Math.max(0, current - 1)
  else return
  event.preventDefault()
}

/** Rótulo do último ponto: desce quando colide com a linha de capacidade. */
const endLabelY = computed(() => {
  const last = props.points[lastIndex.value]
  if (!last) return 0
  const py = yBytes(last.usedBytes)
  return Math.abs(py - yBytes(props.capacityBytes)) < 14 ? py + 18 : py + 4
})

const tip = computed(() => {
  const i = active.value
  if (i === null) return null
  const p = props.points[i]
  if (!p) return null
  const prev = props.points[i - 1]
  const px = x(i)
  return {
    value: gb(p.usedBytes),
    when: date(p.at),
    delta: prev ? t('history.vsPrevious', { delta: signedGb(p.usedBytes - prev.usedBytes) }) : null,
    left: px,
    top: yBytes(p.usedBytes),
    flip: px > width.value * 0.65,
  }
})

const label = computed(() => {
  const first = props.points[0]
  const last = props.points[lastIndex.value]
  return first && last ? t('history.chartLabel', { from: date(first.at, false), to: date(last.at, false) }) : ''
})
</script>

<template>
  <div ref="host" class="chart" data-test="usage-chart">
    <svg :viewBox="`0 0 ${width} ${H}`" :width="width" :height="H" role="img" :aria-label="label">
      <g class="grid">
        <line v-for="v in ticks" :key="`g${v}`" :x1="M.l" :x2="M.l + innerW" :y1="y(v)" :y2="y(v)" />
      </g>
      <g class="ref">
        <line :x1="M.l" :x2="M.l + innerW" :y1="yBytes(capacityBytes)" :y2="yBytes(capacityBytes)" />
        <text :x="M.l + innerW + 6" :y="yBytes(capacityBytes) + 4">{{ t('history.capacity') }}</text>
      </g>
      <path class="area" :d="areaPath" />
      <path class="line" :d="linePath" />
      <g class="axis">
        <text v-for="v in ticks" :key="`t${v}`" :x="M.l - 8" :y="y(v) + 4" text-anchor="end">{{ tickLabel(v) }}</text>
        <text v-for="i in xLabels" :key="`x${i}`" :x="x(i)" :y="H - 8" text-anchor="middle">{{ date(points[i]!.at, false) }}</text>
      </g>
      <line v-if="active !== null" class="cross" :x1="x(active)" :x2="x(active)" :y1="M.t" :y2="M.t + innerH" />
      <circle
        v-for="(p, i) in points"
        :key="p.id"
        class="dot"
        :class="{ sel: highlight?.includes(p.id) }"
        :cx="x(i)"
        :cy="yBytes(p.usedBytes)"
        r="4"
      />
      <text
        v-if="points.length"
        class="end-label"
        :x="x(lastIndex) + 8"
        :y="endLabelY"
      >{{ gb(points[lastIndex]!.usedBytes).replace(' GB', '') }}</text>
      <rect
        class="hit"
        :x="M.l - 10"
        :y="M.t"
        :width="innerW + 20"
        :height="innerH"
        tabindex="0"
        data-test="chart-hit"
        @pointermove="onMove"
        @pointerleave="active = null"
        @focus="active = lastIndex"
        @blur="active = null"
        @keydown="onKey"
      />
    </svg>
    <div
      v-if="tip"
      class="tooltip"
      role="status"
      data-test="chart-tip"
      :style="{ left: `${tip.left}px`, top: `${tip.top}px`, transform: `translate(${tip.flip ? 'calc(-100% - 12px)' : '12px'}, calc(-100% - 10px))` }"
    >
      <span class="v">{{ tip.value }}</span>
      <span class="muted">{{ tip.when }}</span>
      <span v-if="tip.delta" class="muted">{{ tip.delta }}</span>
    </div>
  </div>
</template>
