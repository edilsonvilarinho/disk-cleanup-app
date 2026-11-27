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
    // Atualização automática vem ligada na instalação; o canal beta, desligado.
    expect(DEFAULT_SETTINGS).toEqual({
      language: 'auto',
      theme: 'system',
      extraExclusions: [],
      defaultDepth: 2,
      autoUpdate: true,
      betaUpdates: false,
      projectRoots: [],
      minIdleDays: 90,
      userRules: [],
      disabledProfiles: [],
      findOrphans: false,
    })
    expect(
      sanitizeSettings({
        language: 'en',
        theme: 'dark',
        extraExclusions: ['/a', 3, ' ', '/a'],
        defaultDepth: 1,
        autoUpdate: false,
        betaUpdates: true,
        projectRoots: [' D:\\dev ', 'D:\\dev', 7],
        minIdleDays: 180,
        userRules: [
          { label: ' Teams ', path: ' C:\\t ', tier: 'A' },
          { label: 'dup', path: 'c:\\T', tier: 'C' },
          { path: 'C:\\d', tier: 'D' },
          { path: '', tier: 'A' },
          { path: 'C:\\sem-nome', tier: 'C', label: 3 },
          'x',
        ],
        disabledProfiles: ['node', 'node', 1],
        findOrphans: true,
      }),
    ).toEqual({
      language: 'en',
      theme: 'dark',
      extraExclusions: ['/a'],
      defaultDepth: 1,
      autoUpdate: false,
      betaUpdates: true,
      projectRoots: ['D:\\dev'],
      minIdleDays: 180,
      userRules: [
        { label: 'Teams', path: 'C:\\t', tier: 'A' },
        { label: '', path: 'C:\\sem-nome', tier: 'C' },
      ],
      disabledProfiles: ['node'],
      findOrphans: true,
    })
    expect(
      sanitizeSettings({ language: 'fr', theme: 'roxo', extraExclusions: 'x', defaultDepth: 7, autoUpdate: 'sim', betaUpdates: 1, projectRoots: 'x', minIdleDays: 45 }),
    ).toEqual(DEFAULT_SETTINGS)
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
    store.setAutoUpdate(false)
    store.setBetaUpdates(true)
    store.setMinIdleDays(365)
    expect(storage.saved.at(-1)).toEqual({
      language: 'en',
      theme: 'dark',
      extraExclusions: [],
      defaultDepth: 1,
      autoUpdate: false,
      betaUpdates: true,
      projectRoots: [],
      minIdleDays: 365,
      userRules: [],
      disabledProfiles: [],
      findOrphans: false,
    })
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

  it('regras próprias não repetem pasta; perfis alternam', () => {
    const storage = memory()
    const store = setup(storage)
    store.load()
    expect(store.addUserRule({ label: ' x ', path: ' C:\\a ', tier: 'C' })).toBe(true)
    expect(store.addUserRule({ label: 'y', path: 'c:\\A', tier: 'A' })).toBe(false)
    expect(store.addUserRule({ label: 'y', path: '  ', tier: 'A' })).toBe(false)
    expect(store.userRules).toEqual([{ label: 'x', path: 'C:\\a', tier: 'C' }])
    expect(store.classifyRequest.userRules).toEqual(store.userRules)
    store.toggleProfile('rust')
    expect(store.disabledProfiles).toEqual(['rust'])
    store.toggleProfile('rust')
    expect(store.disabledProfiles).toEqual([])
    store.removeUserRule('C:\\a')
    expect(store.userRules).toEqual([])
    expect(storage.saved).toHaveLength(4)
  })

  it('pastas de projetos seguem a mesma regra das exclusões', () => {
    const storage = memory()
    const store = setup(storage)
    store.load()
    expect(store.addProjectRoot('  D:\\dev ')).toBe(true)
    expect(store.addProjectRoot('d:\\DEV')).toBe(false)
    expect(store.addProjectRoot('')).toBe(false)
    expect(store.projectRoots).toEqual(['D:\\dev'])
    store.removeProjectRoot('D:\\dev')
    expect(store.projectRoots).toEqual([])
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
