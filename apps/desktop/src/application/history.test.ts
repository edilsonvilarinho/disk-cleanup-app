import { createPinia, setActivePinia } from 'pinia'
import { createApp } from 'vue'
import { describe, expect, it } from 'vitest'
import { GIB } from '../domain/format'
import { fakeGateway } from '../test/fakeGateway'
import { survey, systemInfo } from '../test/fixtures'
import { gatewayPlugin } from './gatewayPlugin'
import { historyPlugin, memoryHistoryStorage, type HistoryStorage } from './history'
import { useHistoryStore } from './stores/history'
import { useSurveyStore } from './stores/survey'

function setup(storage: HistoryStorage = memoryHistoryStorage(), gateway = fakeGateway()) {
  const pinia = createPinia()
  pinia.use(gatewayPlugin(gateway))
  pinia.use(historyPlugin(storage))
  createApp({}).use(pinia)
  setActivePinia(pinia)
  return storage
}

const request = { volumeRoot: 'C:\\', profile: systemInfo.profile, depth: 2 as const }
const at = (day: number) => new Date(Date.UTC(2026, 10, day, 12))
const withUsed = (gb: number) => ({ ...survey, volume: { ...survey.volume, usedBytes: gb * GIB } })

describe('history store', () => {
  it('grava, persiste e devolve o id; a anterior é encontrada pelo id', () => {
    const storage = memoryHistoryStorage()
    setup(storage)
    const store = useHistoryStore()
    const first = store.record(withUsed(600), request, at(20))
    const second = store.record(withUsed(615), request, at(23))
    expect(store.snapshots.map((s) => s.id)).toEqual([first, second])
    expect(storage.saved.at(-1)).toHaveLength(2)
    expect(store.previousOf(second)?.id).toBe(first)
    expect(store.previousOf(first)).toBeNull()
    expect(store.saveFailed).toBe(false)
  })

  it('compara penúltima → última por padrão e respeita a escolha do usuário', () => {
    setup()
    const store = useHistoryStore()
    expect(store.comparison).toBeNull()
    const a = store.record(withUsed(600), request, at(10))
    expect(store.comparison).toBeNull()
    const b = store.record(withUsed(610), request, at(15))
    const c = store.record(withUsed(615), request, at(20))
    expect(store.comparison?.usedDelta).toBe(5 * GIB)
    store.select(a, c)
    expect(store.comparison?.usedDelta).toBe(15 * GIB)
    store.select(b, b)
    expect(store.comparison).toBeNull()
    store.remove(b)
    expect(store.from?.id).toBe(a)
    expect(store.to?.id).toBe(c)
  })

  it('carrega do armazenamento descartando registros inválidos, uma única vez', () => {
    const seed = memoryHistoryStorage()
    setup(seed)
    useHistoryStore().record(survey, request, at(1))
    const persisted = [...seed.saved.at(-1)!, { id: 'quebrado' }]

    setup(memoryHistoryStorage(persisted))
    const store = useHistoryStore()
    store.load()
    store.load()
    expect(store.snapshots).toHaveLength(1)
  })

  it('limpa tudo e avisa quando não consegue gravar', () => {
    setup({ load: () => null, save: () => false })
    const store = useHistoryStore()
    store.record(survey, request, at(1))
    expect(store.saveFailed).toBe(true)
    store.clear()
    expect(store.snapshots).toEqual([])
    expect(store.latest).toBeNull()
  })
})

describe('survey → histórico', () => {
  it('toda varredura concluída entra no histórico; falha não entra', async () => {
    setup()
    const surveyStore = useSurveyStore()
    await surveyStore.run(request)
    const history = useHistoryStore()
    expect(history.snapshots).toHaveLength(1)
    expect(surveyStore.historyId).toBe(history.latest?.id)
    expect(history.latest?.profilePath).toBe(systemInfo.profile)

    setup(memoryHistoryStorage(), fakeGateway({ runSurvey: async () => Promise.reject(new Error('sem acesso')) }))
    await useSurveyStore().run(request)
    expect(useHistoryStore().snapshots).toEqual([])
  })
})
