import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import type { ApprovalDto, PlanDto, Tier } from '../../domain/models'
import { TIERS } from '../../domain/selection'
import { errorInfo, type ErrorInfo } from '../../i18n/i18n'
import type { AsyncStatus } from './survey'

export const usePlanStore = defineStore('plan', {
  state: () => ({
    status: 'idle' as AsyncStatus,
    plan: null as PlanDto | null,
    error: null as ErrorInfo | null,
    approvedTiers: [] as Tier[],
    acknowledged: false,
    approval: null as ApprovalDto | null,
    approveError: null as ErrorInfo | null,
  }),
  getters: {
    canApprove: (state): boolean => state.plan !== null && state.approvedTiers.length > 0 && state.acknowledged,
  },
  actions: {
    async build(volume: string, selected: string[]) {
      this.status = 'running'
      this.error = null
      try {
        this.plan = markRaw(await this.gateway.buildPlan(volume, selected))
        this.approvedTiers = this.plan.tiers.map((t) => t.tier)
        this.status = 'done'
      } catch (e) {
        this.plan = null
        this.approvedTiers = []
        this.error = errorInfo(e)
        this.status = 'error'
      }
      // Plano novo nunca herda aprovação: o núcleo também a descarta.
      this.acknowledged = false
      this.approval = null
      this.approveError = null
    },
    toggleTier(tier: Tier) {
      const on = this.approvedTiers.includes(tier)
      this.approvedTiers = TIERS.filter((t) => (t === tier ? !on : this.approvedTiers.includes(t)))
    },
    setAcknowledged(value: boolean) {
      this.acknowledged = value
    },
    async approve() {
      if (!this.plan) return
      try {
        this.approval = await this.gateway.approvePlan([...this.approvedTiers], this.acknowledged)
        this.approveError = null
      } catch (e) {
        this.approval = null
        this.approveError = errorInfo(e)
      }
    },
  },
})
