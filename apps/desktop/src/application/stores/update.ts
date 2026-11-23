import { defineStore } from 'pinia'
import type { UpdateInfo, UpdateProgress } from '../../domain/models'
import { errorInfo, type ErrorInfo } from '../../i18n/i18n'

export type UpdateStatus = 'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'ready' | 'installing' | 'error'

const BUSY: readonly UpdateStatus[] = ['checking', 'downloading', 'installing']

export const useUpdateStore = defineStore('update', {
  state: () => ({
    version: null as string | null,
    status: 'idle' as UpdateStatus,
    available: null as UpdateInfo | null,
    progress: null as UpdateProgress | null,
    error: null as ErrorInfo | null,
  }),
  getters: {
    busy: (state) => BUSY.includes(state.status),
  },
  actions: {
    fail(e: unknown) {
      this.error = errorInfo(e)
      this.status = 'error'
    },
    async loadVersion() {
      try {
        this.version = await this.updater.appVersion()
      } catch {
        this.version = null
      }
    },
    async check(beta: boolean) {
      if (this.busy) return
      this.status = 'checking'
      this.error = null
      try {
        this.available = await this.updater.check(beta)
        this.status = this.available ? 'available' : 'upToDate'
      } catch (e) {
        this.fail(e)
      }
    },
    async download() {
      if (this.status !== 'available') return
      this.status = 'downloading'
      this.progress = null
      try {
        await this.updater.download((p) => (this.progress = p))
        this.status = 'ready'
      } catch (e) {
        this.fail(e)
      }
    },
    async install() {
      if (this.status !== 'ready') return
      this.status = 'installing'
      try {
        await this.updater.install()
      } catch (e) {
        this.fail(e)
      }
    },
    /** Na abertura: com atualização automática, verifica e já baixa; instalar fica com o usuário. */
    async startup(autoUpdate: boolean, beta: boolean) {
      await this.loadVersion()
      if (!autoUpdate) return
      await this.check(beta)
      await this.download()
    },
  },
})
