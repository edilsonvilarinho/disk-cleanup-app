import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { approval, plan, report, runA, runC, stepsA } from '../test/fixtures'
import { fakeGateway } from '../test/fakeGateway'
import type { DiskCleanupGateway } from './gateway'
import { gatewayPlugin } from './gatewayPlugin'
import { useExecutionStore } from './stores/execution'
import { usePlanStore } from './stores/plan'
import { useReportStore } from './stores/report'

function setup(gateway: DiskCleanupGateway = fakeGateway()) {
  const pinia = createPinia()
  pinia.use(gatewayPlugin(gateway))
  createApp({}).use(pinia)
  setActivePinia(pinia)
  return gateway
}

const fail = (message: string) => vi.fn(async () => Promise.reject(new Error(message)))

describe('aprovação (plan store)', () => {
  it('aprova só com tier marcado e ciência; guarda a aprovação', async () => {
    const gateway = setup()
    const store = usePlanStore()
    await store.build('C:', ['npm-cache'])
    expect(store.approvedTiers).toEqual(['A', 'C'])
    expect(store.canApprove).toBe(false)
    store.setAcknowledged(true)
    expect(store.canApprove).toBe(true)
    store.toggleTier('A')
    store.toggleTier('C')
    expect(store.canApprove).toBe(false)
    store.toggleTier('C')
    await store.approve()
    expect(gateway.approvePlan).toHaveBeenCalledWith(['C'], true)
    expect(store.approval).toEqual(approval)
    expect(store.approveError).toBeNull()
  })

  it('não aprova sem plano e mostra erro do núcleo', async () => {
    setup(fakeGateway({ approvePlan: fail('revisão do plano não confirmada') }))
    const store = usePlanStore()
    await store.approve()
    expect(store.approval).toBeNull()
    store.plan = plan
    store.approvedTiers = ['A']
    store.setAcknowledged(true)
    await store.approve()
    expect(store.approveError).toBe('revisão do plano não confirmada')
    expect(store.approval).toBeNull()
  })

  it('remontar o plano descarta a aprovação anterior', async () => {
    setup()
    const store = usePlanStore()
    await store.build('C:', ['a'])
    store.setAcknowledged(true)
    await store.approve()
    await store.build('C:', ['a'])
    expect(store.approval).toBeNull()
    expect(store.acknowledged).toBe(false)
  })
})

describe('execution store', () => {
  it('carrega o dry-run de um tier sem executar nada', async () => {
    const gateway = setup()
    const store = useExecutionStore()
    await store.loadPreview('A')
    expect(store.previews.A).toEqual(stepsA)
    expect(gateway.executeTier).not.toHaveBeenCalled()
  })

  it('exige confirmação, acompanha os eventos e guarda o resultado', async () => {
    const gateway = setup()
    const store = useExecutionStore()
    store.reset(['A', 'C'])
    expect(store.nextTier).toBe('A')
    expect(store.finished).toBe(false)
    await store.confirm('A')
    expect(gateway.executeTier).not.toHaveBeenCalled()

    store.request('A')
    expect(store.confirming).toBe('A')
    store.cancel()
    expect(store.confirming).toBeNull()

    store.request('A')
    await store.confirm('A')
    expect(gateway.executeTier).toHaveBeenCalledWith('A', expect.any(Function))
    expect(store.runs.A).toEqual(runA)
    expect(store.live['nvidia-dxcache']).toMatchObject({ status: 'parcial' })
    expect(store.running).toBeNull()
    expect(store.nextTier).toBe('C')
    expect(store.totalFreed).toBe(runA.freedBytes)

    store.request('C')
    await store.confirm('C')
    expect(store.runs.C).toEqual(runC)
    expect(store.nextTier).toBeNull()
    expect(store.finished).toBe(true)
  })

  it('mostra o item em andamento e reporta falha de execução ou de dry-run', async () => {
    let seen: string | undefined
    setup(
      fakeGateway({
        executeTier: vi.fn(async (_tier, onEvent) => {
          onEvent({ kind: 'started', id: 'npm-cache', result: null })
          seen = useExecutionStore().live['npm-cache'] === 'running' ? 'running' : 'other'
          throw new Error('tier A já executado')
        }),
        previewTier: fail('nenhum plano aprovado'),
      }),
    )
    const store = useExecutionStore()
    store.reset(['A'])
    store.request('A')
    await store.confirm('A')
    expect(seen).toBe('running')
    expect(store.error).toBe('tier A já executado')
    expect(store.running).toBeNull()
    await store.loadPreview('A')
    expect(store.error).toBe('nenhum plano aprovado')
  })
})

describe('report store', () => {
  it('carrega o relatório ou o erro', async () => {
    setup()
    const store = useReportStore()
    await store.load()
    expect(store.status).toBe('done')
    expect(store.report).toEqual(report)

    setup(fakeGateway({ report: fail('nenhuma execução nesta sessão') }))
    const failing = useReportStore()
    await failing.load()
    expect(failing.status).toBe('error')
    expect(failing.error).toBe('nenhuma execução nesta sessão')
  })
})
