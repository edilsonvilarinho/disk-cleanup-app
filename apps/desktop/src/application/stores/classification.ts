import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import type { CandidateDto, ClassificationDto, Tier } from '../../domain/models'
import { countByTier, defaultSelection, isIdleEnough, selectionTotal, toggle, toggleTier, totalsByTier } from '../../domain/selection'
import { errorInfo, type ErrorInfo } from '../../i18n/i18n'
import { EMPTY_CLASSIFY_REQUEST, type ClassifyRequest } from '../gateway'
import type { AsyncStatus } from './survey'

/** Aba ativa: um tier ou `X` (exclusões). */
export type ClassificationTab = Tier | 'X'

export const useClassificationStore = defineStore('classification', {
  state: () => ({
    status: 'idle' as AsyncStatus,
    report: null as ClassificationDto | null,
    selected: [] as string[],
    activeTab: 'A' as ClassificationTab,
    error: null as ErrorInfo | null,
  }),
  getters: {
    candidates: (state): CandidateDto[] => state.report?.candidates ?? [],
    total(): { count: number; bytes: number } {
      return selectionTotal(this.candidates, this.selected)
    },
    totals(): ReturnType<typeof totalsByTier> {
      return totalsByTier(this.candidates, this.selected)
    },
    counts(): Record<Tier, number> {
      return countByTier(this.candidates)
    },
    visible(): CandidateDto[] {
      const tab = this.activeTab
      return tab === 'X' ? [] : this.candidates.filter((c) => c.tier === tab)
    },
  },
  actions: {
    async load(request: ClassifyRequest = EMPTY_CLASSIFY_REQUEST, minIdleDays = 90) {
      this.status = 'running'
      this.error = null
      try {
        this.report = markRaw(await this.gateway.classify(request))
        this.selected = defaultSelection(this.report.candidates, minIdleDays)
        this.status = 'done'
      } catch (e) {
        this.error = errorInfo(e)
        this.status = 'error'
      }
    },
    async ensureLoaded(request: ClassifyRequest = EMPTY_CLASSIFY_REQUEST, minIdleDays = 90) {
      if (this.status === 'idle') await this.load(request, minIdleDays)
    },
    /** Remarca só os projetos pela idade mínima; o resto da seleção fica. */
    applyMinIdle(minIdleDays: number) {
      this.selected = this.candidates
        .filter((c) => (c.project === null ? this.selected.includes(c.id) : !c.blocked && isIdleEnough(c, minIdleDays)))
        .map((c) => c.id)
    },
    toggle(id: string) {
      this.selected = toggle(this.selected, id)
    },
    toggleTier(tier: Tier) {
      this.selected = toggleTier(this.selected, this.candidates, tier)
    },
    setTab(tab: ClassificationTab) {
      this.activeTab = tab
    },
  },
})
