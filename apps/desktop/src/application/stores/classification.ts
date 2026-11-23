import { defineStore } from 'pinia'
import type { CandidateDto, ClassificationDto, Tier } from '../../domain/models'
import { countByTier, defaultSelection, selectionTotal, toggle, toggleTier, totalsByTier } from '../../domain/selection'
import { messageOf } from '../gateway'
import type { AsyncStatus } from './survey'

/** Aba ativa: um tier ou `X` (exclusões). */
export type ClassificationTab = Tier | 'X'

export const useClassificationStore = defineStore('classification', {
  state: () => ({
    status: 'idle' as AsyncStatus,
    report: null as ClassificationDto | null,
    selected: [] as string[],
    activeTab: 'A' as ClassificationTab,
    error: null as string | null,
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
    async load() {
      this.status = 'running'
      this.error = null
      try {
        this.report = await this.gateway.classify()
        this.selected = defaultSelection(this.report.candidates)
        this.status = 'done'
      } catch (e) {
        this.error = messageOf(e)
        this.status = 'error'
      }
    },
    async ensureLoaded() {
      if (this.status === 'idle') await this.load()
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
