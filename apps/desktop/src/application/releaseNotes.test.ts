import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import type { ReleaseNotes } from '../domain/releaseNotes'
import { fakeGateway } from '../test/fakeGateway'
import { gatewayPlugin } from './gatewayPlugin'
import { historyPlugin, memoryHistoryStorage } from './history'
import { settingsPlugin, type Settings } from './settings'
import { useReleaseNotesStore } from './stores/releaseNotes'
import { useSettingsStore } from './stores/settings'
import { RELEASE_NOTES } from '../releaseNotes/catalog'

const text = (s: string) => ({ pt: s, en: s })
function notes(version: string, kinds: ('new' | 'fixed' | 'known')[]): ReleaseNotes {
  return {
    version,
    date: '2026-11-27',
    headline: text(version),
    summary: text(version),
    items: kinds.map((kind, i) => ({ id: `${version}-${i}`, kind, area: text('a'), title: text('t'), body: text('b') })),
  }
}
const CATALOG = [notes('0.3.0', ['new', 'fixed']), notes('0.2.0', ['new', 'known']), notes('0.1.0', ['new'])]

function setup(saved: Partial<Settings> | null, history: unknown = null) {
  const writes: Settings[] = []
  const pinia = createPinia()
  pinia.use(gatewayPlugin(fakeGateway()))
  pinia.use(settingsPlugin({ load: () => saved, save: (s) => writes.push(structuredClone(s)) }))
  pinia.use(historyPlugin(memoryHistoryStorage(history)))
  createApp({}).use(pinia)
  setActivePinia(pinia)
  const settings = useSettingsStore()
  settings.load()
  return { notes: useReleaseNotesStore(), settings, writes }
}

describe('notas de versão (store)', () => {
  it('depois de atualizar: aviso, selo e contagens; grava "vista" só ao dispensar', () => {
    const { notes, settings, writes } = setup({ seenVersion: '0.1.0' })
    notes.startup('0.3.0', CATALOG)
    expect(notes.pending.map((n) => n.version)).toEqual(['0.3.0', '0.2.0'])
    expect(notes.notice).toBe(true)
    expect(notes.chip).toBe(true)
    expect(notes.counts).toEqual({ new: 2, fixed: 1, known: 1 })
    expect(writes).toHaveLength(0)
    notes.dismiss()
    expect(notes.notice).toBe(false)
    expect(settings.seenVersion).toBe('0.3.0')
    // Dispensar o aviso mantém o selo até abrir a gaveta.
    expect(notes.chip).toBe(true)
  })

  it('abrir a gaveta grava "vista", some com o aviso e o selo; abas = versões novas', () => {
    const { notes, settings } = setup({ seenVersion: '0.1.0' })
    notes.startup('0.3.0', CATALOG)
    notes.open(undefined, 'fixed')
    expect(notes.drawer).toEqual({ version: '0.3.0', filter: 'fixed' })
    expect(notes.notice).toBe(false)
    expect(notes.chip).toBe(false)
    expect(settings.seenVersion).toBe('0.3.0')
    expect(notes.shown?.version).toBe('0.3.0')
    expect(notes.tabs.map((n) => n.version)).toEqual(['0.3.0', '0.2.0'])
    notes.setVersion('0.2.0')
    expect(notes.drawer).toEqual({ version: '0.2.0', filter: 'all' })
    notes.setFilter('known')
    expect(notes.drawer?.filter).toBe('known')
    notes.close()
    expect(notes.drawer).toBeNull()
    expect(notes.shown).toBeNull()
    expect(notes.tabs).toEqual([])
    // Sem gaveta aberta, trocar versão ou filtro não faz nada.
    notes.setVersion('0.1.0')
    notes.setFilter('new')
    expect(notes.drawer).toBeNull()
  })

  it('pelo histórico em Configurações: só a versão escolhida, sem tocar em "vista"', () => {
    const { notes, writes } = setup({ seenVersion: '0.3.0' })
    notes.startup('0.3.0', CATALOG)
    expect(notes.notice).toBe(false)
    expect(notes.chip).toBe(false)
    notes.open('0.1.0')
    expect(notes.tabs.map((n) => n.version)).toEqual(['0.1.0'])
    expect(writes).toHaveLength(0)
    notes.close()
    // Sem versão pedida e sem pendência: abre a mais recente do catálogo.
    notes.open()
    expect(notes.drawer?.version).toBe('0.3.0')
  })

  it('instalação nova grava a versão e não mostra; quem já tinha histórico vê a versão atual', () => {
    const fresh = setup(null)
    fresh.notes.startup('0.3.0', CATALOG)
    expect(fresh.notes.notice).toBe(false)
    expect(fresh.settings.seenVersion).toBe('0.3.0')

    const legacy = setup(null, [{ id: 'x' }])
    // Histórico inválido não conta como uso anterior...
    legacy.notes.startup('0.3.0', CATALOG)
    expect(legacy.notes.notice).toBe(false)

    // ...preferências salvas contam.
    const old = setup({ language: 'pt' })
    old.notes.startup('0.3.0', CATALOG)
    expect(old.notes.pending.map((n) => n.version)).toEqual(['0.3.0'])
  })

  it('desligado nas Configurações: não mostra e registra a versão', () => {
    const { notes, settings } = setup({ seenVersion: '0.1.0', releaseNotes: false })
    notes.startup('0.3.0', CATALOG)
    expect(notes.notice).toBe(false)
    expect(settings.seenVersion).toBe('0.3.0')
  })

  it('roda uma vez por sessão; sem versão (falha do updater) não faz nada', () => {
    const { notes } = setup({ seenVersion: '0.1.0' })
    notes.startup(null, CATALOG)
    expect(notes.current).toBeNull()
    notes.startup('0.2.0', CATALOG)
    notes.startup('0.3.0', CATALOG)
    expect(notes.current).toBe('0.2.0')
    expect(notes.pending.map((n) => n.version)).toEqual(['0.2.0'])
  })

  it('versão instalada no catálogo ignora metadado de build (+demo)', () => {
    const { notes } = setup({ seenVersion: '0.1.0' })
    expect(notes.installed).toBeNull()
    notes.startup('0.2.0+demo', CATALOG)
    expect(notes.installed).toBe('0.2.0')
    expect(notes.pending.map((n) => n.version)).toEqual(['0.2.0'])
  })

  it('usa o catálogo empacotado por padrão', () => {
    const { notes } = setup({ seenVersion: '0.0.1' })
    notes.startup(RELEASE_NOTES[0]!.version)
    expect(notes.pending[0]).toEqual(RELEASE_NOTES[0])
    const empty = setup({ seenVersion: '0.0.1' })
    empty.notes.startup('0.0.2', [])
    empty.notes.open()
    expect(empty.notes.drawer).toBeNull()
  })
})
