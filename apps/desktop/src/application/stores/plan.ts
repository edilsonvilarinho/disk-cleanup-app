import { defineStore } from 'pinia'
import type { PlanDto } from '../../domain/models'
import { messageOf } from '../gateway'
import type { AsyncStatus } from './survey'

export const usePlanStore = defineStore('plan', {
  state: () => ({
    status: 'idle' as AsyncStatus,
    plan: null as PlanDto | null,
    error: null as string | null,
  }),
  actions: {
    async build(volume: string, selected: string[]) {
      this.status = 'running'
      this.error = null
      try {
        this.plan = await this.gateway.buildPlan(volume, selected)
        this.status = 'done'
      } catch (e) {
        this.plan = null
        this.error = messageOf(e)
        this.status = 'error'
      }
    },
  },
})
