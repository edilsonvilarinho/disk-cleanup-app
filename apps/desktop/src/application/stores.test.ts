import { createPinia, setActivePinia } from 'pinia'
import { createApp } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GIB } from '../domain/format'
import { classification, plan, survey, systemInfo } from '../test/fixtures'
import { fakeGateway } from '../test/fakeGateway'
import type { DiskCleanupGateway } from './gateway'
import { gatewayPlugin } from './gatewayPlugin'
import { useClassificationStore } from './stores/classification'
import { usePlanStore } from './stores/plan'
import { useSurveyStore } from './stores/survey'
import { useSystemStore } from './stores/system'

function setup(gateway: DiskCleanupGateway = fakeGateway()) {
  // Plugins do Pinia só valem depois de instalado num app.
  const pinia = createPinia()
  pinia.use(gatewayPlugin(gateway))
  createApp({}).use(pinia)
  setActivePinia(pinia)
  return gateway
}

const fail = (message: string) => vi.fn(async () => Promise.reject(new Error(message)))

describe('system store', () => {
  beforeEach(() => setup())

  it('carrega as informações do sistema uma única vez', async () => {
    const gateway = setup()
    const store = useSystemStore()
    await store.load()
    await store.load()
    expect(store.info).toEqual(systemInfo)
    expect(gateway.systemInfo).toHaveBeenCalledTimes(1)
  })

  it('guarda a mensagem de erro', async () => {
    setup(fakeGateway({ systemInfo: fail('sem IPC') }))
    const store = useSystemStore()
    await store.load()
    expect(store.error).toBe('sem IPC')
    expect(store.info).toBeNull()
  })
})

describe('survey store', () => {
  it('executa a varredura, acompanha o progresso e guarda o relatório', async () => {
    const gateway = setup()
    const store = useSurveyStore()
    expect(store.status).toBe('idle')
    const run = store.run({ volumeRoot: 'C:\\', profile: 'C:\\Users\\u', depth: 2 })
    expect(store.status).toBe('running')
    await run
    expect(gateway.runSurvey).toHaveBeenCalledWith(
      { volumeRoot: 'C:\\', profile: 'C:\\Users\\u', depth: 2 },
      expect.any(Function),
    )
    expect(store.progress).toEqual({ files: 10_000, logicalBytes: 1024 })
    expect(store.status).toBe('done')
    expect(store.report).toEqual(survey)
  })

  it('reporta falha e aceita erro que não é Error', async () => {
    setup(fakeGateway({ runSurvey: fail('volume não encontrado') }))
    const store = useSurveyStore()
    await store.run({ volumeRoot: 'Z:\\', profile: null, depth: 1 })
    expect(store.status).toBe('error')
    expect(store.error).toBe('volume não encontrado')

    setup(fakeGateway({ runSurvey: vi.fn(async () => Promise.reject('texto puro')) }))
    const other = useSurveyStore()
    await other.run({ volumeRoot: 'C:\\', profile: null, depth: 1 })
    expect(other.error).toBe('texto puro')
  })
})

describe('classification store', () => {
  it('carrega, seleciona o que não está bloqueado e calcula totais', async () => {
    setup()
    const store = useClassificationStore()
    expect(store.total).toEqual({ count: 0, bytes: 0 })
    await store.load()
    expect(store.status).toBe('done')
    expect(store.selected).toEqual(['npm-cache', 'nvidia-dxcache', 'gradle-caches'])
    expect(store.total.count).toBe(3)
    expect(store.total.bytes).toBeCloseTo(25.4 * GIB, -3)
    expect(store.counts).toEqual({ A: 2, B: 0, C: 2, D: 0 })
    expect(store.totals.find((t) => t.tier === 'C')!.count).toBe(1)
  })

  it('alterna item, tier e aba; lista candidatos da aba ativa', async () => {
    setup()
    const store = useClassificationStore()
    await store.load()
    store.toggle('npm-cache')
    expect(store.selected).not.toContain('npm-cache')
    store.toggleTier('A')
    expect(store.selected).toEqual(expect.arrayContaining(['npm-cache', 'nvidia-dxcache']))
    expect(store.activeTab).toBe('A')
    expect(store.visible.map((c) => c.id)).toEqual(['npm-cache', 'nvidia-dxcache'])
    store.setTab('C')
    expect(store.visible.map((c) => c.id)).toEqual(['gradle-caches', 'cuda'])
    store.setTab('X')
    expect(store.visible).toEqual([])
  })

  it('ensureLoaded só busca quando ainda não carregou', async () => {
    const gateway = setup()
    const store = useClassificationStore()
    await store.ensureLoaded()
    await store.ensureLoaded()
    expect(gateway.classify).toHaveBeenCalledTimes(1)
  })

  it('reporta falha da classificação', async () => {
    setup(fakeGateway({ classify: fail('catálogo inválido') }))
    const store = useClassificationStore()
    await store.load()
    expect(store.status).toBe('error')
    expect(store.error).toBe('catálogo inválido')
    expect(store.visible).toEqual([])
  })
})

describe('plan store', () => {
  it('monta o plano com o volume e a seleção', async () => {
    const gateway = setup()
    const store = usePlanStore()
    await store.build('C:', ['npm-cache'])
    expect(gateway.buildPlan).toHaveBeenCalledWith('C:', ['npm-cache'])
    expect(store.status).toBe('done')
    expect(store.plan).toEqual(plan)
  })

  it('reporta falha ao montar o plano', async () => {
    setup(fakeGateway({ buildPlan: fail('nenhum item selecionado') }))
    const store = usePlanStore()
    await store.build('C:', [])
    expect(store.status).toBe('error')
    expect(store.error).toBe('nenhum item selecionado')
    expect(store.plan).toBeNull()
  })
})

describe('fixtures', () => {
  it('mantêm o total selecionável coerente', () => {
    expect(classification.selectableBytes).toBeCloseTo(25.4 * GIB, -3)
  })
})
