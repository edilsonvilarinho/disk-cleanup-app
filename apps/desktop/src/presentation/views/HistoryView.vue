<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useHistoryStore } from '../../application/stores/history'
import { DIFF_LIMIT, HISTORY_LIMIT } from '../../domain/history'
import DiffList from '../components/DiffList.vue'
import KpiCard from '../components/KpiCard.vue'
import UsageChart from '../components/UsageChart.vue'
import { useI18n } from '../i18n'

const history = useHistoryStore()
const { t, gb, signedGb, count, duration, date } = useI18n()
const confirming = ref(false)

onMounted(() => history.load())

const snapshots = computed(() => history.snapshots)
const first = computed(() => snapshots.value[0] ?? null)
const latest = computed(() => history.latest)
const previous = computed(() => history.previous)
/** Tabela: mais recente primeiro, com a variação em relação à varredura anterior. */
const rows = computed(() =>
  snapshots.value.map((s, i) => ({ s, delta: i > 0 ? s.usedBytes - snapshots.value[i - 1]!.usedBytes : null })).reverse(),
)
const points = computed(() => snapshots.value.map((s) => ({ id: s.id, at: s.at, usedBytes: s.usedBytes })))
const highlight = computed(() => [history.from?.id, history.to?.id].filter((id): id is string => !!id))

function pick(side: 'from' | 'to', event: Event) {
  const id = (event.target as HTMLSelectElement).value
  if (side === 'from') history.select(id, history.to?.id ?? id)
  else history.select(history.from?.id ?? id, id)
}

function clearAll() {
  history.clear()
  confirming.value = false
}
</script>

<template>
  <header class="page-head">
    <div class="titles">
      <span class="label-caps">{{ t('history.eyebrow') }}</span>
      <h1>{{ t('history.title') }}</h1>
    </div>
    <div class="actions">
      <span class="small muted">{{ t('history.stored', { n: HISTORY_LIMIT }) }}</span>
      <button v-if="snapshots.length" type="button" class="btn" data-test="clear-history" @click="confirming = true">{{ t('history.clear') }}</button>
    </div>
  </header>

  <div v-if="history.saveFailed" class="note warn-note" role="alert" data-test="history-save-failed">
    <span>{{ t('history.saveFailed') }}</span>
  </div>

  <Transition name="fade">
    <div v-if="confirming" class="inset" data-test="clear-confirm" style="flex-wrap: wrap">
      <span>{{ t('history.clearConfirm', { n: snapshots.length }) }}</span>
      <div class="actions">
        <button type="button" class="btn" data-test="clear-cancel" @click="confirming = false">{{ t('history.clearCancel') }}</button>
        <button type="button" class="btn btn-primary btn-danger" data-test="clear-ok" @click="clearAll">{{ t('history.clearOk') }}</button>
      </div>
    </div>
  </Transition>

  <div v-if="!latest" class="card empty" data-test="history-empty">
    <h2>{{ t('history.emptyTitle') }}</h2>
    <p class="muted">{{ t('history.emptyBody') }}</p>
    <RouterLink class="btn btn-primary" to="/">{{ t('history.toSurvey') }}</RouterLink>
  </div>

  <template v-else>
    <section class="kpis" aria-label="KPIs">
      <KpiCard :label="t('history.count')" :value="count(snapshots.length)" :hint="t('history.since', { date: date(first!.at, false) })" data-test="kpi-count" />
      <KpiCard :label="t('history.lastUsed')" :value="gb(latest.usedBytes)" :hint="t('history.lastUsedHint', { total: gb(latest.totalBytes), date: date(latest.at, false) })" />
      <KpiCard
        :label="t('history.sincePrevious')"
        :value="previous ? signedGb(latest.usedBytes - previous.usedBytes) : '—'"
        :hint="previous ? t('history.range', { from: date(previous.at, false), to: date(latest.at, false) }) : t('history.onlyOne')"
        data-test="kpi-previous"
      />
      <KpiCard
        :label="t('history.period')"
        :value="previous ? signedGb(latest.usedBytes - first!.usedBytes) : '—'"
        :hint="previous ? t('history.range', { from: date(first!.at, false), to: date(latest.at, false) }) : ''"
        data-test="kpi-period"
      />
    </section>

    <section class="card">
      <div class="card-head">
        <h2>{{ t('history.chartTitle', { root: latest.volumeRoot }) }}</h2>
        <span class="small muted">{{ t('history.chartHint') }}</span>
      </div>
      <UsageChart :points="points" :capacity-bytes="latest.totalBytes" :highlight="highlight" />
    </section>

    <section class="card" data-test="compare">
      <div class="card-head">
        <h2>{{ t('history.compareTitle') }}</h2>
        <div v-if="snapshots.length > 1" class="compare-pick">
          <label class="small muted" for="cmp-from">{{ t('history.from') }}</label>
          <select id="cmp-from" class="select" data-test="cmp-from" :value="history.from?.id" @change="pick('from', $event)">
            <option v-for="s in snapshots" :key="s.id" :value="s.id">{{ date(s.at) }}</option>
          </select>
          <label class="small muted" for="cmp-to">{{ t('history.to') }}</label>
          <select id="cmp-to" class="select" data-test="cmp-to" :value="history.to?.id" @change="pick('to', $event)">
            <option v-for="s in snapshots" :key="s.id" :value="s.id">{{ date(s.at) }}</option>
          </select>
        </div>
      </div>

      <p v-if="snapshots.length < 2" class="muted" data-test="need-two">{{ t('history.needTwo') }}</p>
      <p v-else-if="!history.comparison" class="muted" data-test="same-scan">{{ t('history.sameScan') }}</p>
      <template v-else>
        <div class="inset" style="flex-wrap: wrap; gap: 24px; justify-content: flex-start" data-test="cmp-summary">
          <div class="cmp-stat"><span class="small muted">{{ t('history.used') }}</span><span class="num">{{ signedGb(history.comparison.usedDelta) }}</span></div>
          <div class="cmp-stat"><span class="small muted">{{ t('history.free') }}</span><span class="num">{{ signedGb(history.comparison.freeDelta) }}</span></div>
          <div class="cmp-stat"><span class="small muted">{{ t('history.files') }}</span><span class="num">{{ (history.comparison.filesDelta < 0 ? '-' : '+') + count(Math.abs(history.comparison.filesDelta)) }}</span></div>
          <div class="cmp-stat"><span class="small muted">{{ t('history.interval') }}</span><span class="num">{{ t('history.days', { n: history.comparison.days }) }}</span></div>
        </div>
        <div v-if="history.comparison.profile === null" class="note warn-note" role="note" data-test="profile-differs">
          <span>{{ t('history.profileDiffers') }}</span>
        </div>
        <div class="legend">
          <span><span class="key" style="background: var(--grow)" />{{ t('history.grew') }}</span>
          <span><span class="key" style="background: var(--shrink)" />{{ t('history.shrank') }}</span>
          <span>{{ t('history.order', { n: DIFF_LIMIT }) }}</span>
        </div>
        <div class="grid-2">
          <div class="diff-col" data-test="diff-roots">
            <h3 class="label-caps">{{ t('history.roots') }}</h3>
            <DiffList :items="history.comparison.roots" />
          </div>
          <div v-if="history.comparison.profile" class="diff-col" data-test="diff-profile">
            <h3 class="label-caps">{{ t('history.profile') }}</h3>
            <DiffList :items="history.comparison.profile" />
          </div>
        </div>
      </template>
    </section>

    <section class="card">
      <h2>{{ t('history.listTitle') }}</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{{ t('history.date') }}</th>
              <th scope="col">{{ t('history.depth') }}</th>
              <th scope="col" class="num">{{ t('history.usedCol') }}</th>
              <th scope="col" class="num">{{ t('history.freeCol') }}</th>
              <th scope="col" class="num">{{ t('history.deltaCol') }}</th>
              <th scope="col" class="num">{{ t('history.filesCol') }}</th>
              <th scope="col" class="num">{{ t('history.durationCol') }}</th>
              <th scope="col"><span class="sr-only">{{ t('history.actions') }}</span></th>
            </tr>
          </thead>
          <TransitionGroup tag="tbody" name="list">
            <tr v-for="row in rows" :key="row.s.id" data-test="history-row">
              <td class="date">
                {{ date(row.s.at) }}
                <span v-if="history.comparison && row.s.id === history.from?.id" class="tag">{{ t('history.tagFrom') }}</span>
                <span v-if="history.comparison && row.s.id === history.to?.id" class="tag">{{ t('history.tagTo') }}</span>
              </td>
              <td class="small">{{ t(row.s.depth === 1 ? 'survey.depth1' : 'survey.depth2') }}</td>
              <td class="num">{{ gb(row.s.usedBytes).replace(' GB', '') }}</td>
              <td class="num">{{ gb(row.s.freeBytes).replace(' GB', '') }}</td>
              <td class="num">{{ row.delta === null ? '—' : signedGb(row.delta).replace(' GB', '') }}</td>
              <td class="num">{{ count(row.s.files) }}</td>
              <td class="num muted">{{ duration(row.s.elapsedMs) }}</td>
              <td>
                <button type="button" class="btn" data-test="remove-scan" :aria-label="t('history.removeLabel', { date: date(row.s.at) })" @click="history.remove(row.s.id)">
                  {{ t('history.remove') }}
                </button>
              </td>
            </tr>
          </TransitionGroup>
        </table>
      </div>
    </section>
  </template>
</template>
