import { defineStore } from 'pinia'
import type { ReportDto } from '../../domain/models'
import { messageOf } from '../gateway'
import type { AsyncStatus } from './survey'

export const useReportStore = defineStore('report', {
  state: () => ({
    status: 'idle' as AsyncStatus,
    report: null as ReportDto | null,
    error: null as string | null,
  }),
  actions: {
    async load() {
      this.status = 'running'
      this.error = null
      try {
        this.report = await this.gateway.report()
        this.status = 'done'
      } catch (e) {
        this.report = null
        this.error = messageOf(e)
        this.status = 'error'
      }
    },
  },
})
