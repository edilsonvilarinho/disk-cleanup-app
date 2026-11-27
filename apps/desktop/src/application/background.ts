// Porta do segundo plano: espaço livre sem varrer, aviso do sistema e bandeja.
// Só mede e avisa; nenhuma limpeza é executada daqui.
import type { PiniaPlugin } from 'pinia'
import { markRaw } from 'vue'
import type { VolumeDto } from '../domain/models'

/** Textos do menu da bandeja, já traduzidos (o núcleo não formata frase). */
export interface TrayLabels {
  open: string
  scan: string
  quit: string
  tooltip: string
}

export interface BackgroundPort {
  volumeUsage(volumeRoot: string): Promise<VolumeDto>
  notify(title: string, body: string): Promise<void>
  /** Liga/desliga a bandeja e o "fechar para a bandeja". */
  setBackground(enabled: boolean, labels: TrayLabels): Promise<void>
  /** "Varrer agora" na bandeja; devolve a função que para de ouvir. */
  onTrayScan(callback: () => void): Promise<() => void>
}

declare module 'pinia' {
  export interface PiniaCustomProperties {
    background: BackgroundPort
  }
}

export function backgroundPlugin(port: BackgroundPort): PiniaPlugin {
  const raw = markRaw(port)
  return () => ({ background: raw })
}
