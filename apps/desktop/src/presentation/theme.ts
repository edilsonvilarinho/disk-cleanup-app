import { inject, type InjectionKey } from 'vue'
import type { ThemeController } from '../application/theme'

export const THEME_KEY: InjectionKey<ThemeController> = Symbol('theme')

export function useTheme(): ThemeController {
  const theme = inject(THEME_KEY)
  if (!theme) throw new Error('ThemeController não foi fornecido (provide THEME_KEY)')
  return theme
}
