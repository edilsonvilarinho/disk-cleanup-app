import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyThemeToDocument, localStorageThemeStorage, systemPrefersDark } from './browserTheme'
import { DemoGateway } from './demoGateway'
import { TauriGateway } from './tauriGateway'

describe('TauriGateway', () => {
  it('mapeia cada operação para o comando Tauri correspondente', async () => {
    const invoke = vi.fn(async (cmd: string) => ({ cmd }))
    const gateway = new TauriGateway(invoke as never, vi.fn() as never)
    expect(await gateway.systemInfo()).toEqual({ cmd: 'system_info' })
    await gateway.classify()
    await gateway.buildPlan('C:', ['a'])
    expect(invoke).toHaveBeenCalledWith('classify')
    expect(invoke).toHaveBeenCalledWith('build_plan', { volume: 'C:', selected: ['a'] })
  })

  it('assina o progresso durante a varredura e cancela no fim, mesmo com erro', async () => {
    const unlisten = vi.fn()
    let handler: ((event: { payload: unknown }) => void) | undefined
    const listen = vi.fn(async (_event: string, h: typeof handler) => {
      handler = h
      return unlisten
    })
    const invoke = vi.fn(async () => {
      handler!({ payload: { files: 5, logicalBytes: 10 } })
      return { ok: true }
    })
    const onProgress = vi.fn()
    const gateway = new TauriGateway(invoke as never, listen as never)
    const request = { volumeRoot: 'C:\\', profile: null, depth: 2 as const }
    expect(await gateway.runSurvey(request, onProgress)).toEqual({ ok: true })
    expect(listen).toHaveBeenCalledWith('survey-progress', expect.any(Function))
    expect(invoke).toHaveBeenCalledWith('run_survey', { request })
    expect(onProgress).toHaveBeenCalledWith({ files: 5, logicalBytes: 10 })
    expect(unlisten).toHaveBeenCalledTimes(1)

    const failing = new TauriGateway(vi.fn(async () => Promise.reject(new Error('x'))) as never, listen as never)
    await expect(failing.runSurvey(request, onProgress)).rejects.toThrow('x')
    expect(unlisten).toHaveBeenCalledTimes(2)
  })
})

describe('TauriGateway — execução', () => {
  it('mapeia aprovação, dry-run, relatório e assina os eventos da execução', async () => {
    const unlisten = vi.fn()
    let handler: ((event: { payload: unknown }) => void) | undefined
    const listen = vi.fn(async (_e: string, h: typeof handler) => {
      handler = h
      return unlisten
    })
    const invoke = vi.fn(async (cmd: string) => {
      if (cmd === 'execute_tier') handler!({ payload: { kind: 'started', id: 'x', result: null } })
      return { cmd }
    })
    const onEvent = vi.fn()
    const gateway = new TauriGateway(invoke as never, listen as never)
    await gateway.approvePlan(['A'], true)
    await gateway.previewTier('A')
    await gateway.report()
    expect(await gateway.executeTier('C', onEvent)).toEqual({ cmd: 'execute_tier' })
    expect(invoke).toHaveBeenCalledWith('approve_plan', { tiers: ['A'], acknowledged: true })
    expect(invoke).toHaveBeenCalledWith('preview_tier', { tier: 'A' })
    expect(invoke).toHaveBeenCalledWith('report')
    expect(invoke).toHaveBeenCalledWith('execute_tier', { tier: 'C' })
    expect(listen).toHaveBeenCalledWith('execution-progress', expect.any(Function))
    expect(onEvent).toHaveBeenCalledWith({ kind: 'started', id: 'x', result: null })
    expect(unlisten).toHaveBeenCalledTimes(1)
  })
})

describe('DemoGateway', () => {
  it('devolve dados de exemplo coerentes sem precisar do Tauri', async () => {
    const gateway = new DemoGateway(0)
    const info = await gateway.systemInfo()
    expect(info.os).toBe('demo')
    const progress = vi.fn()
    const survey = await gateway.runSurvey({ volumeRoot: info.volumeRoot, profile: info.profile, depth: 2 }, progress)
    expect(progress).toHaveBeenCalled()
    expect(survey.volume.usedBytes + survey.volume.freeBytes).toBe(survey.volume.totalBytes)
    expect(survey.cloud.every((c) => c.isCloud)).toBe(true)

    const classification = await gateway.classify()
    expect(classification.candidates.some((c) => c.blockedReason !== null)).toBe(true)

    const ids = classification.candidates.filter((c) => c.tier === 'A').map((c) => c.id)
    const plan = await gateway.buildPlan('C:', ids)
    expect(plan.itemCount).toBe(ids.length)
    expect(plan.tiers.map((t) => t.tier)).toEqual(['A'])
    expect(JSON.parse(plan.json).tiers.A).toHaveLength(ids.length)
    await expect(gateway.buildPlan('C:', [])).rejects.toThrow('nenhum item')
  })

  it('simula aprovação, dry-run, execução com eventos e relatório', async () => {
    const gateway = new DemoGateway(0)
    await expect(gateway.report()).rejects.toThrow('nenhuma execução')
    await expect(gateway.previewTier('A')).rejects.toThrow('aprovado')
    await expect(gateway.approvePlan(['A'], false)).rejects.toThrow('revisão')
    const ids = (await gateway.classify()).candidates.filter((c) => c.tier !== 'B' && !c.blockedReason).map((c) => c.id)
    await gateway.buildPlan('C:', ids)
    await expect(gateway.approvePlan([], true)).rejects.toThrow('nenhum tier')
    const approval = await gateway.approvePlan(['A', 'C'], true)
    expect(approval.tiers).toEqual(['A', 'C'])
    const steps = await gateway.previewTier('A')
    expect(steps.length).toBeGreaterThan(0)
    const events: string[] = []
    const run = await gateway.executeTier('A', (e) => events.push(`${e.kind}:${e.id}`))
    expect(run.items).toHaveLength(steps.length)
    expect(events).toHaveLength(steps.length * 2)
    expect(run.items.some((i) => i.status === 'parcial')).toBe(true)
    await expect(gateway.executeTier('A', () => {})).rejects.toThrow('já executado')
    await gateway.executeTier('C', () => {})
    const report = await gateway.report()
    expect(report.runs.map((r) => r.tier)).toEqual(['A', 'C'])
    expect(report.freedBytes).toBe(run.freedBytes + report.runs[1]!.freedBytes)
    expect(report.blocked.length).toBe(1)
  })
})

describe('browserTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('persiste no localStorage e tolera storage bloqueado', () => {
    localStorageThemeStorage.set('light')
    expect(localStorageThemeStorage.get()).toBe('light')
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    })
    expect(localStorageThemeStorage.get()).toBeNull()
    expect(() => localStorageThemeStorage.set('dark')).not.toThrow()
  })

  it('lê a preferência do sistema quando disponível', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(systemPrefersDark()).toBe(false)
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    expect(systemPrefersDark()).toBe(true)
  })

  it('aplica o tema no elemento raiz', () => {
    applyThemeToDocument('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
