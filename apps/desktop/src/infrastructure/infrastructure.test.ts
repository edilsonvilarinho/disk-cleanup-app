import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyThemeToDocument, localStorageSettingsStorage, systemPrefersDark, watchSystemTheme } from './browserTheme'
import { DemoGateway } from './demoGateway'
import { TauriGateway } from './tauriGateway'
import { DemoUpdater, TauriUpdater } from './updater'

describe('TauriGateway', () => {
  it('mapeia cada operação para o comando Tauri correspondente', async () => {
    const invoke = vi.fn(async (cmd: string) => ({ cmd }))
    const gateway = new TauriGateway(invoke as never, vi.fn() as never)
    expect(await gateway.systemInfo()).toEqual({ cmd: 'system_info' })
    await gateway.classify(['C:\\Projetos'])
    await gateway.buildPlan('C:', ['a'])
    expect(invoke).toHaveBeenCalledWith('classify', { extraExclusions: ['C:\\Projetos'] })
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

    const classification = await gateway.classify([])
    expect(classification.candidates.some((c) => c.blocked !== null)).toBe(true)

    const ids = classification.candidates.filter((c) => c.tier === 'A').map((c) => c.id)
    const plan = await gateway.buildPlan('C:', ids)
    expect(plan.itemCount).toBe(ids.length)
    expect(plan.tiers.map((t) => t.tier)).toEqual(['A'])
    expect(JSON.parse(plan.json).tiers.A).toHaveLength(ids.length)
    await expect(gateway.buildPlan('C:', [])).rejects.toEqual({ code: 'plan_empty', params: {} })
  })

  it('simula aprovação, dry-run, execução com eventos e relatório', async () => {
    const gateway = new DemoGateway(0)
    await expect(gateway.report()).rejects.toMatchObject({ code: 'no_execution' })
    await expect(gateway.previewTier('A')).rejects.toMatchObject({ code: 'not_approved' })
    await expect(gateway.approvePlan(['A'], true)).rejects.toMatchObject({ code: 'plan_required' })
    const classification = await gateway.classify(['%USERPROFILE%\\.m2'])
    expect(classification.candidates.some((c) => c.id === 'maven-repository')).toBe(false)
    expect(classification.skipped.some((s) => s.id === 'maven-repository' && s.code === 'excluded')).toBe(true)
    const ids = classification.candidates.filter((c) => c.tier !== 'B' && !c.blocked).map((c) => c.id)
    await gateway.buildPlan('C:', ids)
    await expect(gateway.approvePlan([], true)).rejects.toMatchObject({ code: 'approval_no_tier' })
    await expect(gateway.approvePlan(['A'], false)).rejects.toMatchObject({ code: 'approval_not_acknowledged' })
    const approval = await gateway.approvePlan(['A', 'C'], true)
    expect(approval.tiers).toEqual(['A', 'C'])
    const steps = await gateway.previewTier('A')
    expect(steps.length).toBeGreaterThan(0)
    const events: string[] = []
    const run = await gateway.executeTier('A', (e) => events.push(`${e.kind}:${e.id}`))
    expect(run.items).toHaveLength(steps.length)
    expect(events).toHaveLength(steps.length * 2)
    expect(run.items.some((i) => i.status === 'partial')).toBe(true)
    await expect(gateway.executeTier('A', () => {})).rejects.toEqual({ code: 'tier_already_run', params: { tier: 'A' } })
    await gateway.executeTier('C', () => {})
    const report = await gateway.report()
    expect(report.runs.map((r) => r.tier)).toEqual(['A', 'C'])
    expect(report.freedBytes).toBe(run.freedBytes + report.runs[1]!.freedBytes)
    expect(report.blocked.length).toBe(1)
    expect(report.exclusions.at(-1)!.reason.en).toBe('excluded in Settings')
  })
})

describe('browserTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('persiste as Configurações no localStorage e tolera storage bloqueado', () => {
    expect(localStorageSettingsStorage.load()).toBeNull()
    const settings = { language: 'en' as const, theme: 'dark' as const, extraExclusions: ['/a'], defaultDepth: 1 as const, autoUpdate: true, betaUpdates: false }
    localStorageSettingsStorage.save(settings)
    expect(localStorageSettingsStorage.load()).toEqual(settings)
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    })
    expect(localStorageSettingsStorage.load()).toBeNull()
    expect(() => localStorageSettingsStorage.save(settings)).not.toThrow()
  })

  it('lê a preferência do sistema quando disponível', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(systemPrefersDark()).toBe(false)
    watchSystemTheme(() => {})
    const addEventListener = vi.fn()
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener }))
    expect(systemPrefersDark()).toBe(true)
    const onChange = vi.fn()
    watchSystemTheme(onChange)
    expect(addEventListener).toHaveBeenCalledWith('change', onChange)
  })

  it('aplica o tema no elemento raiz', () => {
    applyThemeToDocument('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})

describe('TauriUpdater', () => {
  it('mapeia versão, verificação e instalação para os comandos do updater', async () => {
    const invoke = vi.fn(async (cmd: string) => (cmd === 'app_version' ? '0.1.0' : null))
    const updater = new TauriUpdater(invoke as never, vi.fn() as never)
    expect(await updater.appVersion()).toBe('0.1.0')
    expect(await updater.check(true)).toBeNull()
    await updater.install()
    expect(invoke).toHaveBeenCalledWith('check_update', { beta: true })
    expect(invoke).toHaveBeenCalledWith('install_update')
  })

  it('assina o progresso do download e cancela no fim, mesmo com erro', async () => {
    const unlisten = vi.fn()
    let handler: ((event: { payload: unknown }) => void) | undefined
    const listen = vi.fn(async (_event: string, h: typeof handler) => {
      handler = h
      return unlisten
    })
    const invoke = vi.fn(async () => {
      handler!({ payload: { downloaded: 1, total: 2, percent: 50 } })
    })
    const onProgress = vi.fn()
    await new TauriUpdater(invoke as never, listen as never).download(onProgress)
    expect(listen).toHaveBeenCalledWith('update-progress', expect.any(Function))
    expect(invoke).toHaveBeenCalledWith('download_update')
    expect(onProgress).toHaveBeenCalledWith({ downloaded: 1, total: 2, percent: 50 })
    expect(unlisten).toHaveBeenCalledTimes(1)

    const failing = new TauriUpdater(vi.fn(async () => Promise.reject(new Error('x'))) as never, listen as never)
    await expect(failing.download(onProgress)).rejects.toThrow('x')
    expect(unlisten).toHaveBeenCalledTimes(2)
  })
})

describe('DemoUpdater', () => {
  it('fora do Tauri informa a versão de demonstração e nunca tem atualização', async () => {
    const updater = new DemoUpdater()
    expect(await updater.appVersion()).toBe('0.0.0-demo')
    expect(await updater.check(true)).toBeNull()
    const onProgress = vi.fn()
    await expect(updater.download(onProgress)).rejects.toEqual({ code: 'update_none', params: {} })
    await expect(updater.install()).rejects.toEqual({ code: 'update_not_downloaded', params: {} })
    expect(onProgress).not.toHaveBeenCalled()
  })
})
