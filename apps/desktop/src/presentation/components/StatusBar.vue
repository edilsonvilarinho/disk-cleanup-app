<script setup lang="ts">
import { useHistoryStore } from '../../application/stores/history'
import { useSettingsStore } from '../../application/stores/settings'
import { nextScanAt } from '../../domain/monitor'
import { computed } from 'vue'
import { useClassificationStore } from '../../application/stores/classification'
import { useExecutionStore } from '../../application/stores/execution'
import { useSurveyStore } from '../../application/stores/survey'
import { useSystemStore } from '../../application/stores/system'
import { useUpdateStore } from '../../application/stores/update'
import { useI18n } from '../i18n'
import UpdateNotice from './UpdateNotice.vue'

const system = useSystemStore()
const survey = useSurveyStore()
const classification = useClassificationStore()
const exec = useExecutionStore()
const update = useUpdateStore()
const { t, err, count, date } = useI18n()

/** Itens do tier em execução que já terminaram (evento `finished` com resultado). */
const execDone = computed(() => {
  const steps = exec.running ? (exec.previews[exec.running] ?? []) : []
  return steps.filter((s) => {
    const live = exec.live[s.id]
    return live !== undefined && live !== 'running'
  }).length
})
const execTotal = computed(() => (exec.running ? (exec.previews[exec.running]?.length ?? 0) : 0))

/** Uma atividade por vez, na ordem em que podem acontecer. */
const activity = computed<'scan' | 'classify' | 'execute' | null>(() => {
  if (exec.running) return 'execute'
  if (survey.status === 'running') return 'scan'
  if (classification.status === 'running') return 'classify'
  return null
})

const state = computed(() => {
  switch (activity.value) {
    case 'scan':
      return t('bar.scanning', { root: system.info?.volumeRoot ?? '', files: count(survey.progress.files) })
    case 'classify':
      return t('bar.classifying')
    case 'execute':
      return t('bar.executing', { tier: exec.running!, done: execDone.value, total: execTotal.value })
    default:
      return t('bar.ready')
  }
})
const progress = computed(() => (execTotal.value ? (execDone.value / execTotal.value) * 100 : 0))

const historyStore = useHistoryStore()
const settingsStore = useSettingsStore()
/** Próxima varredura agendada (somente leitura), quando houver. */
const nextScan = computed(() => nextScanAt(settingsStore.schedule, historyStore.latest?.at ?? null, new Date()))
</script>

<template>
  <footer class="statusbar" :class="{ busy: activity }" :aria-label="t('bar.label')" data-test="statusbar">
    <span class="sb-item" role="status" aria-live="polite">
      <span class="sb-dot" aria-hidden="true" />
      <Transition name="swap" mode="out-in">
        <span :key="activity ?? 'ready'" data-test="sb-state">{{ state }}</span>
      </Transition>
    </span>
    <span v-if="activity === 'execute'" class="sb-prog" aria-hidden="true"><i :style="{ width: `${progress}%` }" /></span>
    <span v-else-if="activity" class="indet sb-bar" aria-hidden="true" />
    <span class="sb-sep" aria-hidden="true" />

    <template v-if="system.info">
      <span class="sb-item" :title="t('env.volume')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M3 14h18" />
        </svg>
        <span class="mono">{{ system.info.volumeRoot }}</span>
      </span>
      <span class="sb-item" :title="`${t('env.system')} · ${t('env.catalog')}`">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
        </svg>
        <span data-test="env-os">{{ system.info.os }}</span>
        <span v-if="system.info.catalog !== system.info.os" class="muted" data-test="env-catalog">· {{ system.info.catalog }}</span>
      </span>
    </template>
    <span v-else-if="system.error" class="sb-item err" data-test="env-error">{{ err(system.error) }}</span>
    <span class="sb-item" :title="t('env.mode')">
      <svg class="ok" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
      {{ t('env.explicit') }}
    </span>

    <span v-if="nextScan" class="sb-item" :title="t('settings.schedule')" data-test="sb-next-scan">{{ t('bar.nextScan', { when: date(nextScan.toISOString()) }) }}</span>
    <span class="sb-right">
      <UpdateNotice />
      <RouterLink class="sb-item sb-link" to="/configuracoes" :title="t('bar.version')">
        <span class="mono" data-test="app-version">{{ update.version ? `v${update.version}` : '—' }}</span>
      </RouterLink>
    </span>
  </footer>
</template>
