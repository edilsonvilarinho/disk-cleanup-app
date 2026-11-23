<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useExecutionStore } from '../../application/stores/execution'
import { usePlanStore } from '../../application/stores/plan'
import { formatGb, formatSignedGb } from '../../domain/format'
import type { ItemStatus, Tier } from '../../domain/models'
import { TIER_LABEL } from '../../domain/selection'
import TierBadge from '../components/TierBadge.vue'

const plan = usePlanStore()
const exec = useExecutionStore()
const approval = computed(() => plan.approval)
const current = computed(() => exec.nextTier)
const steps = computed(() => (current.value ? (exec.previews[current.value] ?? []) : []))
const estimate = computed(() => steps.value.reduce((sum, s) => sum + s.estimatedBytes, 0))
const runningSteps = computed(() => (exec.running ? (exec.previews[exec.running] ?? []) : []))

const TONE: Record<ItemStatus, string> = { ok: 'ok', parcial: 'warn', pulado: 'neutral', erro: 'err' }

function stageLabel(tier: Tier): string {
  if (exec.runs[tier]) return 'Concluído'
  if (exec.running === tier) return 'Executando'
  return tier === current.value ? 'Próximo' : 'Aguardando'
}

function liveLabel(id: string): string {
  const live = exec.live[id]
  if (live === undefined) return 'na fila'
  return live === 'running' ? 'rodando' : live.status
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
      <span class="label-caps">Etapa 4 de 5 · execução</span>
      <h1>Execução por tier</h1>
    </div>
  </header>

  <div v-if="!approval" class="card empty" data-test="execute-empty">
    <h2>Nenhum plano aprovado</h2>
    <p class="muted">Aprove o plano antes de executar. Só os tiers aprovados podem rodar, um de cada vez.</p>
    <RouterLink class="btn btn-primary" to="/plano">Ir para o Plano</RouterLink>
  </div>

  <template v-else>
    <div class="note warn-note" role="note">
      <span>Remoção é irreversível. Cada tier roda separado e mede o espaço livre antes e depois de cada item; item travado não aborta o tier.</span>
    </div>
    <div v-if="exec.error" class="note warn-note" role="alert" data-test="execute-error">
      <span>{{ exec.error }}</span>
    </div>

    <section class="stepper" aria-label="Progresso por tier">
      <div v-for="tier in exec.tiers" :key="tier" class="stage" :class="{ active: tier === current }" data-test="stage">
        <div class="row">
          <TierBadge :tier="tier" />
          <span class="pill" :class="exec.runs[tier] ? 'ok' : 'neutral'">{{ stageLabel(tier) }}</span>
        </div>
        <span v-if="exec.runs[tier]" class="num" style="text-align: left; font-size: 20px">{{ formatSignedGb(exec.runs[tier]!.freedBytes) }}</span>
      </div>
    </section>

    <section v-if="exec.running" class="card" role="status" aria-live="polite" data-test="running">
      <h2>Executando tier {{ exec.running }} · {{ TIER_LABEL[exec.running] }}</h2>
      <ul class="checklist small">
        <li v-for="s in runningSteps" :key="s.id"><span class="mono">{{ liveLabel(s.id) }}</span><span>{{ s.label }}</span></li>
      </ul>
    </section>

    <section v-else-if="current" class="card" :aria-label="`Tier ${current}`">
      <div class="card-head">
        <h2>Tier {{ current }} · {{ TIER_LABEL[current] }} — dry-run</h2>
        <span class="small muted">nada foi alterado ainda</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th scope="col">Item</th><th scope="col">Tipo</th><th scope="col" class="num">GB previsto</th></tr></thead>
          <tbody>
            <tr v-for="s in steps" :key="s.id" data-test="step">
              <td>{{ s.label }}<span class="path">{{ s.target }}</span></td>
              <td class="mono small">{{ s.kind }}</td>
              <td class="num">{{ formatGb(s.estimatedBytes).replace(' GB', '') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="exec.confirming === current" class="inset" data-test="confirm" style="flex-wrap: wrap">
        <span>Executar o tier {{ current }} remove {{ steps.length }} itens (~{{ formatGb(estimate) }}). Esta ação não pode ser desfeita.</span>
        <div class="actions">
          <button type="button" class="btn" data-test="cancel" @click="exec.cancel()">Cancelar</button>
          <button type="button" class="btn btn-primary btn-danger" data-test="confirm-execute" @click="run(current)">Confirmar e executar</button>
        </div>
      </div>
      <div v-else class="actions">
        <button type="button" class="btn btn-primary btn-lg" data-test="execute" @click="exec.request(current)">Executar tier {{ current }}</button>
      </div>
    </section>

    <template v-for="tier in exec.tiers" :key="`run-${tier}`">
      <section v-if="exec.runs[tier]" class="card" :aria-label="`Resultado do tier ${tier}`">
        <div class="card-head">
          <h2>Tier {{ tier }} · resultado</h2>
          <span class="small muted">{{ formatGb(exec.runs[tier]!.freeBeforeBytes) }} → {{ formatGb(exec.runs[tier]!.freeAfterBytes) }} livres</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">Status</th><th scope="col">Item</th><th scope="col" class="num">Δ livre</th></tr></thead>
            <tbody>
              <tr v-for="item in exec.runs[tier]!.items" :key="item.id" data-test="result">
                <td><span class="pill" :class="TONE[item.status]"><span class="dot" />{{ item.status }}</span></td>
                <td>{{ item.label }}<span v-if="item.detail" class="path">{{ item.detail }}</span></td>
                <td class="num">{{ formatSignedGb(item.freedBytes) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <div v-if="exec.finished" class="footer-actions">
      <span data-test="total-freed">Liberado nesta execução: <strong class="num">{{ formatSignedGb(exec.totalFreed) }}</strong></span>
      <RouterLink class="btn btn-primary btn-lg" to="/relatorio" data-test="to-report">Ver relatório</RouterLink>
    </div>
  </template>
</template>
