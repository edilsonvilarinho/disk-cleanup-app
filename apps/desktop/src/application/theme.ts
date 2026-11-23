import { ref, type Ref } from 'vue'

export type Theme = 'light' | 'dark'

export interface ThemeStorage {
  get(): string | null
  set(value: string): void
}

/** Tema claro/escuro: preferência salva > preferência do sistema. */
export class ThemeController {
  readonly current: Ref<Theme> = ref('dark')

  constructor(
    private readonly storage: ThemeStorage,
    private readonly prefersDark: () => boolean,
    private readonly apply: (theme: Theme) => void,
  ) {}

  init(): Theme {
    const saved = this.storage.get()
    const theme: Theme = saved === 'light' || saved === 'dark' ? saved : this.prefersDark() ? 'dark' : 'light'
    this.set(theme)
    return theme
  }

  toggle(): Theme {
    const next: Theme = this.current.value === 'dark' ? 'light' : 'dark'
    this.set(next)
    this.storage.set(next)
    return next
  }

  private set(theme: Theme) {
    this.current.value = theme
    this.apply(theme)
  }
}
