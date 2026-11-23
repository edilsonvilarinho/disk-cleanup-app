import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent } from 'vue'
import { createMemoryHistory } from 'vue-router'
import type { DiskCleanupGateway } from '../application/gateway'
import { gatewayPlugin } from '../application/gatewayPlugin'
import { settingsPlugin, type Settings } from '../application/settings'
import { usePlanStore } from '../application/stores/plan'
import { useSettingsStore } from '../application/stores/settings'
import { ThemeController } from '../application/theme'
import { updaterPlugin, type UpdaterPort } from '../application/updater'
import { fakeGateway } from '../test/fakeGateway'
import { fakeUpdater, updateInfo } from '../test/fakeUpdater'
import { approval, classification, report, runA, survey } from '../test/fixtures'
import App from './App.vue'
import { SYSTEM_LANGUAGES_KEY } from './i18n'
import { volumeLabel } from './labels'
import { createAppRouter } from './router'
import { THEME_KEY, useTheme } from './theme'

interface MountOptions {
  languages?: string[]
  saved?: Partial<Settings>
  updater?: UpdaterPort
}

async function mountApp(path: string, gateway: DiskCleanupGateway = fakeGateway(), options: MountOptions = {}) {
  const saved: Settings[] = []
  const pinia = createPinia()
  const updater = options.updater ?? fakeUpdater()
  pinia.use(gatewayPlugin(gateway))
  pinia.use(settingsPlugin({ load: () => options.saved ?? null, save: (s) => saved.push(structuredClone(s)) }))
  pinia.use(updaterPlugin(updater))
  const router = createAppRouter(createMemoryHistory())
  const apply = vi.fn()
  const theme = new ThemeController(() => true, apply)
  // Mesma ordem do main.ts: preferências carregadas antes de montar.
  createApp({}).use(pinia)
  useSettingsStore(pinia).load()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, {
    global: {
      plugins: [pinia, router],
      provide: { [THEME_KEY]: theme, [SYSTEM_LANGUAGES_KEY]: () => options.languages ?? ['pt-BR'] },
    },
  })
  await flushPromises()
  return { wrapper, gateway, router, theme, pinia, saved, apply, updater }
}

describe('useTheme', () => {
  it('falha explicitamente sem ThemeController fornecido', () => {
    const Probe = defineComponent({ setup: () => useTheme(), render: () => null })
    expect(() => mount(Probe)).toThrow('ThemeController')
  })
})

describe('labels', () => {
  it('normaliza o volume para o plan.json', () => {
    expect(volumeLabel('C:\\')).toBe('C:')
    expect(volumeLabel('/')).toBe('/')
    expect(volumeLabel('/mnt/data/')).toBe('/mnt/data')
  })
})

describe('shell', () => {
  it('mostra as 5 etapas, o ambiente e alterna o tema', async () => {
    const { wrapper, theme } = await mountApp('/')
    expect(wrapper.findAll('[data-test="nav"] a')).toHaveLength(5)
    expect(wrapper.get('[data-test="nav"] a[aria-current="page"]').text()).toContain('Survey')
    expect(wrapper.get('[data-test="env-os"]').text()).toBe('windows')
    const toggle = wrapper.get('[data-test="theme-toggle"]')
    expect(toggle.text()).toContain('Tema claro')
    await toggle.trigger('click')
    expect(theme.current.value).toBe('light')
    expect(toggle.text()).toContain('Tema escuro')
    expect(document.documentElement.getAttribute('lang')).toBe('pt-BR')
  })

  it('mostra erro de ambiente quando o núcleo não responde', async () => {
    const { wrapper } = await mountApp('/', fakeGateway({ systemInfo: vi.fn(async () => Promise.reject(new Error('sem IPC'))) }))
    expect(wrapper.get('[data-test="env-error"]').text()).toContain('sem IPC')
  })
})

describe('Survey', () => {
  it('executa a varredura e mostra o painel do volume', async () => {
    const { wrapper, gateway } = await mountApp('/')
    expect(wrapper.find('[data-test="kpi-used"]').exists()).toBe(false)
    await wrapper.get('[data-test="depth"]').setValue('1')
    await wrapper.get('[data-test="start-survey"]').trigger('click')
    await flushPromises()
    expect(gateway.runSurvey).toHaveBeenCalledWith({ volumeRoot: 'C:\\', profile: 'C:\\Users\\u', depth: 1 }, expect.any(Function))
    expect(wrapper.get('[data-test="kpi-used"]').text()).toContain('891,4 GB')
    expect(wrapper.get('[data-test="health"]').text()).toContain('Crítico')
    expect(wrapper.get('[data-test="roots"]').text()).toContain('Users')
    expect(wrapper.get('[data-test="profile"]').text()).toContain('AppData')
    expect(wrapper.get('[data-test="cloud"]').text()).toContain('9,1')
    expect(wrapper.get('[data-test="scan-stats"]').text()).toContain('1.284.316')
    expect(wrapper.get('[data-test="to-classify"]').attributes('href')).toContain('classificacao')
  })

  it('mostra o progresso enquanto varre', async () => {
    let finish: (v: typeof survey) => void = () => {}
    const runSurvey = vi.fn((_r, onProgress) => {
      onProgress({ files: 20_000, logicalBytes: 5 * 1024 ** 3 })
      return new Promise<typeof survey>((resolve) => (finish = resolve))
    })
    const { wrapper } = await mountApp('/', fakeGateway({ runSurvey }))
    await wrapper.get('[data-test="start-survey"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="survey-progress"]').text()).toContain('20.000')
    expect(wrapper.get('[data-test="start-survey"]').attributes('disabled')).toBeDefined()
    finish(survey)
    await flushPromises()
    expect(wrapper.find('[data-test="survey-progress"]').exists()).toBe(false)
  })

  it('classifica a saúde do volume e omite seções vazias', async () => {
    const healthy = {
      ...survey,
      volume: { ...survey.volume, health: 'healthy' as const },
      cloud: [],
      profile: [],
    }
    const { wrapper } = await mountApp('/', fakeGateway({ runSurvey: vi.fn(async () => healthy) }))
    await wrapper.get('[data-test="start-survey"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="health"]').text()).toContain('Saudável')
    expect(wrapper.find('[data-test="cloud"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="profile"]').exists()).toBe(false)

    const warning = { ...healthy, volume: { ...healthy.volume, health: 'warning' as const } }
    const second = await mountApp('/', fakeGateway({ runSurvey: vi.fn(async () => warning) }))
    await second.wrapper.get('[data-test="start-survey"]').trigger('click')
    await flushPromises()
    expect(second.wrapper.get('[data-test="health"]').text()).toContain('Atenção')
  })

  it('mostra falha da varredura', async () => {
    const { wrapper } = await mountApp('/', fakeGateway({ runSurvey: vi.fn(async () => Promise.reject(new Error('sem acesso'))) }))
    await wrapper.get('[data-test="start-survey"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="survey-error"]').text()).toContain('sem acesso')
  })

  it('não inicia sem informações do sistema', async () => {
    const { wrapper, gateway } = await mountApp('/', fakeGateway({ systemInfo: vi.fn(async () => Promise.reject(new Error('x'))) }))
    expect(wrapper.get('[data-test="start-survey"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-test="start-survey"]').trigger('click')
    expect(gateway.runSurvey).not.toHaveBeenCalled()
  })
})

describe('Classificação', () => {
  it('carrega ao abrir, lista por tier e recalcula o total ao marcar', async () => {
    const { wrapper, gateway } = await mountApp('/classificacao')
    expect(gateway.classify).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-test="tab-A"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.findAll('[data-test="row"]')).toHaveLength(2)
    expect(wrapper.get('[data-test="row"]').text()).toContain('npm cache clean --force')
    expect(wrapper.get('[data-test="total"]').text()).toContain('25,4 GB')

    await wrapper.get('[data-test="row"] input[type="checkbox"]').setValue(false)
    expect(wrapper.get('[data-test="total"]').text()).toContain('19,0 GB')
    await wrapper.get('[data-test="toggle-tier"]').trigger('click')
    expect(wrapper.get('[data-test="total"]').text()).toContain('25,4 GB')
  })

  it('mostra bloqueados desabilitados, exclusões e regras ignoradas', async () => {
    const { wrapper } = await mountApp('/classificacao')
    await wrapper.get('[data-test="tab-C"]').trigger('click')
    const rows = wrapper.findAll('[data-test="row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('re-download')
    expect(rows[1]!.get('input').attributes('disabled')).toBeDefined()
    expect(rows[1]!.text()).toContain('CUDA_PATH')

    await wrapper.get('[data-test="tab-X"]').trigger('click')
    expect(wrapper.get('[data-test="exclusions"]').text()).toContain('C:\\Windows\\Installer')
    expect(wrapper.find('[data-test="toggle-tier"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="skipped"]').text()).toContain('yarn-cache')
    expect(wrapper.get('[data-test="to-plan"]').attributes('href')).toContain('plano')
  })

  it('reclassifica sob demanda', async () => {
    const { wrapper, gateway } = await mountApp('/classificacao')
    await wrapper.get('[data-test="reclassify"]').trigger('click')
    await flushPromises()
    expect(gateway.classify).toHaveBeenCalledTimes(2)
  })

  it('mostra tier sem candidatos', async () => {
    const { wrapper } = await mountApp('/classificacao')
    await wrapper.get('[data-test="tab-B"]').trigger('click')
    expect(wrapper.get('[data-test="tier-empty"]').text()).toContain('Nenhum candidato')
  })

  it('mostra falha e permite tentar de novo', async () => {
    const classify = vi.fn().mockRejectedValueOnce(new Error('catálogo inválido')).mockResolvedValue(classification)
    const { wrapper } = await mountApp('/classificacao', fakeGateway({ classify }))
    expect(wrapper.get('[data-test="classify-error"]').text()).toContain('catálogo inválido')
    await wrapper.get('[data-test="retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-test="row"]')).toHaveLength(2)
  })

  it('mostra carregamento enquanto classifica', async () => {
    const classify = vi.fn(() => new Promise<typeof classification>(() => {}))
    const { wrapper } = await mountApp('/classificacao', fakeGateway({ classify }))
    expect(wrapper.find('[data-test="classify-loading"]').exists()).toBe(true)
  })
})

describe('Plano', () => {
  it('pede a classificação antes de montar o plano', async () => {
    const { wrapper, gateway } = await mountApp('/plano')
    expect(wrapper.get('[data-test="plan-empty"]').text()).toContain('Classificação')
    expect(gateway.buildPlan).not.toHaveBeenCalled()
  })

  it('monta o plano com a seleção atual e copia o plan.json', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { wrapper, gateway, router } = await mountApp('/classificacao')
    await router.push('/plano')
    await flushPromises()
    expect(gateway.buildPlan).toHaveBeenCalledWith('C:', ['npm-cache', 'nvidia-dxcache', 'gradle-caches'])
    expect(wrapper.get('[data-test="plan-tiers"]').text()).toContain('Cache')
    expect(wrapper.get('[data-test="plan-items"]').text()).toContain('Rótulo gradle-caches')
    expect(wrapper.get('[data-test="plan-json"]').text()).toContain('"volume": "C:"')
    await wrapper.get('[data-test="copy-json"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalled()
    expect(wrapper.get('[data-test="copy-status"]').text()).toBe('Copiado')

    writeText.mockRejectedValueOnce(new Error('negado'))
    await wrapper.get('[data-test="copy-json"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="copy-status"]').text()).toContain('negado')
    vi.unstubAllGlobals()
  })

  it('mostra erro ao montar o plano', async () => {
    const { wrapper, router } = await mountApp(
      '/classificacao',
      fakeGateway({ buildPlan: vi.fn(async () => Promise.reject(new Error('nenhum item selecionado'))) }),
    )
    await router.push('/plano')
    await flushPromises()
    expect(wrapper.get('[data-test="plan-error"]').text()).toContain('nenhum item selecionado')
  })
})

describe('Aprovação no Plano', () => {
  async function planScreen(gateway = fakeGateway()) {
    const ctx = await mountApp('/classificacao', gateway)
    await ctx.router.push('/plano')
    await flushPromises()
    return ctx
  }

  it('só aprova com ciência e leva para a Execução', async () => {
    const { wrapper, gateway, router } = await planScreen()
    const approve = wrapper.get('[data-test="approve"]')
    expect(approve.attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-test="approve-tier-A"]').element).toHaveProperty('checked', true)
    await wrapper.get('[data-test="ack"]').setValue(true)
    expect(approve.attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-test="approve-tier-C"]').setValue(false)
    await approve.trigger('click')
    await flushPromises()
    expect(gateway.approvePlan).toHaveBeenCalledWith(['A'], true)
    // A Execução é carregada sob demanda: a navegação termina depois do import.
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/execucao'))
  })

  it('mostra a recusa do núcleo e fica no Plano', async () => {
    const { wrapper, router } = await planScreen(
      fakeGateway({ approvePlan: vi.fn(async () => Promise.reject(new Error('tier C não existe no plano'))) }),
    )
    await wrapper.get('[data-test="ack"]').setValue(true)
    await wrapper.get('[data-test="approve"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="approve-error"]').text()).toContain('tier C não existe')
    expect(router.currentRoute.value.path).toBe('/plano')
  })
})

describe('Execução', () => {
  async function executeScreen(gateway = fakeGateway()) {
    const ctx = await mountApp('/', gateway)
    usePlanStore(ctx.pinia).approval = approval
    await ctx.router.push('/execucao')
    await flushPromises()
    return ctx
  }

  it('sem aprovação, manda aprovar o plano', async () => {
    const { wrapper } = await mountApp('/execucao')
    expect(wrapper.get('[data-test="execute-empty"]').text()).toContain('Aprove o plano')
  })

  it('mostra o dry-run, exige confirmação e executa tier a tier até o relatório', async () => {
    const { wrapper, gateway } = await executeScreen()
    expect(gateway.previewTier).toHaveBeenCalledWith('A')
    expect(wrapper.findAll('[data-test="stage"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-test="step"]')).toHaveLength(2)
    expect(wrapper.get('[data-test="step"]').text()).toContain('npm cache clean --force')

    await wrapper.get('[data-test="execute"]').trigger('click')
    expect(wrapper.get('[data-test="confirm"]').text()).toContain('2 itens')
    await wrapper.get('[data-test="cancel"]').trigger('click')
    expect(wrapper.find('[data-test="confirm"]').exists()).toBe(false)
    expect(gateway.executeTier).not.toHaveBeenCalled()

    await wrapper.get('[data-test="execute"]').trigger('click')
    await wrapper.get('[data-test="confirm-execute"]').trigger('click')
    await flushPromises()
    expect(gateway.executeTier).toHaveBeenCalledWith('A', expect.any(Function))
    const results = wrapper.findAll('[data-test="result"]')
    expect(results).toHaveLength(2)
    expect(results[1]!.text()).toContain('parcial')
    expect(results[1]!.text()).toContain('dx.bin: em uso')
    expect(gateway.previewTier).toHaveBeenLastCalledWith('C')
    expect(wrapper.find('[data-test="to-report"]').exists()).toBe(false)

    await wrapper.get('[data-test="execute"]').trigger('click')
    await wrapper.get('[data-test="confirm-execute"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="total-freed"]').text()).toContain('24,8 GB')
    expect(wrapper.get('[data-test="to-report"]').attributes('href')).toContain('relatorio')
  })

  it('mostra o tier em andamento e erros', async () => {
    const executeTier = vi.fn(() => new Promise<never>(() => {}))
    const { wrapper } = await executeScreen(fakeGateway({ executeTier }))
    await wrapper.get('[data-test="execute"]').trigger('click')
    await wrapper.get('[data-test="confirm-execute"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="running"]').text()).toContain('Executando')

    const failing = await executeScreen(
      fakeGateway({ previewTier: vi.fn(async () => Promise.reject(new Error('nenhum plano aprovado'))) }),
    )
    expect(failing.wrapper.get('[data-test="execute-error"]').text()).toContain('nenhum plano aprovado')
  })
})

describe('Relatório', () => {
  it('mostra antes/depois, tiers, pendências, divergências e copia o Markdown', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { wrapper, gateway } = await mountApp('/relatorio')
    expect(gateway.report).toHaveBeenCalled()
    expect(wrapper.get('[data-test="report-freed"]').text()).toContain('+24,8 GB')
    expect(wrapper.get('[data-test="report-tiers"]').text()).toContain('Regeneráveis')
    expect(wrapper.get('[data-test="report-pending"]').text()).toContain('dx.bin: em uso')
    expect(wrapper.get('[data-test="report-blocked"]').text()).toContain('CUDA_PATH')
    expect(wrapper.get('[data-test="report-untouched"]').text()).toContain('Installer')
    await wrapper.get('[data-test="copy-report"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('# Relatório de limpeza'))
    expect(wrapper.get('[data-test="copy-report-status"]').text()).toBe('Copiado')

    writeText.mockRejectedValueOnce(new Error('negado'))
    await wrapper.get('[data-test="copy-report"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="copy-report-status"]').text()).toContain('negado')
    vi.unstubAllGlobals()
  })

  it('sem execução, explica e aponta para a Execução', async () => {
    const { wrapper } = await mountApp(
      '/relatorio',
      fakeGateway({ report: vi.fn(async () => Promise.reject(new Error('nenhuma execução nesta sessão'))) }),
    )
    expect(wrapper.get('[data-test="report-error"]').text()).toContain('nenhuma execução')
  })

  it('seções vazias dizem que não há nada', async () => {
    const empty = { ...report, pending: [], blocked: [] }
    const { wrapper } = await mountApp('/relatorio', fakeGateway({ report: vi.fn(async () => empty) }))
    expect(wrapper.get('[data-test="report-pending"]').text()).toContain('Nenhuma pendência')
    expect(wrapper.get('[data-test="report-blocked"]').text()).toContain('Nenhuma divergência')
  })
})

describe('Configurações', () => {
  it('troca idioma, tema e profundidade e salva cada mudança', async () => {
    const { wrapper, saved, theme } = await mountApp('/configuracoes')
    expect(wrapper.get('h1').text()).toBe('Configurações')
    expect(wrapper.get('[data-test="language"]').text()).toContain('Automático (sistema: Português)')
    await wrapper.get('[data-test="language"]').setValue('en')
    expect(wrapper.get('h1').text()).toBe('Settings')
    expect(document.documentElement.getAttribute('lang')).toBe('en')
    await wrapper.get('[data-test="theme-light"]').setValue(true)
    expect(theme.current.value).toBe('light')
    await wrapper.get('[data-test="default-depth"]').setValue('1')
    expect(saved.at(-1)).toEqual({
      language: 'en',
      theme: 'light',
      extraExclusions: [],
      defaultDepth: 1,
      autoUpdate: true,
      betaUpdates: false,
    })
  })

  it('adiciona e remove pastas extras, que vão para a classificação', async () => {
    const { wrapper, gateway, router } = await mountApp('/configuracoes')
    expect(wrapper.find('[data-test="no-exclusions"]').exists()).toBe(true)
    await wrapper.get('[data-test="new-exclusion"]').setValue('C:\\Projetos')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('[data-test="new-exclusion"]').setValue('c:\\projetos')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.findAll('[data-test="exclusion"]')).toHaveLength(1)
    expect((wrapper.get('[data-test="new-exclusion"]').element as HTMLInputElement).value).toBe('c:\\projetos')
    await router.push('/classificacao')
    await flushPromises()
    expect(gateway.classify).toHaveBeenCalledWith(['C:\\Projetos'])
    await router.push('/configuracoes')
    await flushPromises()
    await wrapper.get('[data-test="exclusion"] button').trigger('click')
    expect(wrapper.find('[data-test="no-exclusions"]').exists()).toBe(true)
  })

  it('usa a profundidade padrão salva na varredura', async () => {
    const { wrapper, gateway } = await mountApp('/', fakeGateway(), { saved: { defaultDepth: 1 } })
    await wrapper.get('[data-test="start-survey"]').trigger('click')
    await flushPromises()
    expect(gateway.runSurvey).toHaveBeenCalledWith(expect.objectContaining({ depth: 1 }), expect.any(Function))
  })
})

describe('Idioma', () => {
  it('sistema em inglês abre em inglês, com números e textos do núcleo em inglês', async () => {
    const { wrapper, router } = await mountApp('/', fakeGateway(), { languages: ['en-US'] })
    expect(wrapper.get('h1').text()).toBe('Volume survey')
    await wrapper.get('[data-test="start-survey"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="kpi-used"]').text()).toContain('891.4 GB')
    expect(wrapper.get('[data-test="health"]').text()).toContain('Critical')
    await router.push('/classificacao')
    await flushPromises()
    expect(wrapper.get('[data-test="row"]').text()).toContain('Label npm-cache')
    expect(wrapper.get('[data-test="row"]').text()).toContain('official command')
    await wrapper.get('[data-test="tab-C"]').trigger('click')
    expect(wrapper.findAll('[data-test="row"]')[1]!.text()).toContain('blocked: variable CUDA_PATH points to this path')
    expect(wrapper.get('[data-test="skipped"]').text()).toContain('excluded: excluded in Settings')
    await wrapper.get('[data-test="tab-X"]').trigger('click')
    expect(wrapper.get('[data-test="exclusions"]').text()).toContain('MSI cache')
  })

  it('escolha explícita vence o sistema', async () => {
    const { wrapper } = await mountApp('/', fakeGateway(), { languages: ['en-US'], saved: { language: 'pt' } })
    expect(wrapper.get('h1').text()).toBe('Survey do volume')
  })

  it('erro do núcleo chega como código e é traduzido', async () => {
    const reportFails = vi.fn(async () => Promise.reject({ code: 'no_execution', params: {} }))
    const pt = await mountApp('/relatorio', fakeGateway({ report: reportFails }))
    expect(pt.wrapper.get('[data-test="report-error"]').text()).toContain('Nenhuma execução nesta sessão.')
    const en = await mountApp('/relatorio', fakeGateway({ report: reportFails }), { languages: ['en'] })
    expect(en.wrapper.get('[data-test="report-error"]').text()).toContain('No run in this session.')
  })
})

describe('vueErrorHandler', () => {
  it('registra erro com a origem', async () => {
    const { vueErrorHandler } = await import('./errorHandler')
    const log = vi.fn()
    const error = new Error('falhou')
    vueErrorHandler(log)(error, null, 'render function')
    expect(log).toHaveBeenCalledWith('[disk-cleanup]', 'render function', error)
    expect(() => vueErrorHandler()(error, null, 'x')).not.toThrow()
  })
})

describe('ramos de apresentação', () => {
  it('sem idiomas injetados usa o navigator; lista vazia cai em navigator.language', async () => {
    const { useI18n } = await import('./i18n')
    const pinia = createPinia()
    pinia.use(gatewayPlugin(fakeGateway()))
    pinia.use(settingsPlugin({ load: () => null, save: () => {} }))
    const Probe = defineComponent({ setup: () => ({ i18n: useI18n() }), render: () => null })
    vi.stubGlobal('navigator', { languages: [], language: 'pt-BR' })
    expect(mount(Probe, { global: { plugins: [pinia] } }).vm.i18n.locale.value).toBe('pt')
    vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' })
    expect(mount(Probe, { global: { plugins: [pinia] } }).vm.i18n.locale.value).toBe('en')
    vi.unstubAllGlobals()
  })

  it('Configurações com sistema em inglês mostram o nome do idioma do sistema', async () => {
    const { wrapper } = await mountApp('/configuracoes', fakeGateway(), { languages: ['en-US'] })
    expect(wrapper.get('[data-test="language"]').text()).toContain('Automatic (system: English)')
  })

  it('causas sem detalhe ou sem código de saída, item na fila e reabertura da Execução', async () => {
    const run = {
      ...runA,
      items: [
        { ...runA.items[0]!, status: 'failed' as const, cause: { code: 'exit' as const, detail: null, exitCode: null } },
        { ...runA.items[1]!, status: 'ok' as const, cause: null },
      ],
    }
    let finish: (value: typeof run) => void = () => {}
    const executeTier = vi.fn((_tier, onEvent) => {
      onEvent({ kind: 'started', id: 'npm-cache', result: null })
      return new Promise<typeof run>((resolve) => (finish = resolve))
    })
    const ctx = await mountApp('/', fakeGateway({ executeTier }))
    usePlanStore(ctx.pinia).approval = approval
    await ctx.router.push('/execucao')
    await flushPromises()
    await ctx.wrapper.get('[data-test="execute"]').trigger('click')
    await ctx.wrapper.get('[data-test="confirm-execute"]').trigger('click')
    await flushPromises()
    const running = ctx.wrapper.get('[data-test="running"]').text()
    expect(running).toContain('rodando')
    expect(running).toContain('na fila')
    finish(run)
    await flushPromises()
    expect(ctx.wrapper.findAll('[data-test="result"]')[0]!.text()).toContain('saída ?:')
    await ctx.router.push('/')
    await flushPromises()
    await ctx.router.push('/execucao')
    await vi.waitFor(() => expect(ctx.wrapper.findAll('[data-test="stage"]')).toHaveLength(2))
    expect(ctx.wrapper.findAll('[data-test="result"]')).toHaveLength(2)
  })

  it('relatório com pendência sem causa e divergência sem motivo; cópia que falha sem Error', async () => {
    const odd = {
      ...report,
      pending: [{ ...report.pending[0]!, cause: null }],
      blocked: [{ ...report.blocked[0]!, blocked: null }],
    }
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => Promise.reject('negado')) }, languages: ['pt-BR'], language: 'pt-BR' })
    const { wrapper } = await mountApp('/relatorio', fakeGateway({ report: vi.fn(async () => odd) }))
    expect(wrapper.get('[data-test="report-pending"]').text()).toContain('parcial:')
    expect(wrapper.get('[data-test="report-blocked"]').text()).toContain('mantido:')
    await wrapper.get('[data-test="copy-report"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="copy-report-status"]').text()).toBe('Falha ao copiar: negado')
    vi.unstubAllGlobals()
  })

  it('markdown com causa sem detalhe nem código', async () => {
    const { reportMarkdown } = await import('../domain/report')
    const { translate } = await import('../i18n/i18n')
    const { pt } = await import('../i18n/messages')
    const pending = [{ ...report.pending[0]!, cause: { code: 'exit' as const, detail: null, exitCode: null } }]
    expect(reportMarkdown({ ...report, pending }, (k, p) => translate(pt, k, p), 'pt')).toContain('(parcial): saída ?: ')
  })
})

describe('Atualizações', () => {
  it('na instalação padrão verifica o canal estável ao abrir e mostra a versão instalada', async () => {
    const { wrapper, updater, router } = await mountApp('/')
    expect(updater.check).toHaveBeenCalledWith(false)
    expect(wrapper.get('[data-test="app-version"]').text()).toBe('v0.1.0')
    expect(wrapper.find('[data-test="update-notice"]').exists()).toBe(false)
    await router.push('/configuracoes')
    await flushPromises()
    expect(wrapper.get('[data-test="update-settings"]').text()).toContain('Versão instalada: 0.1.0')
    expect(wrapper.get('[data-test="update-status"]').text()).toBe('Você está na versão mais recente.')
    expect((wrapper.get('[data-test="auto-update"]').element as HTMLInputElement).checked).toBe(true)
    expect((wrapper.get('[data-test="beta-updates"]').element as HTMLInputElement).checked).toBe(false)
  })

  it('baixa em segundo plano e reinicia para atualizar pelo aviso da barra lateral', async () => {
    const updater = fakeUpdater({ check: vi.fn(async () => updateInfo) })
    const { wrapper } = await mountApp('/', fakeGateway(), { updater })
    const notice = wrapper.get('[data-test="update-notice"]')
    expect(notice.text()).toContain('Versão 0.2.0 pronta para instalar')
    await wrapper.get('[data-test="update-restart"]').trigger('click')
    await flushPromises()
    expect(updater.install).toHaveBeenCalledTimes(1)
  })

  it('com atualização automática desligada: verificar agora no canal beta e baixar manualmente', async () => {
    const updater = fakeUpdater({ check: vi.fn(async () => updateInfo) })
    const { wrapper, saved } = await mountApp('/configuracoes', fakeGateway(), { updater, saved: { autoUpdate: false } })
    expect(updater.check).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="update-status"]').exists()).toBe(false)
    await wrapper.get('[data-test="beta-updates"]').setValue(true)
    await wrapper.get('[data-test="auto-update"]').setValue(true)
    expect(saved.at(-1)).toMatchObject({ autoUpdate: true, betaUpdates: true })
    await wrapper.get('[data-test="update-check"]').trigger('click')
    await flushPromises()
    expect(updater.check).toHaveBeenCalledWith(true)
    expect(wrapper.get('[data-test="update-notice"]').text()).toContain('Versão 0.2.0 disponível')
    await wrapper.get('[data-test="update-download"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="update-notice"]').text()).toContain('pronta para instalar')
    await wrapper.get('[data-test="auto-update"]').setValue(false)
    expect(saved.at(-1)).toMatchObject({ autoUpdate: false })
  })

  it('mostra progresso do download, instalação em curso e erro traduzido', async () => {
    let finish: () => void = () => {}
    let report: (p: { downloaded: number; total: number | null; percent: number | null }) => void = () => {}
    const download = vi.fn((onProgress: typeof report) => {
      report = onProgress
      return new Promise<void>((resolve) => (finish = resolve))
    })
    let installed: () => void = () => {}
    const install = vi.fn(() => new Promise<void>((resolve) => (installed = resolve)))
    const updater = fakeUpdater({ check: vi.fn(async () => updateInfo), download, install })
    const { wrapper } = await mountApp('/', fakeGateway(), { updater })
    const text = () => wrapper.get('[data-test="update-notice"]').text()
    expect(text()).toContain('Baixando 0.2.0…')
    report({ downloaded: 42, total: 100, percent: 42 })
    await flushPromises()
    expect(text()).toContain('Baixando 0.2.0… 42%')
    finish()
    await flushPromises()
    await wrapper.get('[data-test="update-restart"]').trigger('click')
    expect(text()).toContain('Instalando…')
    installed()
    await flushPromises()

    const failing = fakeUpdater({ check: vi.fn(async () => Promise.reject({ code: 'update_feed', params: { detail: 'offline' } })) })
    const ctx = await mountApp('/configuracoes', fakeGateway(), { updater: failing })
    expect(ctx.wrapper.get('[data-test="update-status"]').text()).toBe(
      'Falha na atualização: não foi possível ler as releases: offline',
    )
    expect(ctx.wrapper.find('[data-test="update-notice"]').exists()).toBe(false)
  })

  it('sem versão legível mostra traço; em inglês o aviso é traduzido', async () => {
    const updater = fakeUpdater({
      appVersion: vi.fn(async () => Promise.reject(new Error('sem IPC'))),
      check: vi.fn(async () => updateInfo),
    })
    const { wrapper } = await mountApp('/configuracoes', fakeGateway(), { updater, saved: { language: 'en' } })
    expect(wrapper.get('[data-test="app-version"]').text()).toBe('—')
    expect(wrapper.get('[data-test="update-settings"]').text()).toContain('Installed version: —')
    expect(wrapper.get('[data-test="update-notice"]').text()).toContain('Version 0.2.0 ready to install')
    expect(wrapper.get('[data-test="update-restart"]').text()).toBe('Restart and update')
  })
})
