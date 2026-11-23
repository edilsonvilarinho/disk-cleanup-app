import { defineStore } from 'pinia'
import type { SystemInfoDto } from '../../domain/models'
import { errorInfo, type ErrorInfo } from '../../i18n/i18n'

export const useSystemStore = defineStore('system', {
  state: () => ({
    info: null as SystemInfoDto | null,
    error: null as ErrorInfo | null,
  }),
  actions: {
    async load() {
      if (this.info) return
      try {
        this.info = await this.gateway.systemInfo()
        this.error = null
      } catch (e) {
        this.error = errorInfo(e)
      }
    },
  },
})
