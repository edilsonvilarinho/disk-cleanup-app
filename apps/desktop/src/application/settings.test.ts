import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { fakeGateway } from '../test/fakeGateway'
import { gatewayPlugin } from './gatewayPlugin'
import { DEFAULT_SETTINGS, sanitizeSettings, settingsPlugin, type SettingsStorage } from './settings'
import { useSettingsStore } from './stores/settings'
import { ThemeController } from './theme'

function memory(initial: unknown = null): SettingsStorage & { saved: unknown[] } {
  const saved: unknown[] = []
  return { saved, load: () => initial, save: (s) => saved.push(structuredClone(s)) }
}

function setup(storage: SettingsStorage) {
  const pinia = createPinia()
  pinia.use(gatewayPlugin(fakeGateway()))
  pinia.use(settingsPlugin(storage))
  createApp({}).use(pinia)
  setActivePinia(pinia)
  return useSettingsStore()
}

describe('sanitizeSettings', () => {
  it('aceita valores válidos e troca inválidos pelo padrão', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS).toEqual({ language: 'auto', theme: 'system', extraExclusions: [], defaultDepth: 2 })
    expect(
      sanitizeSettings({ language: 'en', theme: 'dark', extraExclusions: ['/a', 3, ' ', '/a'], defaultDepth: 1 }),
    ).toEqual({ language: 'en', theme: 'dark', extraExclusions: ['/a'], defaultDepth: 1 })
    expect(sanitizeSettings({ language: 'fr', theme: 'roxo', extraExclusions: 'x', defaultDepth: 7 })).toEqual(DEFAULT_SETTINGS)
  })
})

describe('settings store', () => {
  it('carrega do armazenamento e salva a cada mudança', () => {
    const storage = memory({ language: 'pt', theme: 'light' })
    const store = setup(storage)
    store.load()
    expect(store.language).toBe('pt')
    expect(store.theme).toBe('light')
    store.setLanguage('en')
    store.setTheme('dark')
    store.setDefaultDepth(1)
    expect(storage.saved.at(-1)).toEqual({ language: 'en', theme: 'dark', extraExclusions: [], defaultDepth: 1 })
  })

  it('exclusões extras: aparam espaço, ignoram vazia e repetida (sem diferenciar maiúsculas) e podem ser removidas', () => {
    const storage = memory()
    const store = setup(storage)
    store.load()
    expect(store.addExclusion('  C:\\Projetos  ')).toBe(true)
    expect(store.addExclusion('c:\\projetos')).toBe(false)
    expect(store.addExclusion('   ')).toBe(false)
    expect(store.extraExclusions).toEqual(['C:\\Projetos'])
    store.removeExclusion('C:\\Projetos')
    expect(store.extraExclusions).toEqual([])
    expect(storage.saved).toHaveLength(2)
  })
})

describe('ThemeController', () => {
  it('modo sistema segue a preferência; claro/escuro forçam', () => {
    let dark = true
    const apply = vi.fn()
    const theme = new ThemeController(() => dark, apply)
    theme.setMode('system')
    expect(theme.current.value).toBe('dark')
    dark = false
    theme.refresh()
    expect(theme.current.value).toBe('light')
    expect(apply).toHaveBeenLastCalledWith('light')
    theme.setMode('dark')
    expect(theme.current.value).toBe('dark')
    dark = true
    theme.refresh()
    theme.setMode('light')
    expect(theme.current.value).toBe('light')
    expect(theme.mode).toBe('light')
  })
})
