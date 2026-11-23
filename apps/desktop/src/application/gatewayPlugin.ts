import { markRaw } from 'vue'
import type { PiniaPlugin } from 'pinia'
import type { DiskCleanupGateway } from './gateway'

declare module 'pinia' {
  export interface PiniaCustomProperties {
    gateway: DiskCleanupGateway
  }
}

/** Injeta o gateway em todos os stores (`this.gateway`): troca por fake nos testes. */
export function gatewayPlugin(gateway: DiskCleanupGateway): PiniaPlugin {
  const raw = markRaw(gateway)
  return () => ({ gateway: raw })
}
