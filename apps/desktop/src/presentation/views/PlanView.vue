<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { messageOf } from '../../application/gateway'
import { useClassificationStore } from '../../application/stores/classification'
import { usePlanStore } from '../../application/stores/plan'
import { useSurveyStore } from '../../application/stores/survey'
import { useSystemStore } from '../../application/stores/system'
import type { Tier } from '../../domain/models'
import TierBadge from '../components/TierBadge.vue'
import { useI18n } from '../i18n'
import { volumeLabel } from '../labels'

const system = useSystemStore()
const survey = useSurveyStore()
const classification = useClassificationStore()
const planStore = usePlanStore()
const router = useRouter()
const { t, txt, err, gb, num, count } = useI18n()
const copyStatus = ref('')
/** Grupos por tier abertos; começam recolhidos para a tela caber sem rolar. */
const open = ref<Partial<Record<Tier, boolean>>>({})
const drawer = ref(false)
/** Requisito que falta, destacado quando o usuário tenta aprovar antes da hora. */
const attention = ref<'tiers' | 'ack' | null>(null)
const ackInput = ref<HTMLInputElement | null>(null)

const ready = computed(() => classification.status === 'done' && system.info !== null)
const items = computed(() => classification.candidates.filter((c) => classification.selected.includes(c.id) && !c.blocked))
const groups = computed(() =>
  (planStore.plan?.tiers ?? []).map((pt) => ({
    tier: pt.tier,
    bytes: pt.estimatedBytes,
    items: items.value.filter((c) => c.tier === pt.tier),
    approved: planStore.approvedTiers.includes(pt.tier),
  })),
)
const maxBytes = computed(() => Math.max(1, ...groups.value.map((g) => g.bytes)))
const running = computed(() => groups.value.filter((g) => g.approved))
const runCount = computed(() => running.value.reduce((n, g) => n + g.items.length, 0))
const runBytes = computed(() => running.value.reduce((n, g) => n + g.bytes, 0))
const allOpen = computed(() => groups.value.length > 0 && groups.value.every((g) => open.value[g.tier]))
const missing = computed(() => (planStore.approvedTiers.length === 0 ? t('plan.missingTier') : t('plan.missingAck')))

const itemsLabel = (n: number) => (n === 1 ? t('common.item', { n }) : t('common.items', { n }))

onMounted(() => {
  if (ready.value) void planStore.build(volumeLabel(system.info!.volumeRoot), [...classification.selected])
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') drawer.value = false
}

async function approve() {
  if (!planStore.canApprove) {
    // Botão com aria-disabled (não disabled): o clique aponta o que falta.
    attention.value = null
    await nextTick()
    attention.value = planStore.approvedTiers.length === 0 ? 'tiers' : 'ack'
    if (attention.value === 'ack') ackInput.value?.focus()
    return
  }
  await planStore.approve()
  if (planStore.approval) await router.push('/execucao')
}

function onAck(event: Event) {
  planStore.setAcknowledged((event.target as HTMLInputElement).checked)
}

function toggleGroup(tier: Tier) {
  open.value = { ...open.value, [tier]: !open.value[tier] }
}

function toggleAll() {
  const next = !allOpen.value
  open.value = Object.fromEntries(groups.value.map((g) => [g.tier, next]))
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
      <button v-if="planStore.plan" type="button" class="btn" data-test="open-json" @click="drawer = true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 3H6v18h12V7z" />
          <path d="M14 3v4h4" />
        </svg>
        plan.json
      </button>
      <button
        v-if="planStore.plan"
        type="button"
        class="btn btn-primary"
        :class="{ ready: planStore.canApprove }"
        data-test="approve"
        :aria-disabled="!planStore.canApprove"
        :title="planStore.canApprove ? undefined : missing"
        @click="approve"
      >
        {{ t('plan.approve') }}
      </button>
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
    <!-- Aprovação logo abaixo do botão: os dois requisitos ficam colados no controle que liberam. -->
    <section class="card approve-card" data-test="approval" :aria-label="t('plan.approval')">
      <div class="ap-sum">
        <div class="ap-kpi"><span class="small muted">{{ t('plan.runItems') }}</span><span class="ap-v" data-test="run-count">{{ count(runCount) }}</span></div>
        <div class="ap-kpi"><span class="small muted">{{ t('plan.estimate') }}</span><span class="ap-v" data-test="run-bytes">{{ gb(runBytes) }}</span></div>
        <div v-if="survey.report" class="ap-kpi">
          <span class="small muted">{{ t('plan.freeAfter') }}</span>
          <span class="ap-v" data-test="free-after">{{ gb(survey.report.volume.freeBytes + runBytes) }}</span>
        </div>
      </div>
      <div class="ap-ctrl">
        <div class="ap-step">
          <span class="label-caps"><span class="ap-n">1</span>{{ t('plan.approvedTiers') }}</span>
          <div class="chips" :class="{ attn: attention === 'tiers' }" data-test="plan-tiers">
            <label v-for="g in groups" :key="g.tier" class="chip-tier" :class="{ on: g.approved }" :style="{ '--tc': `var(--t${g.tier})` }">
              <input type="checkbox" :data-test="`approve-tier-${g.tier}`" :checked="g.approved" @change="planStore.toggleTier(g.tier)" />
              <span class="chip-box" aria-hidden="true">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7" /></svg>
              </span>
              <span class="chip-txt">
                <strong>{{ g.tier }} · {{ t(`tier.${g.tier}`) }}</strong>
                <span class="small muted">{{ itemsLabel(g.items.length) }} · {{ gb(g.bytes) }}</span>
              </span>
            </label>
          </div>
        </div>
        <div class="ap-step">
          <span class="label-caps"><span class="ap-n">2</span>{{ t('plan.confirm') }}</span>
          <label class="ack" :class="{ on: planStore.acknowledged, attn: attention === 'ack' }">
            <input ref="ackInput" type="checkbox" data-test="ack" :checked="planStore.acknowledged" @change="onAck" />
            <span>{{ t('plan.ack') }}</span>
          </label>
        </div>
        <p v-if="!planStore.canApprove" class="small muted" data-test="approve-missing">{{ missing }}</p>
        <p v-else class="small ok" data-test="approve-ready">{{ t('plan.ready') }}</p>
        <p v-if="planStore.approveError" class="small err" role="alert" data-test="approve-error">{{ err(planStore.approveError) }}</p>
        <p class="small muted">{{ t('plan.approvalHint') }}</p>
      </div>
    </section>

    <section class="card" data-test="plan-items">
      <div class="card-head">
        <h2>{{ t('plan.byTier') }}</h2>
        <div class="actions">
          <span class="small muted">{{ t('plan.order') }}</span>
          <button type="button" class="btn" data-test="toggle-groups" @click="toggleAll">{{ allOpen ? t('plan.collapseAll') : t('plan.expandAll') }}</button>
        </div>
      </div>
      <div class="grps">
        <div v-for="g in groups" :key="g.tier" class="grp" :class="{ off: !g.approved }" :data-open="!!open[g.tier]" data-test="plan-group">
          <button type="button" class="grp-head" :aria-expanded="!!open[g.tier]" @click="toggleGroup(g.tier)">
            <TierBadge :tier="g.tier" />
            <span class="small muted">{{ itemsLabel(g.items.length) }}</span>
            <span v-if="!g.approved" class="pill neutral">{{ t('plan.outOfRun') }}</span>
            <span class="grp-bar" aria-hidden="true"><i :style="{ width: `${(g.bytes / maxBytes) * 100}%`, background: `var(--t${g.tier})` }" /></span>
            <span class="num">{{ gb(g.bytes) }}</span>
            <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <div class="grp-body" :inert="!open[g.tier]">
            <div>
              <ul class="grp-items">
                <li v-for="c in g.items" :key="c.id">
                  <span class="gi-name">{{ txt(c.label) }}<span class="gi-path">{{ c.target }}</span></span>
                  <span class="mono small muted">{{ c.kind }}</span>
                  <span class="small muted">{{ t(`risk.${c.risk}`) }}</span>
                  <span class="num">{{ num(c.sizeBytes) }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>

    <Transition name="drawer">
      <div v-if="drawer" class="drawer-wrap" data-test="json-drawer">
        <div class="drawer-scrim" @click="drawer = false" />
        <aside class="drawer" role="dialog" aria-modal="true" aria-label="plan.json">
          <div class="card-head">
            <h2>plan.json</h2>
            <div class="actions">
              <span class="small muted" aria-live="polite" data-test="copy-status">{{ copyStatus }}</span>
              <button type="button" class="btn" data-test="copy-json" @click="copy(planStore.plan.json)">{{ t('plan.copy') }}</button>
              <button type="button" class="btn" data-test="close-json" :aria-label="t('plan.close')" @click="drawer = false">×</button>
            </div>
          </div>
          <p class="small muted">{{ t('plan.skillHint') }} <span class="mono">cleanup.ps1 -Plan plan.json -Tier A</span></p>
          <pre class="code" data-test="plan-json">{{ planStore.plan.json }}</pre>
        </aside>
      </div>
    </Transition>
  </template>
</template>
