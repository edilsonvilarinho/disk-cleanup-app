<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useClassificationStore, type ClassificationTab } from '../../application/stores/classification'
import { useSettingsStore } from '../../application/stores/settings'
import type { SkippedDto } from '../../domain/models'
import { TIERS } from '../../domain/selection'
import TierBadge from '../components/TierBadge.vue'
import { useI18n } from '../i18n'

const store = useClassificationStore()
const settings = useSettingsStore()
const { t, txt, err, gb, num } = useI18n()

onMounted(() => store.ensureLoaded(settings.extraExclusions))
const reload = () => store.load(settings.extraExclusions)

const tabs = computed<{ id: ClassificationTab; label: string }[]>(() => [
  ...TIERS.map((tier) => ({ id: tier as ClassificationTab, label: `${tier} · ${t(`tier.${tier}`)}` })),
  { id: 'X', label: t('classify.exclusions') },
])

function skipText(s: SkippedDto): string {
  return t(`skip.${s.code}`, { detail: s.detail ?? '', reason: s.reason ? txt(s.reason) : '' })
}
</script>

<template>
  <header class="page-head">
    <div class="titles">
      <span class="label-caps">{{ t('classify.eyebrow') }}</span>
      <h1>{{ t('classify.title') }}</h1>
    </div>
    <div class="actions">
      <button type="button" class="btn" data-test="reclassify" :disabled="store.status === 'running'" @click="reload">{{ t('classify.reclassify') }}</button>
      <RouterLink v-if="store.total.count > 0" class="btn btn-primary" to="/plano" data-test="to-plan">{{ t('classify.toPlan') }}</RouterLink>
      <button v-else type="button" class="btn btn-primary" disabled data-test="to-plan">{{ t('classify.toPlan') }}</button>
    </div>
  </header>

  <div class="note" role="note"><span>{{ t('classify.note') }}</span></div>

  <div v-if="store.status === 'running'" class="note" role="status" data-test="classify-loading">{{ t('classify.loading') }}</div>
  <div v-if="store.error" class="note warn-note" role="alert" data-test="classify-error">
    <span>{{ t('classify.failed', { error: err(store.error) }) }}</span>
    <button type="button" class="btn" data-test="retry" @click="reload">{{ t('common.retry') }}</button>
  </div>

  <div v-if="store.report" class="grid-aside">
    <section class="card" :aria-label="t('classify.tiers')">
      <div class="tabs" role="tablist" :aria-label="t('classify.tiers')">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="tab"
          role="tab"
          :aria-selected="store.activeTab === tab.id"
          :data-test="`tab-${tab.id}`"
          @click="store.setTab(tab.id)"
        >
          {{ tab.label }}
          <span class="count">{{ tab.id === 'X' ? store.report.exclusions.length : store.counts[tab.id] }}</span>
        </button>
      </div>

      <template v-if="store.activeTab === 'X'">
        <div class="table-wrap" data-test="exclusions">
          <table>
            <thead><tr><th scope="col">{{ t('classify.path') }}</th><th scope="col">{{ t('classify.reason') }}</th></tr></thead>
            <tbody>
              <tr v-for="ex in store.report.exclusions" :key="ex.pattern">
                <td class="mono small">{{ ex.pattern }}</td>
                <td class="small">{{ txt(ex.reason) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <template v-else>
        <div class="card-head">
          <p class="small muted">{{ t('classify.blockedHint') }}</p>
          <button type="button" class="btn" data-test="toggle-tier" @click="store.toggleTier(store.activeTab)">{{ t('classify.toggleTier') }}</button>
        </div>
        <p v-if="store.visible.length === 0" class="muted" data-test="tier-empty">{{ t('classify.emptyTier') }}</p>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col"><span class="sr-only">{{ t('classify.select') }}</span></th>
                <th scope="col">{{ t('classify.item') }}</th>
                <th scope="col" class="num">GB</th>
                <th scope="col">{{ t('classify.risk') }}</th>
                <th scope="col">{{ t('classify.note2') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in store.visible" :key="c.id" :class="{ blocked: c.blocked }" data-test="row">
                <td>
                  <input
                    :id="`c-${c.id}`"
                    type="checkbox"
                    :checked="!c.blocked && store.selected.includes(c.id)"
                    :disabled="!!c.blocked"
                    @change="store.toggle(c.id)"
                  />
                </td>
                <td>
                  <label :for="`c-${c.id}`">{{ txt(c.label) }}</label>
                  <span class="path">{{ c.target }}</span>
                </td>
                <td class="num">{{ num(c.sizeBytes) }}</td>
                <td class="small">{{ t(`risk.${c.risk}`) }}</td>
                <td>
                  <span v-if="c.blocked" class="pill warn"><span class="dot" />{{ t('classify.blocked', { reason: t(`block.${c.blocked.code}`, { value: c.blocked.value }) }) }}</span>
                  <span v-else class="small muted">{{ txt(c.note) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <details v-if="store.report.skipped.length" data-test="skipped">
        <summary>{{ t('classify.skipped', { n: store.report.skipped.length }) }}</summary>
        <ul class="checklist small">
          <li v-for="s in store.report.skipped" :key="s.id"><span class="mono">{{ s.id }}</span><span class="muted">{{ skipText(s) }}</span></li>
        </ul>
      </details>
    </section>

    <aside style="display: flex; flex-direction: column; gap: 16px">
      <section class="card" :aria-label="t('classify.selection')">
        <h2>{{ t('classify.selection') }}</h2>
        <div v-for="total in store.totals" :key="total.tier" class="kv">
          <TierBadge :tier="total.tier" />
          <span class="small"><span class="muted">{{ t(total.count === 1 ? 'common.item' : 'common.items', { n: total.count }) }}</span> · <span class="num">{{ gb(total.bytes) }}</span></span>
        </div>
        <div class="divider" />
        <div class="kv" style="font-weight: 600" data-test="total">
          <span>{{ t('classify.total') }}</span><span class="num" style="font-size: 18px">{{ gb(store.total.bytes) }}</span>
        </div>
        <span class="small muted">{{ t('classify.selected', { n: store.total.count }) }}</span>
      </section>
    </aside>
  </div>
</template>
