<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { messageOf } from '../../application/gateway'
import { resetCleanupFlow } from '../../application/session'
import { useExportStore } from '../../application/stores/export'
import { useReportStore } from '../../application/stores/report'
import { useSystemStore } from '../../application/stores/system'
import { useUpdateStore } from '../../application/stores/update'
import type { ItemResultDto } from '../../domain/models'
import { reportMarkdown } from '../../domain/report'
import { reportCardFileName, reportCardSvg } from '../../domain/reportCard'
import TierBadge from '../components/TierBadge.vue'
import { useI18n } from '../i18n'

const store = useReportStore()
const exporter = useExportStore()
const system = useSystemStore()
const update = useUpdateStore()
const router = useRouter()
const { t, txt, err, gb, pct, signedGb, locale } = useI18n()
const copyStatus = ref('')
onMounted(() => store.load())

function causeText(item: ItemResultDto): string {
  if (!item.cause) return ''
  return t(`cause.${item.cause.code}`, { detail: item.cause.detail ?? '', exitCode: item.cause.exitCode ?? '?' })
}

async function newAnalysis() {
  resetCleanupFlow()
  await router.push('/')
}

function saveImage() {
  const now = new Date()
  const card = reportCardSvg({
    report: store.report!,
    t,
    locale: locale.value,
    generatedAt: now,
    volumeRoot: system.info?.volumeRoot ?? '',
    version: update.version,
  })
  void exporter.savePng({ ...card, fileName: reportCardFileName(t('reportCard.fileName'), now) })
}

async function copy() {
  try {
    await navigator.clipboard.writeText(reportMarkdown(store.report!, t, locale.value))
    copyStatus.value = t('common.copied')
  } catch (e) {
    copyStatus.value = t('common.copyFailed', { detail: messageOf(e) })
  }
}
</script>

<template>
  <header class="page-head">
    <div class="titles">
      <span class="label-caps">{{ t('report.eyebrow') }}</span>
      <h1>{{ t('report.title') }}</h1>
    </div>
    <div v-if="store.report" class="actions">
      <span class="small muted" aria-live="polite" data-test="copy-report-status">{{ copyStatus }}</span>
      <button type="button" class="btn" data-test="copy-report" @click="copy">{{ t('report.copy') }}</button>
      <button type="button" class="btn" data-test="export-pdf" :disabled="exporter.busy" @click="exporter.print()">{{ t('report.exportPdf') }}</button>
      <button type="button" class="btn" data-test="export-image" :disabled="exporter.busy" @click="saveImage">
        {{ exporter.busy ? t('report.exporting') : t('report.exportImage') }}
      </button>
      <button type="button" class="btn btn-primary" data-test="new-analysis" :title="t('report.newAnalysisHint')" @click="newAnalysis">{{ t('report.newAnalysis') }}</button>
    </div>
  </header>

  <div v-if="exporter.status === 'saved'" class="note no-print" role="status" data-test="export-saved">
    <span>{{ t('report.imageSaved', { path: exporter.savedPath ?? '' }) }}</span>
  </div>
  <div v-else-if="exporter.status === 'cancelled'" class="note no-print" role="status" data-test="export-cancelled">
    <span>{{ t('report.imageCancelled') }}</span>
  </div>
  <div v-else-if="exporter.status === 'error' && exporter.error" class="note warn-note no-print" role="alert" data-test="export-error">
    <span>{{ t('report.exportFailed', { error: err(exporter.error) }) }}</span>
  </div>

  <div v-if="store.error" class="card empty" data-test="report-error">
    <h2>{{ t('report.emptyTitle') }}</h2>
    <p class="muted">{{ t('report.emptyBody', { error: err(store.error) }) }}</p>
    <RouterLink class="btn btn-primary" to="/execucao">{{ t('report.toExecute') }}</RouterLink>
  </div>

  <template v-if="store.report">
    <section class="kpis" aria-label="KPIs">
      <div class="kpi"><span class="small muted">{{ t('report.freed') }}</span><span class="value" data-test="report-freed">{{ signedGb(store.report.freedBytes) }}</span><span class="small muted">{{ t('report.estimated', { size: gb(store.report.estimatedBytes) }) }}</span></div>
      <div class="kpi"><span class="small muted">{{ t('report.free') }}</span><span class="value">{{ gb(store.report.last.freeBytes) }}</span><span class="small muted">{{ t('report.before', { value: gb(store.report.initial.freeBytes) }) }}</span></div>
      <div class="kpi"><span class="small muted">{{ t('report.occupancy') }}</span><span class="value">{{ pct(store.report.last.usedPercent) }}</span><span class="small muted">{{ t('report.before', { value: pct(store.report.initial.usedPercent) }) }}</span></div>
      <div class="kpi"><span class="small muted">{{ t('report.pending') }}</span><span class="value">{{ store.report.pending.length }}</span><span class="small muted">{{ t('report.executed', { n: store.report.itemCount }) }}</span></div>
    </section>

    <section class="card" data-test="report-tiers">
      <div class="card-head"><h2>{{ t('report.byTier') }}</h2><span class="small muted">{{ t('report.measured') }}</span></div>
      <div v-for="run in store.report.runs" :key="run.tier" class="kv">
        <TierBadge :tier="run.tier" />
        <span class="num">{{ signedGb(run.freedBytes) }} <span class="muted">/ {{ gb(run.estimatedBytes) }}</span></span>
      </div>
    </section>

    <div class="grid-2">
      <section class="card" data-test="report-blocked">
        <h2>{{ t('report.divergences') }}</h2>
        <ul v-if="store.report.blocked.length" class="checklist small">
          <li v-for="c in store.report.blocked" :key="c.id">
            <strong>{{ txt(c.label) }}</strong>
            <span class="muted">{{ t('report.kept', { reason: c.blocked ? t(`block.${c.blocked.code}`, { value: c.blocked.value }) : '' }) }}</span>
          </li>
        </ul>
        <p v-else class="muted">{{ t('report.noDivergence') }}</p>
      </section>
      <section class="card" data-test="report-pending">
        <h2>{{ t('report.pending') }}</h2>
        <ul v-if="store.report.pending.length" class="checklist small">
          <li v-for="i in store.report.pending" :key="i.id"><strong>{{ txt(i.label) }}</strong><span class="muted">{{ t(`status.${i.status}`) }}: {{ causeText(i) }}</span></li>
        </ul>
        <p v-else class="muted">{{ t('report.noPending') }}</p>
      </section>
    </div>

    <section class="card" data-test="report-untouched">
      <h2>{{ t('report.untouched') }}</h2>
      <ul class="checklist small">
        <li v-for="e in store.report.exclusions" :key="e.pattern"><span class="mono">{{ e.pattern }}</span><span class="muted">{{ txt(e.reason) }}</span></li>
      </ul>
    </section>

  </template>
</template>
