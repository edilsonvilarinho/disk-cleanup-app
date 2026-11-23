import { markRaw } from 'vue'
import type { PiniaPlugin } from 'pinia'

/** Porta de exportação do relatório (segregada do gateway de limpeza). */
export interface ReportExporter {
  /** Abre o diálogo de impressão do sistema ("Salvar como PDF" é uma das saídas). */
  print(): Promise<void>
  /** Rasteriza um SVG autocontido em PNG. */
  renderPng(svg: string, width: number, height: number): Promise<Uint8Array>
  /** Grava onde o usuário escolher; `null` se cancelou. Devolve o caminho/nome gravado. */
  savePng(bytes: Uint8Array, fileName: string): Promise<string | null>
}

declare module 'pinia' {
  export interface PiniaCustomProperties {
    exporter: ReportExporter
  }
}

export function exporterPlugin(exporter: ReportExporter): PiniaPlugin {
  const raw = markRaw(exporter)
  return () => ({ exporter: raw })
}
