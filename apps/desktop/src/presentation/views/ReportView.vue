<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { messageOf } from '../../application/gateway'
import { useReportStore } from '../../application/stores/report'
import { formatGb, formatPercent, formatSignedGb } from '../../domain/format'
import { reportMarkdown } from '../../domain/report'
import TierBadge from '../components/TierBadge.vue'

const store = useReportStore()
const copyStatus = ref('')
onMounted(() => store.load())

async function copy() {
  try {
    await navigator.clipboard.writeText(reportMarkdown(store.report!))
    copyStatus.value = 'Copiado'
  } catch (e) {
    copyStatus.value = `Falha ao copiar: ${messageOf(e)}`
  }
}
</script>

<template>
  <header class="page-head">
    <div class="titles">
      <span class="label-caps">Etapa 5 de 5 · relatório</span>
      <h1>Relatório da limpeza</h1>
    </div>
    <div v-if="store.report" class="actions">
      <span class="small muted" aria-live="polite" data-test="copy-report-status">{{ copyStatus }}</span>
      <button type="button" class="btn" data-test="copy-report" @click="copy">Copiar relatório (Markdown)</button>
    </div>
  </header>

  <div v-if="store.status === 'error'" class="card empty" data-test="report-error">
    <h2>Sem relatório</h2>
    <p class="muted">{{ store.error }}. Execute ao menos um tier aprovado.</p>
    <RouterLink class="btn btn-primary" to="/execucao">Ir para a Execução</RouterLink>
  </div>

  <template v-if="store.report">
    <section class="kpis" aria-label="Resultado">
      <div class="kpi"><span class="small muted">Liberado</span><span class="value" data-test="report-freed">{{ formatSignedGb(store.report.freedBytes) }}</span><span class="small muted">previsto {{ formatGb(store.report.estimatedBytes) }}</span></div>
      <div class="kpi"><span class="small muted">Livre</span><span class="value">{{ formatGb(store.report.last.freeBytes) }}</span><span class="small muted">antes {{ formatGb(store.report.initial.freeBytes) }}</span></div>
      <div class="kpi"><span class="small muted">Ocupação</span><span class="value">{{ formatPercent(store.report.last.usedPercent) }}</span><span class="small muted">antes {{ formatPercent(store.report.initial.usedPercent) }}</span></div>
      <div class="kpi"><span class="small muted">Pendências</span><span class="value">{{ store.report.pending.length }}</span><span class="small muted">{{ store.report.itemCount }} itens executados</span></div>
    </section>

    <section class="card" data-test="report-tiers">
      <div class="card-head"><h2>Liberado por tier</h2><span class="small muted">medido × previsto</span></div>
      <div v-for="run in store.report.runs" :key="run.tier" class="kv">
        <TierBadge :tier="run.tier" />
        <span class="num">{{ formatSignedGb(run.freedBytes) }} <span class="muted">/ {{ formatGb(run.estimatedBytes) }}</span></span>
      </div>
    </section>

    <div class="grid-2">
      <section class="card" data-test="report-blocked">
        <h2>Decisões que divergiram do plano</h2>
        <ul v-if="store.report.blocked.length" class="checklist small">
          <li v-for="c in store.report.blocked" :key="c.id"><strong>{{ c.label }}</strong><span class="muted">mantido: {{ c.blockedReason }}</span></li>
        </ul>
        <p v-else class="muted">Nenhuma divergência.</p>
      </section>
      <section class="card" data-test="report-pending">
        <h2>Pendências</h2>
        <ul v-if="store.report.pending.length" class="checklist small">
          <li v-for="i in store.report.pending" :key="i.id"><strong>{{ i.label }}</strong><span class="muted">{{ i.status }}: {{ i.detail }}</span></li>
        </ul>
        <p v-else class="muted">Nenhuma pendência.</p>
      </section>
    </div>

    <section class="card" data-test="report-untouched">
      <h2>Não tocado (deliberado)</h2>
      <ul class="checklist small">
        <li v-for="e in store.report.exclusions" :key="e.pattern"><span class="mono">{{ e.pattern }}</span><span class="muted">{{ e.reason }}</span></li>
      </ul>
    </section>
  </template>
</template>
