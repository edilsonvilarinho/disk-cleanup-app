<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSurveyStore } from '../../application/stores/survey'
import { useSystemStore } from '../../application/stores/system'
import { formatCount, formatDuration, formatGb, formatPercent } from '../../domain/format'
import type { Health, UsageEntryDto } from '../../domain/models'
import BarList from '../components/BarList.vue'
import KpiCard from '../components/KpiCard.vue'

const system = useSystemStore()
const survey = useSurveyStore()
const depth = ref<1 | 2>(2)

const HEALTH: Record<Health, { label: string; tone: string }> = {
  healthy: { label: 'Saudável', tone: 'ok' },
  warning: { label: 'Atenção', tone: 'warn' },
  critical: { label: 'Crítico', tone: 'err' },
}

const report = computed(() => survey.report)
const health = computed(() => (report.value ? HEALTH[report.value.volume.health] : null))
const bars = (list: UsageEntryDto[]) => list.slice(0, 10).map((e) => ({ name: e.name, bytes: e.logicalBytes }))

function start() {
  if (!system.info) return
  void survey.run({ volumeRoot: system.info.volumeRoot, profile: system.info.profile, depth: depth.value })
}
</script>

<template>
  <header class="page-head">
    <div class="titles">
      <span class="label-caps">Etapa 1 de 5 · somente leitura</span>
      <h1>Survey do volume</h1>
    </div>
    <div class="actions">
      <label class="field muted" for="depth">Profundidade
        <select id="depth" v-model.number="depth" class="select" data-test="depth">
          <option :value="2">2 níveis</option>
          <option :value="1">1 nível</option>
        </select>
      </label>
      <button
        type="button"
        class="btn btn-primary"
        data-test="start-survey"
        :disabled="!system.info || survey.status === 'running'"
        @click="start"
      >
        {{ report ? 'Nova varredura' : 'Iniciar varredura' }}
      </button>
    </div>
  </header>

  <div v-if="survey.status === 'running'" class="note" role="status" aria-live="polite" data-test="survey-progress">
    <span>Varrendo <span class="mono">{{ system.info?.volumeRoot }}</span> · {{ formatCount(survey.progress.files) }} arquivos ·
      {{ formatGb(survey.progress.logicalBytes) }}</span>
  </div>
  <div v-if="survey.status === 'error'" class="note warn-note" role="alert" data-test="survey-error">
    <span>Falha na varredura: {{ survey.error }}</span>
  </div>
  <div v-if="!report && survey.status !== 'running'" class="card empty">
    <h2>Nenhuma varredura ainda</h2>
    <p class="muted">A varredura só lê o disco: mede o volume, as pastas por raiz, o perfil do usuário e as pastas de nuvem (tamanho lógico × real).</p>
  </div>

  <template v-if="report && health">
    <section class="kpis" aria-label="Resumo do volume">
      <KpiCard label="Usado" :value="formatGb(report.volume.usedBytes)" :hint="`de ${formatGb(report.volume.totalBytes)}`" data-test="kpi-used" />
      <KpiCard label="Livre" :value="formatGb(report.volume.freeBytes)">
        <span class="pill" :class="health.tone" data-test="health">
          <span class="dot" />{{ health.label }} · {{ formatPercent(report.volume.freePercent) }} livre
        </span>
      </KpiCard>
      <KpiCard label="Arquivos varridos" :value="formatCount(report.files)" data-test="scan-stats"
        :hint="`${formatCount(report.unreadable)} sem acesso · ${formatDuration(report.elapsedMs)}`" />
      <KpiCard label="Não atribuído" :value="formatGb(report.unattributedBytes)" hint="sistema, metadados e itens sem acesso" />
    </section>

    <section class="card" aria-label="Ocupação">
      <div class="card-head"><h2>Ocupação de {{ system.info?.volumeRoot }}</h2><span class="num">{{ formatPercent(report.volume.usedPercent) }}</span></div>
      <div class="meter" role="img" :aria-label="`${formatPercent(report.volume.usedPercent)} ocupado`">
        <span :style="{ width: `${report.volume.usedPercent}%` }" />
      </div>
    </section>

    <div class="grid-2">
      <section class="card" data-test="roots">
        <div class="card-head"><h2>Por raiz do volume</h2><span class="small muted">GB lógico</span></div>
        <BarList :items="bars(report.roots)" />
      </section>
      <section v-if="report.profile.length" class="card" data-test="profile">
        <div class="card-head"><h2>Perfil do usuário</h2><span class="small muted mono">{{ system.info?.profile }}</span></div>
        <BarList :items="bars(report.profile)" />
      </section>
    </div>

    <section v-if="report.cloud.length" class="card" data-test="cloud">
      <h2>Pastas de nuvem: lógico × real</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th scope="col">Pasta</th><th scope="col" class="num">Lógico</th><th scope="col" class="num">Real</th><th scope="col" class="num">Placeholder</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in report.cloud" :key="c.name">
              <td>{{ c.name }}</td>
              <td class="num">{{ formatGb(c.logicalBytes).replace(' GB', '') }}</td>
              <td class="num" style="font-weight: 600">{{ formatGb(c.allocatedBytes).replace(' GB', '') }}</td>
              <td class="num muted">{{ formatGb(c.placeholderBytes).replace(' GB', '') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="small muted">Use a coluna Real. Espaço de nuvem se libera pelo cliente (“liberar espaço”), nunca por remoção.</p>
    </section>

    <div class="footer-actions">
      <span class="small muted">Totais por raiz são conservadores: pastas de nuvem com placeholder ocupam menos que o tamanho lógico.</span>
      <RouterLink class="btn btn-primary btn-lg" to="/classificacao" data-test="to-classify">Classificar candidatos</RouterLink>
    </div>
  </template>
</template>
