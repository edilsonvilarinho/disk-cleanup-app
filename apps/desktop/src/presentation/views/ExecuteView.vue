<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useExecutionStore } from '../../application/stores/execution'
import { usePlanStore } from '../../application/stores/plan'
import type { ItemResultDto, ItemStatus, Tier } from '../../domain/models'
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

const TONE: Record<ItemStatus, string> = { ok: 'ok', partial: 'warn', skipped: 'neutral', failed: 'err' }

function stageLabel(tier: Tier): string {
  if (exec.runs[tier]) return t('execute.stageDone')
  if (exec.running === tier) return t('execute.stageRunning')
  return tier === current.value ? t('execute.stageNext') : t('execute.stageWaiting')
}

function liveLabel(id: string): string {
  const live = exec.live[id]
  if (live === undefined) return t('execute.liveQueued')
  return live === 'running' ? t('execute.liveRunning') : t(`status.${live.status}`)
}

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
    <div v-if="exec.finished" class="actions">
      <span data-test="total-freed">{{ t('execute.total') }} <strong class="num">{{ signedGb(exec.totalFreed) }}</strong></span>
      <RouterLink class="btn btn-primary" to="/relatorio" data-test="to-report">{{ t('execute.toReport') }}</RouterLink>
    </div>
  </header>

  <div v-if="!approval" class="card empty" data-test="execute-empty">
    <h2>{{ t('execute.emptyTitle') }}</h2>
    <p class="muted">{{ t('execute.emptyBody') }}</p>
    <RouterLink class="btn btn-primary" to="/plano">{{ t('execute.toPlan') }}</RouterLink>
  </div>

  <template v-else>
    <div class="note warn-note" role="note"><span>{{ t('execute.warning') }}</span></div>
    <div v-if="exec.error" class="note warn-note" role="alert" data-test="execute-error">
      <span>{{ err(exec.error) }}</span>
    </div>

    <section class="stepper" aria-label="Tiers">
      <div v-for="tier in exec.tiers" :key="tier" class="stage" :class="{ active: tier === current }" data-test="stage">
        <div class="row">
          <TierBadge :tier="tier" />
          <span class="pill" :class="exec.runs[tier] ? 'ok' : 'neutral'">{{ stageLabel(tier) }}</span>
        </div>
        <span v-if="exec.runs[tier]" class="num" style="text-align: left; font-size: 20px">{{ signedGb(exec.runs[tier]!.freedBytes) }}</span>
      </div>
    </section>

    <section v-if="exec.running" class="card" role="status" aria-live="polite" data-test="running">
      <h2>{{ t('execute.running', { tier: exec.running, label: t(`tier.${exec.running}`) }) }}</h2>
      <TransitionGroup tag="ul" name="list" class="checklist small">
        <li v-for="s in runningSteps" :key="s.id"><span class="mono">{{ liveLabel(s.id) }}</span><span>{{ txt(s.label) }}</span></li>
      </TransitionGroup>
    </section>

    <section v-else-if="current" class="card" :aria-label="`Tier ${current}`">
      <div class="card-head">
        <h2>{{ t('execute.dryRun', { tier: current, label: t(`tier.${current}`) }) }}</h2>
        <span class="small muted">{{ t('execute.nothingYet') }}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th scope="col">{{ t('classify.item') }}</th><th scope="col">{{ t('plan.type') }}</th><th scope="col" class="num">{{ t('execute.planned') }}</th></tr></thead>
          <tbody>
            <tr v-for="s in steps" :key="s.id" data-test="step">
              <td>{{ txt(s.label) }}<span class="path">{{ s.target }}</span></td>
              <td class="mono small">{{ s.kind }}</td>
              <td class="num">{{ num(s.estimatedBytes) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Transition name="fade" mode="out-in">
      <div v-if="exec.confirming === current" key="confirm" class="inset" data-test="confirm" style="flex-wrap: wrap">
        <span>{{ t('execute.confirm', { tier: current, n: steps.length, size: gb(estimate) }) }}</span>
        <div class="actions">
          <button type="button" class="btn" data-test="cancel" @click="exec.cancel()">{{ t('execute.cancel') }}</button>
          <button type="button" class="btn btn-primary btn-danger" data-test="confirm-execute" @click="run(current)">{{ t('execute.confirmRun') }}</button>
        </div>
      </div>
      <div v-else key="actions" class="actions">
        <button type="button" class="btn btn-primary btn-lg" data-test="execute" @click="exec.request(current)">{{ t('execute.run', { tier: current }) }}</button>
      </div>
      </Transition>
    </section>

    <template v-for="tier in exec.tiers" :key="`run-${tier}`">
      <section v-if="exec.runs[tier]" class="card" :aria-label="t('execute.result', { tier })">
        <div class="card-head">
          <h2>{{ t('execute.result', { tier }) }}</h2>
          <span class="small muted">{{ t('execute.freeRange', { before: gb(exec.runs[tier]!.freeBeforeBytes), after: gb(exec.runs[tier]!.freeAfterBytes) }) }}</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">{{ t('execute.status') }}</th><th scope="col">{{ t('classify.item') }}</th><th scope="col" class="num">{{ t('execute.delta') }}</th></tr></thead>
            <tbody>
              <tr v-for="item in exec.runs[tier]!.items" :key="item.id" data-test="result">
                <td><span class="pill" :class="TONE[item.status]"><span class="dot" />{{ t(`status.${item.status}`) }}</span></td>
                <td>{{ txt(item.label) }}<span v-if="item.cause" class="path">{{ causeText(item) }}</span></td>
                <td class="num">{{ signedGb(item.freedBytes) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

  </template>
</template>
