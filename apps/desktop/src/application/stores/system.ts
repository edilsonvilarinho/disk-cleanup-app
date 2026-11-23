import { defineStore } from 'pinia'
import type { SystemInfoDto } from '../../domain/models'
import { messageOf } from '../gateway'

export const useSystemStore = defineStore('system', {
  state: () => ({
    info: null as SystemInfoDto | null,
    error: null as string | null,
  }),
  actions: {
    async load() {
      if (this.info) return
      try {
        this.info = await this.gateway.systemInfo()
        this.error = null
      } catch (e) {
        this.error = messageOf(e)
      }
    },
  },
})
