import { defineStore } from 'pinia'
import { errorInfo, type ErrorInfo } from '../../i18n/i18n'

export type ExportStatus = 'idle' | 'busy' | 'saved' | 'cancelled' | 'error'

export interface PngRequest {
  svg: string
  width: number
  height: number
  fileName: string
}

/** Exportação do relatório: PDF pelo diálogo de impressão, PNG pelo "Salvar como". */
export const useExportStore = defineStore('export', {
  state: () => ({
    status: 'idle' as ExportStatus,
    savedPath: null as string | null,
    error: null as ErrorInfo | null,
  }),
  getters: {
    busy: (state) => state.status === 'busy',
  },
  actions: {
    fail(e: unknown) {
      this.error = errorInfo(e)
      this.status = 'error'
    },
    async print() {
      if (this.busy) return
      this.status = 'busy'
      this.error = null
      try {
        await this.exporter.print()
        this.status = 'idle'
      } catch (e) {
        this.fail(e)
      }
    },
    async savePng(request: PngRequest) {
      if (this.busy) return
      this.status = 'busy'
      this.error = null
      this.savedPath = null
      try {
        const bytes = await this.exporter.renderPng(request.svg, request.width, request.height)
        this.savedPath = await this.exporter.savePng(bytes, request.fileName)
        this.status = this.savedPath ? 'saved' : 'cancelled'
      } catch (e) {
        this.fail(e)
      }
    },
  },
})
