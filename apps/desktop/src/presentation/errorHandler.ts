import type { ComponentPublicInstance } from 'vue'

type Log = (...args: unknown[]) => void

/** `app.config.errorHandler` (guia de produção do Vue): erro de render,
 *  watcher ou hook não derruba a janela em silêncio — fica registrado com a
 *  origem (`info`). */
export function vueErrorHandler(log: Log = console.error) {
  return (error: unknown, _instance: ComponentPublicInstance | null, info: string) => {
    log('[disk-cleanup]', info, error)
  }
}
