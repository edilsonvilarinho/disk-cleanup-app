<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSettingsStore } from '../../application/stores/settings'
import { useSurveyStore } from '../../application/stores/survey'
import { useSystemStore } from '../../application/stores/system'
import type { Health, UsageEntryDto } from '../../domain/models'
import BarList from '../components/BarList.vue'
import KpiCard from '../components/KpiCard.vue'
import { useI18n } from '../i18n'

const system = useSystemStore()
const survey = useSurveyStore()
const settings = useSettingsStore()
const { t, err, gb, num, pct, count, duration } = useI18n()
const depth = ref<1 | 2>(settings.defaultDepth)

const TONE: Record<Health, string> = { healthy: 'ok', warning: 'warn', critical: 'err' }

const report = computed(() => survey.report)
const bars = (list: UsageEntryDto[]) => list.slice(0, 10).map((e) => ({ name: e.name, bytes: e.logicalBytes }))
// Computadas: o filho recebe a mesma referência enquanto o relatório não muda.
const rootBars = computed(() => bars(report.value?.roots ?? []))
const profileBars = computed(() => bars(report.value?.profile ?? []))

function start() {
  if (!system.info) return
  void survey.run({ volumeRoot: system.info.volumeRoot, profile: system.info.profile, depth: depth.value })
}
</script>

<template>
  <header class="page-head">
    <div class="titles">
      <span class="label-caps">{{ t('survey.eyebrow') }}</span>
      <h1>{{ t('survey.title') }}</h1>
    </div>
    <div class="actions">
      <label class="field muted" for="depth">{{ t('survey.depth') }}
        <select id="depth" v-model.number="depth" class="select" data-test="depth">
          <option :value="2">{{ t('survey.depth2') }}</option>
          <option :value="1">{{ t('survey.depth1') }}</option>
        </select>
      </label>
      <button
        type="button"
        class="btn btn-primary"
        data-test="start-survey"
        :disabled="!system.info || survey.status === 'running'"
        @click="start"
      >
        {{ report ? t('survey.again') : t('survey.start') }}
      </button>
    </div>
  </header>

  <div v-if="survey.status === 'running'" class="note" role="status" aria-live="polite" data-test="survey-progress">
    <span>{{ t('survey.progress', { root: system.info?.volumeRoot ?? '', files: count(survey.progress.files), size: gb(survey.progress.logicalBytes) }) }}</span>
  </div>
  <div v-if="survey.error" class="note warn-note" role="alert" data-test="survey-error">
    <span>{{ t('survey.failed', { error: err(survey.error) }) }}</span>
  </div>
  <div v-if="!report && survey.status !== 'running'" class="card empty">
    <h2>{{ t('survey.emptyTitle') }}</h2>
    <p class="muted">{{ t('survey.emptyBody') }}</p>
  </div>

  <template v-if="report">
    <section class="kpis" aria-label="KPIs">
      <KpiCard :label="t('survey.used')" :value="gb(report.volume.usedBytes)" :hint="t('survey.of', { total: gb(report.volume.totalBytes) })" data-test="kpi-used" />
      <KpiCard :label="t('survey.free')" :value="gb(report.volume.freeBytes)">
        <span class="pill" :class="TONE[report.volume.health]" data-test="health">
          <span class="dot" />{{ t('survey.freeShare', { health: t(`health.${report.volume.health}`), percent: pct(report.volume.freePercent) }) }}
        </span>
      </KpiCard>
      <KpiCard :label="t('survey.files')" :value="count(report.files)" data-test="scan-stats"
        :hint="t('survey.filesHint', { n: count(report.unreadable), time: duration(report.elapsedMs) })" />
      <KpiCard :label="t('survey.unattributed')" :value="gb(report.unattributedBytes)" :hint="t('survey.unattributedHint')" />
    </section>

    <section class="card">
      <div class="card-head"><h2>{{ t('survey.occupancy', { root: system.info?.volumeRoot ?? '' }) }}</h2><span class="num">{{ pct(report.volume.usedPercent) }}</span></div>
      <div class="meter" role="img" :aria-label="t('survey.occupied', { percent: pct(report.volume.usedPercent) })">
        <span :style="{ width: `${report.volume.usedPercent}%` }" />
      </div>
    </section>

    <div class="grid-2">
      <section class="card" data-test="roots">
        <div class="card-head"><h2>{{ t('survey.roots') }}</h2><span class="small muted">{{ t('survey.logical') }}</span></div>
        <BarList :items="rootBars" />
      </section>
      <section v-if="report.profile.length" class="card" data-test="profile">
        <div class="card-head"><h2>{{ t('survey.profile') }}</h2><span class="small muted mono">{{ system.info?.profile }}</span></div>
        <BarList :items="profileBars" />
      </section>
    </div>

    <section v-if="report.cloud.length" class="card" data-test="cloud">
      <h2>{{ t('survey.cloudTitle') }}</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{{ t('survey.cloudFolder') }}</th>
              <th scope="col" class="num">{{ t('survey.cloudLogical') }}</th>
              <th scope="col" class="num">{{ t('survey.cloudReal') }}</th>
              <th scope="col" class="num">{{ t('survey.cloudPlaceholder') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in report.cloud" :key="c.name">
              <td>{{ c.name }}</td>
              <td class="num">{{ num(c.logicalBytes) }}</td>
              <td class="num" style="font-weight: 600">{{ num(c.allocatedBytes) }}</td>
              <td class="num muted">{{ num(c.placeholderBytes) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="small muted">{{ t('survey.cloudNote') }}</p>
    </section>

    <div class="footer-actions">
      <span class="small muted">{{ t('survey.footer') }}</span>
      <RouterLink class="btn btn-primary btn-lg" to="/classificacao" data-test="to-classify">{{ t('survey.toClassify') }}</RouterLink>
    </div>
  </template>
</template>
