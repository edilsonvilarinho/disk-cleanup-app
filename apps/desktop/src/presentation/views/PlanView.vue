<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { messageOf } from '../../application/gateway'
import { useClassificationStore } from '../../application/stores/classification'
import { usePlanStore } from '../../application/stores/plan'
import { useSystemStore } from '../../application/stores/system'
import TierBadge from '../components/TierBadge.vue'
import { useI18n } from '../i18n'
import { volumeLabel } from '../labels'

const system = useSystemStore()
const classification = useClassificationStore()
const planStore = usePlanStore()
const router = useRouter()
const { t, txt, err, gb, num } = useI18n()
const copyStatus = ref('')

const ready = computed(() => classification.status === 'done' && system.info !== null)
const items = computed(() => classification.candidates.filter((c) => classification.selected.includes(c.id) && !c.blocked))

onMounted(() => {
  if (ready.value) void planStore.build(volumeLabel(system.info!.volumeRoot), [...classification.selected])
})

async function approve() {
  await planStore.approve()
  if (planStore.approval) await router.push('/execucao')
}

function onAck(event: Event) {
  planStore.setAcknowledged((event.target as HTMLInputElement).checked)
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copyStatus.value = t('common.copied')
  } catch (e) {
    copyStatus.value = t('common.copyFailed', { detail: messageOf(e) })
  }
}
</script>

<template>
  <header class="page-head">
    <div class="titles">
      <span class="label-caps">{{ t('plan.eyebrow') }}</span>
      <h1>{{ t('plan.title') }}</h1>
    </div>
    <div class="actions">
      <RouterLink class="btn" to="/classificacao">{{ t('plan.back') }}</RouterLink>
    </div>
  </header>

  <div v-if="!ready" class="card empty" data-test="plan-empty">
    <h2>{{ t('plan.emptyTitle') }}</h2>
    <p class="muted">{{ t('plan.emptyBody') }}</p>
    <RouterLink class="btn btn-primary" to="/classificacao">{{ t('plan.toClassify') }}</RouterLink>
  </div>

  <div v-else-if="planStore.error" class="note warn-note" role="alert" data-test="plan-error">
    <span>{{ t('plan.failed', { error: err(planStore.error) }) }}</span>
  </div>

  <template v-else-if="planStore.plan">
    <section class="kpis" aria-label="KPIs">
      <div class="kpi"><span class="small muted">{{ t('plan.items') }}</span><span class="value">{{ planStore.plan.itemCount }}</span></div>
      <div class="kpi"><span class="small muted">{{ t('plan.estimate') }}</span><span class="value">{{ gb(planStore.plan.estimatedBytes) }}</span></div>
    </section>

    <div class="grid-aside">
      <section class="card" data-test="plan-items">
        <div class="card-head"><h2>{{ t('plan.byTier') }}</h2><span class="small muted">{{ t('plan.order') }}</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">{{ t('classify.item') }}</th><th scope="col">{{ t('plan.type') }}</th><th scope="col" class="num">GB</th></tr></thead>
            <tbody>
              <tr v-for="c in items" :key="c.id">
                <td>{{ txt(c.label) }}<span class="path">{{ c.target }}</span></td>
                <td class="mono small">{{ c.kind }}</td>
                <td class="num">{{ num(c.sizeBytes) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <aside style="display: flex; flex-direction: column; gap: 16px">
        <section class="card" data-test="plan-tiers">
          <h2>{{ t('plan.perTier') }}</h2>
          <div v-for="tier in planStore.plan.tiers" :key="tier.tier" class="kv">
            <TierBadge :tier="tier.tier" /><span class="num">{{ gb(tier.estimatedBytes) }}</span>
          </div>
        </section>
        <section class="card" data-test="approval">
          <h2>{{ t('plan.approval') }}</h2>
          <p class="small muted">{{ t('plan.approvalHint') }}</p>
          <fieldset style="border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px">
            <legend class="label-caps" style="margin-bottom: 6px">{{ t('plan.approvedTiers') }}</legend>
            <label v-for="tier in planStore.plan.tiers" :key="tier.tier" class="kv" style="cursor: pointer">
              <TierBadge :tier="tier.tier" />
              <input
                type="checkbox"
                :data-test="`approve-tier-${tier.tier}`"
                :checked="planStore.approvedTiers.includes(tier.tier)"
                @change="planStore.toggleTier(tier.tier)"
              />
            </label>
          </fieldset>
          <div class="divider" />
          <label style="display: flex; gap: 10px; align-items: flex-start; cursor: pointer">
            <input type="checkbox" data-test="ack" style="margin-top: 2px" :checked="planStore.acknowledged" @change="onAck" />
            <span class="small">{{ t('plan.ack') }}</span>
          </label>
          <button type="button" class="btn btn-primary btn-lg" data-test="approve" :disabled="!planStore.canApprove" @click="approve">
            {{ t('plan.approve') }}
          </button>
          <p v-if="planStore.approveError" class="small err" role="alert" data-test="approve-error">{{ err(planStore.approveError) }}</p>
          <p class="small muted">{{ t('plan.skillHint') }} <span class="mono">cleanup.ps1 -Plan plan.json -Tier A</span></p>
        </section>
      </aside>
    </div>

    <section class="card" aria-label="plan.json">
      <div class="card-head">
        <h2>plan.json</h2>
        <div class="actions">
          <span class="small muted" aria-live="polite" data-test="copy-status">{{ copyStatus }}</span>
          <button type="button" class="btn" data-test="copy-json" @click="copy(planStore.plan.json)">{{ t('plan.copy') }}</button>
        </div>
      </div>
      <pre class="code" data-test="plan-json">{{ planStore.plan.json }}</pre>
    </section>
  </template>
</template>
