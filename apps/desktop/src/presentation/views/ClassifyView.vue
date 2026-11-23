<script setup lang="ts">
import { onMounted } from 'vue'
import { useClassificationStore, type ClassificationTab } from '../../application/stores/classification'
import { formatGb } from '../../domain/format'
import { TIER_LABEL, TIERS } from '../../domain/selection'
import { riskLabel } from '../labels'
import TierBadge from '../components/TierBadge.vue'

const store = useClassificationStore()
onMounted(() => store.ensureLoaded())

const tabs: { id: ClassificationTab; label: string }[] = [
  ...TIERS.map((t) => ({ id: t as ClassificationTab, label: `${t} · ${TIER_LABEL[t]}` })),
  { id: 'X', label: 'Exclusões' },
]
</script>

<template>
  <header class="page-head">
    <div class="titles">
      <span class="label-caps">Etapa 2 de 5 · somente leitura</span>
      <h1>Classificação dos candidatos</h1>
    </div>
    <div class="actions">
      <button type="button" class="btn" data-test="reclassify" :disabled="store.status === 'running'" @click="store.load()">Reclassificar</button>
    </div>
  </header>

  <div class="note" role="note">
    <span>Candidatos a verificar, não lista de execução. O caminho existir no disco não prova que ele está sem uso.</span>
  </div>

  <div v-if="store.status === 'running'" class="note" role="status" data-test="classify-loading">Medindo os caminhos do catálogo…</div>
  <div v-if="store.status === 'error'" class="note warn-note" role="alert" data-test="classify-error">
    <span>Falha na classificação: {{ store.error }}</span>
    <button type="button" class="btn" data-test="retry" @click="store.load()">Tentar de novo</button>
  </div>

  <div v-if="store.report" class="grid-aside">
    <section class="card" aria-label="Candidatos por tier">
      <div class="tabs" role="tablist" aria-label="Tiers">
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
            <thead><tr><th scope="col">Caminho</th><th scope="col">Motivo</th></tr></thead>
            <tbody>
              <tr v-for="ex in store.report.exclusions" :key="ex.pattern">
                <td class="mono small">{{ ex.pattern }}</td>
                <td class="small">{{ ex.reason }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <template v-else>
        <div class="card-head">
          <p class="small muted">Itens bloqueados não podem entrar no plano.</p>
          <button type="button" class="btn" data-test="toggle-tier" @click="store.toggleTier(store.activeTab)">Marcar/desmarcar tier</button>
        </div>
        <p v-if="store.visible.length === 0" class="muted" data-test="tier-empty">Nenhum candidato neste tier.</p>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col"><span class="sr-only">Selecionar</span></th>
                <th scope="col">Item</th>
                <th scope="col" class="num">GB</th>
                <th scope="col">Risco</th>
                <th scope="col">Observação</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in store.visible" :key="c.id" :class="{ blocked: c.blockedReason }" data-test="row">
                <td>
                  <input
                    :id="`c-${c.id}`"
                    type="checkbox"
                    :checked="!c.blockedReason && store.selected.includes(c.id)"
                    :disabled="!!c.blockedReason"
                    @change="store.toggle(c.id)"
                  />
                </td>
                <td>
                  <label :for="`c-${c.id}`">{{ c.label }}</label>
                  <span class="path">{{ c.target }}</span>
                </td>
                <td class="num">{{ formatGb(c.sizeBytes).replace(' GB', '') }}</td>
                <td class="small">{{ riskLabel(c.risk) }}</td>
                <td>
                  <span v-if="c.blockedReason" class="pill warn"><span class="dot" />bloqueado: {{ c.blockedReason }}</span>
                  <span v-else class="small muted">{{ c.note }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <details v-if="store.report.skipped.length" data-test="skipped">
        <summary>Regras sem candidato ({{ store.report.skipped.length }})</summary>
        <ul class="checklist small">
          <li v-for="s in store.report.skipped" :key="s.id"><span class="mono">{{ s.id }}</span><span class="muted">{{ s.reason }}</span></li>
        </ul>
      </details>
    </section>

    <aside style="display: flex; flex-direction: column; gap: 16px">
      <section class="card" aria-label="Seleção">
        <h2>Seleção</h2>
        <div v-for="t in store.totals" :key="t.tier" class="kv">
          <TierBadge :tier="t.tier" />
          <span class="small"><span class="muted">{{ t.count }} {{ t.count === 1 ? 'item' : 'itens' }}</span> · <span class="num">{{ formatGb(t.bytes) }}</span></span>
        </div>
        <div class="divider" />
        <div class="kv" style="font-weight: 600" data-test="total">
          <span>Total estimado</span><span class="num" style="font-size: 18px">{{ formatGb(store.total.bytes) }}</span>
        </div>
        <span class="small muted">{{ store.total.count }} itens selecionados</span>
        <RouterLink class="btn btn-primary btn-lg" to="/plano" data-test="to-plan">Montar plano</RouterLink>
      </section>
    </aside>
  </div>
</template>
