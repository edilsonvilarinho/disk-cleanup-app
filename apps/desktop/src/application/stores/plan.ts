import { defineStore } from 'pinia'
import type { ApprovalDto, PlanDto, Tier } from '../../domain/models'
import { TIERS } from '../../domain/selection'
import { messageOf } from '../gateway'
import type { AsyncStatus } from './survey'

export const usePlanStore = defineStore('plan', {
  state: () => ({
    status: 'idle' as AsyncStatus,
    plan: null as PlanDto | null,
    error: null as string | null,
    approvedTiers: [] as Tier[],
    acknowledged: false,
    approval: null as ApprovalDto | null,
    approveError: null as string | null,
  }),
  getters: {
    canApprove: (state): boolean => state.plan !== null && state.approvedTiers.length > 0 && state.acknowledged,
  },
  actions: {
    async build(volume: string, selected: string[]) {
      this.status = 'running'
      this.error = null
      try {
        this.plan = await this.gateway.buildPlan(volume, selected)
        this.approvedTiers = this.plan.tiers.map((t) => t.tier)
        this.status = 'done'
      } catch (e) {
        this.plan = null
        this.approvedTiers = []
        this.error = messageOf(e)
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
        this.approveError = messageOf(e)
      }
    },
  },
})
