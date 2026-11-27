import { BrowserBackground, TauriBackground } from './background'
import { EMPTY_CLASSIFY_REQUEST } from '../application/gateway'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyThemeToDocument, localStorageSettingsStorage, systemPrefersDark, trackPointer, watchSystemTheme } from './browserTheme'
import { DemoGateway } from './demoGateway'
import { TauriGateway } from './tauriGateway'
import { DemoUpdater, TauriUpdater } from './updater'

describe('TauriGateway', () => {
  it('mapeia cada operação para o comando Tauri correspondente', async () => {
    const invoke = vi.fn(async (cmd: string) => ({ cmd }))
    const gateway = new TauriGateway(invoke as never, vi.fn() as never)
    expect(await gateway.systemInfo()).toEqual({ cmd: 'system_info' })
    await gateway.classify({
      extraExclusions: ['C:\\Projetos'],
      projectRoots: ['D:\\dev'],
      userRules: [{ label: 'T', path: 'C:\\t', tier: 'A' }],
      disabledProfiles: ['node'],
      findOrphans: true,
    })
    await gateway.checkRule(['C:\\Projetos'], 'C:\\x')
    await gateway.findDuplicates()
    await gateway.buildPlan('C:', ['a'])
    expect(invoke).toHaveBeenCalledWith('classify', {
      extraExclusions: ['C:\\Projetos'],
      projectRoots: ['D:\\dev'],
      customization: { userRules: [{ label: 'T', path: 'C:\\t', tier: 'A' }], disabledProfiles: ['node'], findOrphans: true },
    })
    expect(invoke).toHaveBeenCalledWith('check_rule', { extraExclusions: ['C:\\Projetos'], path: 'C:\\x' })
    expect(invoke).toHaveBeenCalledWith('find_duplicates')
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
    await gateway.approvePlan(['A'], { A: 'trash' }, true)
    await gateway.previewTier('A')
    await gateway.report()
    expect(await gateway.executeTier('C', onEvent)).toEqual({ cmd: 'execute_tier' })
    expect(invoke).toHaveBeenCalledWith('approve_plan', { tiers: ['A'], disposals: { A: 'trash' }, acknowledged: true })
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

    const classification = await gateway.classify(EMPTY_CLASSIFY_REQUEST)
    expect(classification.candidates.some((c) => c.blocked !== null)).toBe(true)
    // Projetos de exemplo: tier C, com raiz e idade; um recente (começa desmarcado).
    const projects = classification.candidates.filter((c) => c.project !== null)
    expect(projects.length).toBeGreaterThan(1)
    expect(projects.every((c) => c.tier === 'C' && c.idleDays !== null)).toBe(true)
    expect(projects.some((c) => c.idleDays! < 90)).toBe(true)
    const files = classification.candidates.filter((c) => c.origin === 'file')
    expect(files.length).toBeGreaterThan(0)
    expect(files.every((c) => c.tier === 'D')).toBe(true)

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
    await expect(gateway.approvePlan(['A'], {}, true)).rejects.toMatchObject({ code: 'plan_required' })
    const classification = await gateway.classify({ ...EMPTY_CLASSIFY_REQUEST, extraExclusions: ['%USERPROFILE%\\.m2'] })
    expect(classification.candidates.some((c) => c.id === 'maven-repository')).toBe(false)
    expect(classification.skipped.some((s) => s.id === 'maven-repository' && s.code === 'excluded')).toBe(true)
    const ids = classification.candidates.filter((c) => c.tier !== 'B' && !c.blocked).map((c) => c.id)
    await gateway.buildPlan('C:', ids)
    await expect(gateway.approvePlan([], {}, true)).rejects.toMatchObject({ code: 'approval_no_tier' })
    await expect(gateway.approvePlan(['A'], {}, false)).rejects.toMatchObject({ code: 'approval_not_acknowledged' })
    const approval = await gateway.approvePlan(['A', 'C'], {}, true)
    expect(approval.tiers).toEqual(['A', 'C'])
    // Sem escolha: padrão do núcleo (cache definitivo, o resto para a Lixeira).
    expect(approval.disposals).toEqual({ A: 'permanent', C: 'trash' })
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
    // Tier C foi para a Lixeira: caminho conta como movido, não como liberado.
    const c = report.runs[1]!
    const paths = c.items.filter((i) => i.trashedBytes > 0)
    expect(paths.length).toBeGreaterThan(0)
    expect(paths.every((i) => i.freedBytes === 0)).toBe(true)
    expect(c.trashedBytes).toBe(paths.reduce((s, i) => s + i.trashedBytes, 0))
    expect(report.trashedBytes).toBe(c.trashedBytes)
    expect((await gateway.previewTier('C')).some((s) => s.disposal === 'trash')).toBe(true)
    expect(report.blocked.length).toBe(1)
    expect(report.exclusions.at(-1)!.reason.en).toBe('excluded in Settings')
  })
})

describe('DemoGateway · regras próprias e perfis', () => {
  it('valida a pasta e aplica regras e perfis desligados', async () => {
    const gateway = new DemoGateway(0)
    expect((await gateway.checkRule([], ' ')).code).toBe('empty')
    expect((await gateway.checkRule([], 'C:\\Windows')).code).toBe('excluded')
    expect((await gateway.checkRule(['D:\\meus'], 'D:\\meus\\x')).code).toBe('excluded')
    expect((await gateway.checkRule([], 'D:\\x')).code).toBe('too_broad')
    expect((await gateway.checkRule([], 'D:\\dev\\cache')).code).toBe('ok')
    const info = await gateway.systemInfo()
    expect(info.projectProfiles.map((p) => p.id)).toContain('node')
    const all = await gateway.classify(EMPTY_CLASSIFY_REQUEST)
    const custom = await gateway.classify({
      ...EMPTY_CLASSIFY_REQUEST,
      userRules: [{ label: '', path: 'D:\\unity\\Library', tier: 'C' }],
      disabledProfiles: ['node', 'rust', 'python'],
    })
    expect(custom.candidates.some((c) => c.id === 'user:D:\\unity\\Library' && c.label.pt === 'D:\\unity\\Library')).toBe(true)
    expect(custom.candidates.filter((c) => c.origin === 'project')).toHaveLength(0)
    expect(all.candidates.filter((c) => c.origin === 'project').length).toBeGreaterThan(0)
    const plan = await gateway.buildPlan('C:', ['user:D:\\unity\\Library'])
    expect(plan.itemCount).toBe(1)
    expect(all.candidates.some((c) => c.origin === 'orphan')).toBe(false)
    const withOrphans = await gateway.classify({ ...EMPTY_CLASSIFY_REQUEST, findOrphans: true })
    expect(withOrphans.candidates.filter((c) => c.origin === 'orphan')).toHaveLength(1)
    const dups = await gateway.findDuplicates()
    expect(dups.groups.length).toBe(2)
    const after = await gateway.classify(EMPTY_CLASSIFY_REQUEST)
    const copies = after.candidates.filter((c) => c.origin === 'duplicate')
    expect(copies).toHaveLength(3)
    expect(copies.some((c) => c.target.includes('Win11') && c.target.startsWith('D:'))).toBe(true)
    // a cópia mantida nunca vira candidata a duplicado (pode aparecer como arquivo grande)
    expect(copies.some((c) => dups.groups.some((g) => g.keep === c.target))).toBe(false)
  })
})

describe('Segundo plano', () => {
  it('TauriBackground: volume, bandeja, evento e aviso pedindo permissão só quando precisa', async () => {
    const invoke = vi.fn(async () => ({ freeBytes: 1 }))
    const unlisten = vi.fn()
    const listen = vi.fn(async () => unlisten)
    const notifier = { granted: vi.fn(async () => false), request: vi.fn(async () => 'granted'), send: vi.fn() }
    const bg = new TauriBackground(invoke as never, listen as never, notifier)
    await bg.volumeUsage('C:\\')
    expect(invoke).toHaveBeenCalledWith('volume_usage', { volumeRoot: 'C:\\' })
    const labels = { open: 'a', scan: 'b', quit: 'c', tooltip: 'd' }
    await bg.setBackground(true, labels)
    expect(invoke).toHaveBeenCalledWith('set_background', { enabled: true, labels })
    const cb = vi.fn()
    expect(await bg.onTrayScan(cb)).toBe(unlisten)
    expect(listen).toHaveBeenCalledWith('tray-scan', cb)
    await bg.notify('t', 'b')
    expect(notifier.send).toHaveBeenCalledWith({ title: 't', body: 'b' })
    notifier.granted.mockResolvedValue(false)
    notifier.request.mockResolvedValue('denied')
    await bg.notify('t2', 'b2')
    expect(notifier.send).toHaveBeenCalledTimes(1)
    notifier.granted.mockResolvedValue(true)
    await bg.notify('t3', 'b3')
    expect(notifier.request).toHaveBeenCalledTimes(2)
    expect(notifier.send).toHaveBeenCalledTimes(2)
  })

  it('BrowserBackground: sem bandeja nem aviso; volume de exemplo coerente', async () => {
    const bg = new BrowserBackground()
    const v = await bg.volumeUsage()
    expect(v.usedBytes + v.freeBytes).toBe(v.totalBytes)
    await expect(bg.notify()).resolves.toBeUndefined()
    await expect(bg.setBackground()).resolves.toBeUndefined()
    const stop = await bg.onTrayScan()
    expect(stop()).toBeUndefined()
  })
})

describe('browserTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('persiste as Configurações no localStorage e tolera storage bloqueado', () => {
    expect(localStorageSettingsStorage.load()).toBeNull()
    const settings = {
      language: 'en' as const,
      theme: 'dark' as const,
      extraExclusions: ['/a'],
      defaultDepth: 1 as const,
      autoUpdate: true,
      betaUpdates: false,
      projectRoots: ['/dev'],
      minIdleDays: 90 as const,
      userRules: [{ label: 'x', path: '/x/y/z', tier: 'C' as const }],
      disabledProfiles: ['rust'],
      findOrphans: false,
      backgroundEnabled: true,
      lowSpaceGb: 25 as const,
      schedule: 'weekly' as const,
      releaseNotes: true,
      seenVersion: '0.1.0-beta.7',
    }
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

  it('troca o tema com revelação a partir do último clique, salvo sem suporte ou com movimento reduzido', () => {
    const root = document.documentElement
    root.setAttribute('data-theme', 'dark')
    // Sem View Transitions: troca na hora.
    applyThemeToDocument('light')
    expect(root.getAttribute('data-theme')).toBe('light')

    const startViewTransition = vi.fn((update: () => void) => update())
    Object.defineProperty(document, 'startViewTransition', { value: startViewTransition, configurable: true })
    // Sem clique registrado: centro da janela.
    applyThemeToDocument('dark')
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(root.style.getPropertyValue('--vt-x')).toBe(`${innerWidth / 2}px`)

    let listener: (e: Event) => void = () => {}
    trackPointer({ addEventListener: ((_t: string, l: (e: Event) => void) => (listener = l)) as never })
    listener({ clientX: 10, clientY: 20 } as PointerEvent)
    applyThemeToDocument('light')
    expect(root.style.getPropertyValue('--vt-x')).toBe('10px')
    expect(root.style.getPropertyValue('--vt-y')).toBe('20px')

    // Mesmo tema: nada a revelar.
    applyThemeToDocument('light')
    expect(startViewTransition).toHaveBeenCalledTimes(2)

    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    applyThemeToDocument('dark')
    expect(startViewTransition).toHaveBeenCalledTimes(2)
    expect(root.getAttribute('data-theme')).toBe('dark')
    Reflect.deleteProperty(document, 'startViewTransition')
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
    expect(await updater.appVersion()).toBe('0.1.0-beta.8+demo')
    expect(await updater.check(true)).toBeNull()
    const onProgress = vi.fn()
    await expect(updater.download(onProgress)).rejects.toEqual({ code: 'update_none', params: {} })
    await expect(updater.install()).rejects.toEqual({ code: 'update_not_downloaded', params: {} })
    expect(onProgress).not.toHaveBeenCalled()
  })
})
