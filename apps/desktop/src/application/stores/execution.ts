import { defineStore } from 'pinia'
import type { ItemResultDto, StepDto, Tier, TierRunDto } from '../../domain/models'
import { messageOf } from '../gateway'

/** Execução tier a tier: dry-run, confirmação explícita, eventos ao vivo. */
export const useExecutionStore = defineStore('execution', {
  state: () => ({
    tiers: [] as Tier[],
    previews: {} as Partial<Record<Tier, StepDto[]>>,
    runs: {} as Partial<Record<Tier, TierRunDto>>,
    live: {} as Record<string, ItemResultDto | 'running'>,
    confirming: null as Tier | null,
    running: null as Tier | null,
    error: null as string | null,
  }),
  getters: {
    nextTier: (state): Tier | null => state.tiers.find((t) => !state.runs[t]) ?? null,
    finished(): boolean {
      return this.tiers.length > 0 && this.nextTier === null
    },
    totalFreed: (state): number => Object.values(state.runs).reduce((sum, r) => sum + (r?.freedBytes ?? 0), 0),
  },
  actions: {
    reset(tiers: Tier[]) {
      this.tiers = [...tiers]
      this.previews = {}
      this.runs = {}
      this.live = {}
      this.confirming = null
      this.running = null
      this.error = null
    },
    async loadPreview(tier: Tier) {
      try {
        this.previews[tier] = await this.gateway.previewTier(tier)
      } catch (e) {
        this.error = messageOf(e)
      }
    },
    request(tier: Tier) {
      this.confirming = tier
    },
    cancel() {
      this.confirming = null
    },
    /** Só executa o tier que o usuário pediu e confirmou. */
    async confirm(tier: Tier) {
      if (this.confirming !== tier) return
      this.confirming = null
      this.running = tier
      this.error = null
      try {
        this.runs[tier] = await this.gateway.executeTier(tier, (event) => {
          this.live[event.id] = event.kind === 'started' || !event.result ? 'running' : event.result
        })
      } catch (e) {
        this.error = messageOf(e)
      } finally {
        this.running = null
      }
    },
  },
})
