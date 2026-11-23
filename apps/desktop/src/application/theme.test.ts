import { describe, expect, it, vi } from 'vitest'
import { ThemeController, type ThemeStorage } from './theme'

function memoryStorage(initial: string | null = null): ThemeStorage & { value: string | null } {
  return {
    value: initial,
    get() {
      return this.value
    },
    set(v) {
      this.value = v
    },
  }
}

describe('ThemeController', () => {
  it('usa o tema salvo e ignora valor salvo inválido', () => {
    const apply = vi.fn()
    expect(new ThemeController(memoryStorage('light'), () => true, apply).init()).toBe('light')
    expect(apply).toHaveBeenCalledWith('light')
    expect(new ThemeController(memoryStorage('roxo'), () => true, apply).init()).toBe('dark')
  })

  it('sem preferência salva, segue o sistema', () => {
    expect(new ThemeController(memoryStorage(), () => false, vi.fn()).init()).toBe('light')
    expect(new ThemeController(memoryStorage(), () => true, vi.fn()).init()).toBe('dark')
  })

  it('alterna, aplica e persiste', () => {
    const storage = memoryStorage('dark')
    const apply = vi.fn()
    const theme = new ThemeController(storage, () => true, apply)
    theme.init()
    expect(theme.toggle()).toBe('light')
    expect(theme.current.value).toBe('light')
    expect(storage.value).toBe('light')
    expect(apply).toHaveBeenLastCalledWith('light')
    expect(theme.toggle()).toBe('dark')
  })
})
