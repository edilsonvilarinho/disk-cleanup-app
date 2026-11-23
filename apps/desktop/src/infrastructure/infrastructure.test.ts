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
