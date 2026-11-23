import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import type { ReportDto } from '../../domain/models'
import { errorInfo, type ErrorInfo } from '../../i18n/i18n'
import type { AsyncStatus } from './survey'

export const useReportStore = defineStore('report', {
  state: () => ({
    status: 'idle' as AsyncStatus,
    report: null as ReportDto | null,
    error: null as ErrorInfo | null,
  }),
  actions: {
    async load() {
      this.status = 'running'
      this.error = null
      try {
        this.report = markRaw(await this.gateway.report())
        this.status = 'done'
      } catch (e) {
        this.report = null
        this.error = errorInfo(e)
        this.status = 'error'
      }
    },
  },
})
