import { defineStore } from 'pinia'
import type { ScanProgressDto, SurveyDto } from '../../domain/models'
import { messageOf, type SurveyRequest } from '../gateway'

export type AsyncStatus = 'idle' | 'running' | 'done' | 'error'

export const useSurveyStore = defineStore('survey', {
  state: () => ({
    status: 'idle' as AsyncStatus,
    report: null as SurveyDto | null,
    progress: { files: 0, logicalBytes: 0 } as ScanProgressDto,
    error: null as string | null,
  }),
  actions: {
    async run(request: SurveyRequest) {
      this.status = 'running'
      this.error = null
      this.progress = { files: 0, logicalBytes: 0 }
      try {
        this.report = await this.gateway.runSurvey(request, (p) => {
          this.progress = p
        })
        this.status = 'done'
      } catch (e) {
        this.error = messageOf(e)
        this.status = 'error'
      }
    },
  },
})
