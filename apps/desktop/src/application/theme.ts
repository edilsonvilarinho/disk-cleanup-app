import { ref, type Ref } from 'vue'
import type { ThemeMode } from './settings'

export type Theme = 'light' | 'dark'

/** Resolve o modo (sistema/claro/escuro) para o tema aplicado. A preferência
 *  é persistida pelas Configurações; aqui só se resolve e aplica. */
export class ThemeController {
  readonly current: Ref<Theme> = ref('dark')
  mode: ThemeMode = 'system'

  constructor(
    private readonly prefersDark: () => boolean,
    private readonly apply: (theme: Theme) => void,
  ) {}

  setMode(mode: ThemeMode) {
    this.mode = mode
    this.refresh()
  }

  /** Reaplica (ex.: o sistema trocou entre claro e escuro). */
  refresh() {
    const theme: Theme = this.mode === 'system' ? (this.prefersDark() ? 'dark' : 'light') : this.mode
    this.current.value = theme
    this.apply(theme)
  }
}
