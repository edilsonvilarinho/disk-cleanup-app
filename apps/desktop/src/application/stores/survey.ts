import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import type { ScanProgressDto, SurveyDto } from '../../domain/models'
import type { SurveyRequest } from '../gateway'
import { errorInfo, type ErrorInfo } from '../../i18n/i18n'

export type AsyncStatus = 'idle' | 'running' | 'done' | 'error'

export const useSurveyStore = defineStore('survey', {
  state: () => ({
    status: 'idle' as AsyncStatus,
    report: null as SurveyDto | null,
    progress: { files: 0, logicalBytes: 0 } as ScanProgressDto,
    error: null as ErrorInfo | null,
  }),
  actions: {
    async run(request: SurveyRequest) {
      this.status = 'running'
      this.error = null
      this.progress = { files: 0, logicalBytes: 0 }
      try {
        this.report = markRaw(await this.gateway.runSurvey(request, (p) => {
          this.progress = p
        }))
        this.status = 'done'
      } catch (e) {
        this.error = errorInfo(e)
        this.status = 'error'
      }
    },
  },
})
