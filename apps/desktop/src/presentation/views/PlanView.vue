<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { messageOf } from '../../application/gateway'
import { useClassificationStore } from '../../application/stores/classification'
import { usePlanStore } from '../../application/stores/plan'
import { useSystemStore } from '../../application/stores/system'
import { formatGb } from '../../domain/format'
import { volumeLabel } from '../labels'
import TierBadge from '../components/TierBadge.vue'

const system = useSystemStore()
const classification = useClassificationStore()
const planStore = usePlanStore()
const copyStatus = ref('')
const router = useRouter()

const ready = computed(() => classification.status === 'done' && system.info !== null)
const items = computed(() => classification.candidates.filter((c) => classification.selected.includes(c.id) && !c.blockedReason))

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
    copyStatus.value = 'Copiado'
  } catch (e) {
    copyStatus.value = `Falha ao copiar: ${messageOf(e)}`
  }
}
</script>

<template>
  <header class="page-head">
    <div class="titles">
      <span class="label-caps">Etapa 3 de 5 · revisão</span>
      <h1>Plano de limpeza</h1>
    </div>
    <div class="actions">
      <RouterLink class="btn" to="/classificacao">Voltar à seleção</RouterLink>
    </div>
  </header>

  <div v-if="!ready" class="card empty" data-test="plan-empty">
    <h2>Sem seleção</h2>
    <p class="muted">Abra a Classificação, revise os candidatos e volte aqui para montar o plano.</p>
    <RouterLink class="btn btn-primary" to="/classificacao">Ir para a Classificação</RouterLink>
  </div>

  <div v-else-if="planStore.status === 'error'" class="note warn-note" role="alert" data-test="plan-error">
    <span>Não foi possível montar o plano: {{ planStore.error }}</span>
  </div>

  <template v-else-if="planStore.plan">
    <section class="kpis" aria-label="Resumo do plano">
      <div class="kpi"><span class="small muted">Itens no plano</span><span class="value">{{ planStore.plan.itemCount }}</span></div>
      <div class="kpi"><span class="small muted">Liberação estimada</span><span class="value">{{ formatGb(planStore.plan.estimatedBytes) }}</span></div>
    </section>

    <div class="grid-aside">
      <section class="card" aria-label="Itens do plano" data-test="plan-items">
        <div class="card-head"><h2>Itens por tier</h2><span class="small muted">ordem de execução: A → B → C → D</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">Item</th><th scope="col">Tipo</th><th scope="col" class="num">GB</th></tr></thead>
            <tbody>
              <tr v-for="c in items" :key="c.id">
                <td>{{ c.label }}<span class="path">{{ c.target }}</span></td>
                <td class="mono small">{{ c.kind }}</td>
                <td class="num">{{ formatGb(c.sizeBytes).replace(' GB', '') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <aside style="display: flex; flex-direction: column; gap: 16px">
        <section class="card" data-test="plan-tiers">
          <h2>Por tier</h2>
          <div v-for="t in planStore.plan.tiers" :key="t.tier" class="kv">
            <TierBadge :tier="t.tier" /><span class="num">{{ formatGb(t.estimatedBytes) }}</span>
          </div>
        </section>
        <section class="card" aria-label="Aprovação" data-test="approval">
          <h2>Aprovação</h2>
          <p class="small muted">Cada tier roda separado, com dry-run antes e medição do espaço livre a cada item.</p>
          <fieldset style="border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px">
            <legend class="label-caps" style="margin-bottom: 6px">Tiers aprovados</legend>
            <label v-for="t in planStore.plan.tiers" :key="t.tier" class="kv" style="cursor: pointer">
              <TierBadge :tier="t.tier" />
              <input
                type="checkbox"
                :data-test="`approve-tier-${t.tier}`"
                :checked="planStore.approvedTiers.includes(t.tier)"
                @change="planStore.toggleTier(t.tier)"
              />
            </label>
          </fieldset>
          <div class="divider" />
          <label style="display: flex; gap: 10px; align-items: flex-start; cursor: pointer">
            <input type="checkbox" data-test="ack" style="margin-top: 2px" :checked="planStore.acknowledged" @change="onAck" />
            <span class="small">Revisei itens e riscos. Remover cache também é irreversível.</span>
          </label>
          <button type="button" class="btn btn-primary btn-lg" data-test="approve" :disabled="!planStore.canApprove" @click="approve">
            Aprovar plano
          </button>
          <p v-if="planStore.approveError" class="small err" role="alert" data-test="approve-error">{{ planStore.approveError }}</p>
          <p class="small muted">O plan.json também roda com a skill: <span class="mono">cleanup.ps1 -Plan plan.json -Tier A</span>.</p>
        </section>
      </aside>
    </div>

    <section class="card" aria-label="plan.json">
      <div class="card-head">
        <h2>plan.json</h2>
        <div class="actions">
          <span class="small muted" aria-live="polite" data-test="copy-status">{{ copyStatus }}</span>
          <button type="button" class="btn" data-test="copy-json" @click="copy(planStore.plan.json)">Copiar plan.json</button>
        </div>
      </div>
      <pre class="code" data-test="plan-json">{{ planStore.plan.json }}</pre>
    </section>
  </template>
</template>
