<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useExecutionStore } from '../../application/stores/execution'
import { usePlanStore } from '../../application/stores/plan'
import type { ItemResultDto, ItemStatus, StepDto, Tier } from '../../domain/models'
import TierBadge from '../components/TierBadge.vue'
import { useI18n } from '../i18n'

const plan = usePlanStore()
const exec = useExecutionStore()
const { t, txt, err, gb, num, signedGb } = useI18n()
const approval = computed(() => plan.approval)
const current = computed(() => exec.nextTier)
const steps = computed(() => (current.value ? (exec.previews[current.value] ?? []) : []))
const estimate = computed(() => steps.value.reduce((sum, s) => sum + s.estimatedBytes, 0))
const runningSteps = computed(() => (exec.running ? (exec.previews[exec.running] ?? []) : []))
/** Tiers concluídos abertos pelo usuário; o atual e o em execução ficam sempre abertos. */
const opened = ref<Partial<Record<Tier, boolean>>>({})

const TONE: Record<ItemStatus, string> = { ok: 'ok', partial: 'warn', skipped: 'neutral', failed: 'err' }

type RowState = 'done' | 'running' | 'current' | 'waiting'

function rowState(tier: Tier): RowState {
  if (exec.runs[tier]) return 'done'
  if (exec.running === tier) return 'running'
  return tier === current.value ? 'current' : 'waiting'
}

function isOpen(tier: Tier): boolean {
  const state = rowState(tier)
  return state === 'running' || state === 'current' || !!opened.value[tier]
}

function toggle(tier: Tier) {
  const state = rowState(tier)
  if (state === 'running' || state === 'current') return
  opened.value = { ...opened.value, [tier]: !opened.value[tier] }
}

function stageLabel(tier: Tier): string {
  return t(`execute.stage${{ done: 'Done', running: 'Running', current: 'Next', waiting: 'Waiting' }[rowState(tier)]}`)
}

/** Itens e estimativa de um tier: do dry-run quando já carregado, senão do plano. */
function tierFacts(tier: Tier): { count: number | null; bytes: number | null } {
  const preview = exec.previews[tier]
  if (preview) return { count: preview.length, bytes: preview.reduce((s, p) => s + p.estimatedBytes, 0) }
  const fromPlan = plan.plan?.tiers.find((p) => p.tier === tier)
  return fromPlan ? { count: fromPlan.itemCount, bytes: fromPlan.estimatedBytes } : { count: null, bytes: null }
}

const itemsLabel = (n: number) => (n === 1 ? t('common.item', { n }) : t('common.items', { n }))

function liveState(id: string): 'queued' | 'running' | ItemStatus {
  const live = exec.live[id]
  if (live === undefined) return 'queued'
  return live === 'running' ? 'running' : live.status
}

function liveLabel(step: StepDto): string {
  const state = liveState(step.id)
  if (state === 'queued') return t('execute.liveQueued')
  return state === 'running' ? t('execute.liveRunning') : t(`status.${state}`)
}

/** Item que foi para a Lixeira mostra o que moveu; os demais, o espaço medido. */
function resultValue(item: ItemResultDto): string {
  return item.trashedBytes > 0 ? t('execute.trashed', { size: gb(item.trashedBytes) }) : signedGb(item.freedBytes)
}

function liveFreed(step: StepDto): string {
  const live = exec.live[step.id]
  return live === undefined || live === 'running' ? `${num(step.estimatedBytes)} GB` : resultValue(live)
}

const toTrash = computed(() => steps.value.some((s) => s.disposal === 'trash'))

const runningDone = computed(() => runningSteps.value.filter((s) => !['queued', 'running'].includes(liveState(s.id))).length)
const runningFreed = computed(() =>
  runningSteps.value.reduce((sum, s) => {
    const live = exec.live[s.id]
    return live && live !== 'running' ? sum + live.freedBytes : sum
  }, 0),
)

function segFill(tier: Tier): string {
  if (exec.runs[tier]) return '100%'
  if (exec.running === tier && runningSteps.value.length) return `${(runningDone.value / runningSteps.value.length) * 100}%`
  return '0%'
}

const stepIndex = computed(() => {
  if (exec.finished) return exec.tiers.length
  const active = exec.running ?? current.value
  return active ? exec.tiers.indexOf(active) + 1 : 1
})

const guide = computed(() => {
  if (exec.finished) {
    const body =
      exec.totalTrashed > 0
        ? t('execute.guideDoneTrashBody', { freed: signedGb(exec.totalFreed), trashed: gb(exec.totalTrashed) })
        : t('execute.guideDoneBody', { freed: signedGb(exec.totalFreed) })
    return { title: t('execute.guideDone'), body }
  }
  if (exec.running) {
    return {
      title: t('execute.running', { tier: exec.running, label: t(`tier.${exec.running}`) }),
      body: t('execute.guideRunningBody', { done: runningDone.value, total: runningSteps.value.length, freed: signedGb(runningFreed.value) }),
    }
  }
  const tier = current.value
  if (!tier) return { title: '', body: '' }
  const label = t(`tier.${tier}`)
  if (exec.confirming === tier) return { title: t('execute.guideConfirm', { tier, label }), body: t('execute.guideConfirmBody') }
  const first = Object.keys(exec.runs).length === 0
  return {
    title: t(first ? 'execute.guideFirst' : 'execute.guideNext', { tier, label }),
    body: t('execute.guideNextBody', { items: itemsLabel(steps.value.length), size: gb(estimate.value), tier }),
  }
})

function causeText(item: ItemResultDto): string {
  if (!item.cause) return ''
  return t(`cause.${item.cause.code}`, { detail: item.cause.detail ?? '', exitCode: item.cause.exitCode ?? '?' })
}

async function previewNext() {
  const tier = exec.nextTier
  if (tier && !exec.previews[tier]) await exec.loadPreview(tier)
}

async function run(tier: Tier) {
  await exec.confirm(tier)
  await previewNext()
}

onMounted(async () => {
  if (!approval.value) return
  if (exec.tiers.join() !== approval.value.tiers.join()) exec.reset(approval.value.tiers)
  await previewNext()
})
</script>

<template>
  <header class="page-head">
    <div class="titles">
      <span class="label-caps">{{ t('execute.eyebrow') }}</span>
      <h1>{{ t('execute.title') }}</h1>
    </div>
    <!-- A próxima ação fica sempre no topo: executar o tier da vez ou ver o relatório. -->
    <div v-if="approval" class="actions">
      <template v-if="exec.finished">
        <span data-test="total-freed">{{ t('execute.total') }} <strong class="num">{{ signedGb(exec.totalFreed) }}</strong></span>
        <span v-if="exec.totalTrashed > 0" class="muted" data-test="total-trashed">{{ t('execute.totalTrashed') }} <strong class="num">{{ gb(exec.totalTrashed) }}</strong></span>
        <RouterLink class="btn btn-primary ready" to="/relatorio" data-test="to-report">{{ t('execute.toReport') }}</RouterLink>
      </template>
      <button v-else-if="exec.running" type="button" class="btn btn-primary" disabled data-test="executing">
        <span class="spin-ring" aria-hidden="true" />{{ t('execute.runningButton', { tier: exec.running }) }}
      </button>
      <button
        v-else-if="current"
        type="button"
        class="btn btn-primary"
        :class="{ ready: exec.confirming !== current }"
        data-test="execute"
        :disabled="exec.confirming === current"
        @click="exec.request(current)"
      >
        {{ t('execute.run', { tier: current }) }}
      </button>
    </div>
  </header>

  <div v-if="!approval" class="card empty" data-test="execute-empty">
    <h2>{{ t('execute.emptyTitle') }}</h2>
    <p class="muted">{{ t('execute.emptyBody') }}</p>
    <RouterLink class="btn btn-primary" to="/plano">{{ t('execute.toPlan') }}</RouterLink>
  </div>

  <template v-else>
    <div v-if="exec.error" class="note warn-note" role="alert" data-test="execute-error">
      <span>{{ err(exec.error) }}</span>
    </div>

    <!-- Guia do passo atual: o que fazer agora e a confirmação no mesmo lugar. -->
    <section class="card guide" :class="{ 'is-done': exec.finished }" aria-live="polite" data-test="guide">
      <div class="guide-top">
        <div class="guide-txt">
          <span class="label-caps">{{ t('execute.step', { k: stepIndex, n: exec.tiers.length }) }}</span>
          <h2>{{ guide.title }}</h2>
          <p class="small muted">{{ guide.body }}</p>
        </div>
        <div class="guide-segs" aria-hidden="true">
          <div v-for="tier in exec.tiers" :key="tier" class="seg" :class="rowState(tier)" :style="{ '--tc': `var(--t${tier})` }">
            <span class="seg-bar"><i :style="{ width: segFill(tier) }" /></span>
            <span class="seg-lbl">
              <svg v-if="exec.runs[tier]" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7" /></svg>
              {{ tier }}
            </span>
          </div>
        </div>
      </div>
      <Transition name="fade">
        <div v-if="current && exec.confirming === current && !exec.running" class="inset confirm" data-test="confirm" style="flex-wrap: wrap">
          <span>{{ t(toTrash ? 'execute.confirmTrash' : 'execute.confirm', { tier: current, n: steps.length, size: gb(estimate) }) }}</span>
          <div class="actions">
            <button type="button" class="btn" data-test="cancel" @click="exec.cancel()">{{ t('execute.cancel') }}</button>
            <button type="button" class="btn btn-danger-solid" data-test="confirm-execute" @click="run(current)">{{ t('execute.confirmRun') }}</button>
          </div>
        </div>
      </Transition>
      <p class="small warn-line">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3l9 16H3z" />
          <path d="M12 10v4M12 17h.01" />
        </svg>
        {{ t('execute.warning') }}
      </p>
    </section>

    <!-- Linha do tempo: um tier por linha; o atual aberto, os concluídos recolhidos. -->
    <section class="card xlist" :aria-label="t('execute.tiers')">
      <div
        v-for="(tier, i) in exec.tiers"
        :key="tier"
        class="xrow"
        :class="rowState(tier)"
        :data-open="isOpen(tier)"
        data-test="stage"
      >
        <button type="button" class="xrow-head" :aria-expanded="isOpen(tier)" @click="toggle(tier)">
          <span v-if="rowState(tier) === 'done'" class="xs ok" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7" /></svg>
          </span>
          <span v-else-if="rowState(tier) === 'running'" class="xs spin-ring" aria-hidden="true" />
          <span v-else class="xs n" aria-hidden="true">{{ i + 1 }}</span>
          <TierBadge :tier="tier" />
          <span v-if="tierFacts(tier).count !== null" class="small muted">{{ itemsLabel(tierFacts(tier).count!) }}</span>
          <span class="pill" :class="{ ok: rowState(tier) === 'done', info: rowState(tier) === 'running', neutral: rowState(tier) === 'current' || rowState(tier) === 'waiting', strong: rowState(tier) === 'current' }">
            {{ stageLabel(tier) }}
          </span>
          <span v-if="exec.runs[tier]" class="num">{{ signedGb(exec.runs[tier]!.freedBytes) }} <span class="muted">/ {{ num(exec.runs[tier]!.estimatedBytes) }}</span></span>
          <span v-else-if="tierFacts(tier).bytes !== null" class="num muted">{{ t('execute.estimated', { size: gb(tierFacts(tier).bytes!) }) }}</span>
          <span v-if="exec.runs[tier]?.trashedBytes" class="small muted">{{ t('execute.trashed', { size: gb(exec.runs[tier]!.trashedBytes) }) }}</span>
          <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <div class="grp-body" :inert="!isOpen(tier)">
          <div>
            <div class="xrow-inner">
              <TransitionGroup v-if="rowState(tier) === 'running'" tag="ul" name="list" class="exec-list" data-test="running">
                <li v-for="s in runningSteps" :key="s.id" class="exec-item" :class="liveState(s.id)">
                  <span class="exec-ico" aria-hidden="true">
                    <span class="ring" />
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                  </span>
                  <span class="exec-name">{{ txt(s.label) }}<span class="exec-st small muted">{{ liveLabel(s) }}</span></span>
                  <span class="num small">{{ liveFreed(s) }}</span>
                </li>
              </TransitionGroup>
              <template v-else-if="exec.runs[tier]">
                <p class="small muted">{{ t('execute.freeRange', { before: gb(exec.runs[tier]!.freeBeforeBytes), after: gb(exec.runs[tier]!.freeAfterBytes) }) }}</p>
                <ul class="res-list">
                  <li v-for="item in exec.runs[tier]!.items" :key="item.id" data-test="result">
                    <span class="pill" :class="TONE[item.status]"><span class="dot" />{{ t(`status.${item.status}`) }}</span>
                    <span class="gi-name">{{ txt(item.label) }}<span v-if="item.cause" class="gi-path">{{ causeText(item) }}</span></span>
                    <span class="num">{{ resultValue(item) }}</span>
                  </li>
                </ul>
              </template>
              <template v-else-if="rowState(tier) === 'current'">
                <p class="small muted">{{ t('execute.dryRunNote') }}</p>
                <ul class="grp-items">
                  <li v-for="s in steps" :key="s.id" data-test="step">
                    <span class="gi-name">{{ txt(s.label) }}<span class="gi-path">{{ s.target }}</span></span>
                    <span class="mono small muted">{{ s.kind }}</span>
                    <span class="small muted">{{ s.disposal ? t(s.disposal === 'trash' ? 'execute.disposalTrash' : 'execute.disposalPermanent') : '' }}</span>
                    <span class="num">{{ num(s.estimatedBytes) }}</span>
                  </li>
                </ul>
              </template>
              <p v-else class="small muted">{{ t('execute.waitingNote') }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </template>
</template>
