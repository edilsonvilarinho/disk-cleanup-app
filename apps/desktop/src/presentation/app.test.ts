import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent } from 'vue'
import { createMemoryHistory } from 'vue-router'
import type { DiskCleanupGateway } from '../application/gateway'
import { backgroundPlugin, type BackgroundPort } from '../application/background'
import { exporterPlugin, type ReportExporter } from '../application/exporter'
import { gatewayPlugin } from '../application/gatewayPlugin'
import { historyPlugin, memoryHistoryStorage, type HistoryStorage } from '../application/history'
import { settingsPlugin, type Settings } from '../application/settings'
import { useClassificationStore } from '../application/stores/classification'
import { usePlanStore } from '../application/stores/plan'
import { useSettingsStore } from '../application/stores/settings'
import { ThemeController } from '../application/theme'
import { updaterPlugin, type UpdaterPort } from '../application/updater'
import { fakeBackground } from '../test/fakeBackground'
import { fakeGateway } from '../test/fakeGateway'
import { fakeUpdater, updateInfo } from '../test/fakeUpdater'
import { approval, candidate, classification, report, runA, runCTrash, stepsA, survey } from '../test/fixtures'
import { GIB } from '../domain/format'
import { toSnapshot, type ScanSnapshot } from '../domain/history'
import App from './App.vue'
import { SYSTEM_LANGUAGES_KEY } from './i18n'
import { volumeLabel } from './labels'
import { createAppRouter } from './router'
import { THEME_KEY, useTheme } from './theme'

interface MountOptions {
  languages?: string[]
  saved?: Partial<Settings>
  updater?: UpdaterPort
  history?: HistoryStorage
  exporter?: ReportExporter
  background?: BackgroundPort
}

function fakeExporter(overrides: Partial<ReportExporter> = {}): ReportExporter {
  return {
    print: vi.fn(async () => {}),
    renderPng: vi.fn(async () => new Uint8Array([137, 80, 78, 71])),
    savePng: vi.fn(async () => 'C:\\Users\\u\\r.png'),
    ...overrides,
  }
}

async function mountApp(path: string, gateway: DiskCleanupGateway = fakeGateway(), options: MountOptions = {}) {
  const saved: Settings[] = []
  const pinia = createPinia()
  const updater = options.updater ?? fakeUpdater()
  pinia.use(gatewayPlugin(gateway))
  pinia.use(settingsPlugin({ load: () => options.saved ?? null, save: (s) => saved.push(structuredClone(s)) }))
  pinia.use(updaterPlugin(updater))
  pinia.use(historyPlugin(options.history ?? memoryHistoryStorage()))
  pinia.use(exporterPlugin(options.exporter ?? fakeExporter()))
  pinia.use(backgroundPlugin(options.background ?? fakeBackground()))
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
  it('mostra as 5 etapas e o ambiente na barra de status; o tema não fica na barra lateral', async () => {
    const { wrapper } = await mountApp('/')
    // Início: só a Varredura é navegável; as demais abas ficam trancadas.
    expect(wrapper.findAll('[data-test="nav"] .flow-step')).toHaveLength(5)
    expect(wrapper.findAll('[data-test="nav"] a')).toHaveLength(1)
    expect(wrapper.get('[data-test="nav"] a[aria-current="page"]').text()).toContain('Varredura')
    expect(wrapper.get('[data-test="step-classify"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-test="step-classify"]').attributes('title')).toContain('Varredura')
    const bar = wrapper.get('[data-test="statusbar"]')
    expect(bar.get('[data-test="env-os"]').text()).toBe('windows')
    // Catálogo igual ao sistema não se repete.
    expect(bar.find('[data-test="env-catalog"]').exists()).toBe(false)
    expect(bar.get('[data-test="sb-state"]').text()).toBe('Pronto')
    expect(bar.text()).toContain('C:\\')
    expect(bar.text()).toContain('Aprovação explícita')
    expect(wrapper.find('[data-test="theme-toggle"]').exists()).toBe(false)
    expect(wrapper.find('.sidebar .env').exists()).toBe(false)
    expect(document.documentElement.getAttribute('lang')).toBe('pt-BR')
  })

  it('a barra de status mostra o catálogo quando difere do sistema e leva a versão às Configurações', async () => {
    const systemInfo = vi.fn(async () => ({ os: 'linux', volumeRoot: '/', profile: '/home/u', catalog: 'macos', projectProfiles: [] }))
    const { wrapper, router } = await mountApp('/', fakeGateway({ systemInfo }))
    expect(wrapper.get('[data-test="env-catalog"]').text()).toContain('macos')
    await wrapper.get('[data-test="app-version"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/configuracoes'))
  })

  it('libera as abas conforme cada etapa é concluída', async () => {
    const { wrapper, router, pinia } = await mountApp('/')
    const isLink = (name: string) => wrapper.get(`[data-test="step-${name}"]`).element.tagName === 'A'
    await wrapper.get('[data-test="start-survey"]').trigger('click')
    await flushPromises()
    expect(isLink('classify')).toBe(true)
    expect(isLink('plan')).toBe(false)

    await router.push('/classificacao')
    await flushPromises()
    expect(isLink('plan')).toBe(true)
    expect(wrapper.get('[data-test="step-survey"]').classes()).toContain('done')
    expect(isLink('execute')).toBe(false)

    usePlanStore(pinia).approval = approval
    await flushPromises()
    expect(isLink('execute')).toBe(true)
    expect(isLink('report')).toBe(false)
  })

  it('tranca o Plano quando a seleção fica vazia', async () => {
    const { wrapper } = await mountApp('/classificacao')
    for (const tier of ['A', 'C']) {
      await wrapper.get(`[data-test="tab-${tier}"]`).trigger('click')
      for (const box of wrapper.findAll('[data-test="row"] input:not([disabled])')) await box.setValue(false)
    }
    expect(wrapper.get('[data-test="step-plan"]').element.tagName).not.toBe('A')
    expect(wrapper.get('[data-test="to-plan"]').attributes('disabled')).toBeDefined()
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

  it('mostra o progresso enquanto varre: contadores, tempo decorrido e ritmo', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    let finish: (v: typeof survey) => void = () => {}
    let progress: (p: { files: number; logicalBytes: number }) => void = () => {}
    const runSurvey = vi.fn((_r, onProgress) => {
      progress = onProgress
      onProgress({ files: 20_000, logicalBytes: 5 * 1024 ** 3 })
      return new Promise<typeof survey>((resolve) => (finish = resolve))
    })
    const { wrapper } = await mountApp('/', fakeGateway({ runSurvey }))
    await wrapper.get('[data-test="start-survey"]').trigger('click')
    await flushPromises()
    const card = () => wrapper.get('[data-test="survey-progress"]')
    expect(card().text()).toContain('20.000')
    expect(card().text()).toContain('Varrendo C:\\')
    expect(wrapper.get('[data-test="sb-state"]').text()).toBe('Varrendo C:\\ · 20.000 arquivos')
    expect(wrapper.get('[data-test="start-survey"]').attributes('disabled')).toBeDefined()
    progress({ files: 70_000, logicalBytes: 9 * 1024 ** 3 })
    vi.advanceTimersByTime(500)
    await flushPromises()
    // 50.000 arquivos em 0,5 s = 100.000 arquivos/s.
    expect(wrapper.get('[data-test="scan-rate"]').text()).toBe('100.000')
    vi.advanceTimersByTime(1500)
    await flushPromises()
    expect(wrapper.get('[data-test="scan-clock"]').text()).toBe('00:02')
    finish(survey)
    await flushPromises()
    expect(wrapper.find('[data-test="survey-progress"]').exists()).toBe(false)
    vi.useRealTimers()
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
    expect(wrapper.get('[data-test="sb-state"]').text()).toBe('Classificando…')
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
    // Grupos por tier começam recolhidos; abrir um e depois "expandir/recolher todos".
    const groups = wrapper.findAll('[data-test="plan-group"]')
    expect(groups.every((g) => g.attributes('data-open') === 'false')).toBe(true)
    await groups[0]!.get('button').trigger('click')
    expect(groups[0]!.attributes('data-open')).toBe('true')
    await wrapper.get('[data-test="toggle-groups"]').trigger('click')
    expect(wrapper.findAll('[data-test="plan-group"]').every((g) => g.attributes('data-open') === 'true')).toBe(true)
    expect(wrapper.get('[data-test="toggle-groups"]').text()).toBe('Recolher todos')
    await wrapper.get('[data-test="toggle-groups"]').trigger('click')
    expect(wrapper.findAll('[data-test="plan-group"]').every((g) => g.attributes('data-open') === 'false')).toBe(true)
    // plan.json fica numa gaveta: abre, fecha pelo botão e pelo Esc.
    expect(wrapper.find('[data-test="plan-json"]').exists()).toBe(false)
    await wrapper.get('[data-test="open-json"]').trigger('click')
    expect(wrapper.get('[data-test="plan-json"]').text()).toContain('"volume": "C:"')
    await wrapper.get('[data-test="close-json"]').trigger('click')
    expect(wrapper.find('[data-test="json-drawer"]').exists()).toBe(false)
    await wrapper.get('[data-test="open-json"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    expect(wrapper.find('[data-test="json-drawer"]').exists()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('[data-test="json-drawer"]').exists()).toBe(false)
    await wrapper.get('[data-test="open-json"]').trigger('click')
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

describe('Projetos na Classificação', () => {
  it('mostra a idade, filtra por idade mínima e guarda a escolha', async () => {
    const project = (name: string, idle: number | null) =>
      candidate(`project:D:\\dev\\${name}\\node_modules`, 'C', 1, { origin: 'project', project: `D:\\dev\\${name}`, idleDays: idle, label: { pt: `${name} · node_modules`, en: `${name} · node_modules` } })
    const withProjects = { ...classification, candidates: [...classification.candidates, project('loja', 412), project('novo', 0), project('x', null)] }
    const { wrapper, saved } = await mountApp('/classificacao', fakeGateway({ classify: vi.fn(async () => withProjects) }))
    await wrapper.get('[data-test="tab-C"]').trigger('click')
    const rows = () => wrapper.findAll('[data-test="row"]').filter((r) => r.text().includes('node_modules'))
    expect(rows()[0]!.text()).toContain('sem atividade há 412 dias')
    expect(rows()[1]!.text()).toContain('atividade hoje')
    expect(rows()[2]!.text()).toContain('idade desconhecida')
    const checked = () => rows().map((r) => (r.get('input').element as HTMLInputElement).checked)
    expect(checked()).toEqual([true, false, false])
    await wrapper.get('[data-test="min-idle"]').setValue('30')
    expect(saved.at(-1)!.minIdleDays).toBe(30)
    expect(checked()).toEqual([true, false, false])
    await wrapper.get('[data-test="min-idle"]').setValue('365')
    expect(checked()).toEqual([true, false, false])
    // tier sem projetos não mostra o filtro
    await wrapper.get('[data-test="tab-A"]').trigger('click')
    expect(wrapper.find('[data-test="min-idle"]').exists()).toBe(false)
  })
})

describe('Monitoramento', () => {
  it('avisa uma vez quando o livre está abaixo do limite; limite desligado nem mede', async () => {
    const background = fakeBackground({ volumeUsage: vi.fn(async () => ({ ...survey.volume, freeBytes: 10 * GIB })) })
    await mountApp('/', fakeGateway(), { background, saved: { lowSpaceGb: 15 } })
    await flushPromises()
    expect(background.notify).toHaveBeenCalledTimes(1)
    expect(vi.mocked(background.notify).mock.calls[0]![0]).toBe('Pouco espaço em C:\\')
    expect(vi.mocked(background.notify).mock.calls[0]![1]).toContain('10,0 GB livres (limite 15 GB)')

    const off = fakeBackground()
    await mountApp('/', fakeGateway(), { background: off, saved: { lowSpaceGb: 0 } })
    await flushPromises()
    expect(off.volumeUsage).not.toHaveBeenCalled()
  })

  it('falha ao medir não derruba o app nem avisa', async () => {
    const background = fakeBackground({ volumeUsage: vi.fn(async () => Promise.reject(new Error('sem volume'))) })
    const { wrapper } = await mountApp('/', fakeGateway(), { background })
    await flushPromises()
    expect(background.notify).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="statusbar"]').exists()).toBe(true)
  })

  it('varredura agendada roda sem varredura anterior e mostra a próxima na barra', async () => {
    const { wrapper, gateway } = await mountApp('/', fakeGateway(), { saved: { schedule: 'weekly' } })
    await flushPromises()
    expect(gateway.runSurvey).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-test="sb-next-scan"]').text()).toContain('Próxima varredura')
    const quiet = await mountApp('/', fakeGateway())
    await flushPromises()
    expect(quiet.gateway.runSurvey).not.toHaveBeenCalled()
    expect(quiet.wrapper.find('[data-test="sb-next-scan"]').exists()).toBe(false)
  })

  it('bandeja e "Varrer agora": liga com os textos traduzidos e varre só lendo', async () => {
    const background = fakeBackground()
    const { wrapper, gateway, router, saved } = await mountApp('/configuracoes', fakeGateway(), { background })
    await flushPromises()
    expect(wrapper.get('[data-test="never-auto"]').text()).toContain('nunca')
    await wrapper.get('[data-test="bg-tray"] input').setValue(true)
    await flushPromises()
    expect(background.setBackground).toHaveBeenLastCalledWith(true, expect.objectContaining({ open: 'Abrir Disk Cleanup', quit: 'Sair' }))
    expect(saved.at(-1)!.backgroundEnabled).toBe(true)
    await wrapper.get('[data-test="low-space"]').setValue('25')
    expect(saved.at(-1)!.lowSpaceGb).toBe(25)
    await wrapper.get('[data-test="schedule"]').setValue('daily')
    expect(saved.at(-1)!.schedule).toBe('daily')
    background.trayScan()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
    expect(gateway.runSurvey).toHaveBeenCalled()
  })

  it('com a bandeja ligada nas preferências, liga ao abrir', async () => {
    const background = fakeBackground({ setBackground: vi.fn(async () => Promise.reject(new Error('sem bandeja'))) })
    await mountApp('/', fakeGateway(), { background, saved: { backgroundEnabled: true } })
    await flushPromises()
    expect(background.setBackground).toHaveBeenCalledWith(true, expect.objectContaining({ scan: 'Varrer agora (somente leitura)' }))
  })
})

describe('Duplicados na Classificação', () => {
  it('procura sob demanda, mostra as etapas e oferece a cópia sem marcar', async () => {
    const dup = candidate('dup:C:\\Users\\u\\b.zip', 'D', 2, {
      origin: 'duplicate',
      label: { pt: 'b.zip', en: 'b.zip' },
      note: { pt: 'cópia de C:\\Users\\u\\a.zip', en: 'copy of C:\\Users\\u\\a.zip' },
    })
    const classify = vi
      .fn()
      .mockResolvedValueOnce(classification)
      .mockResolvedValueOnce({ ...classification, candidates: [...classification.candidates, dup] })
    const { wrapper, gateway } = await mountApp('/classificacao', fakeGateway({ classify }))
    await wrapper.get('[data-test="tab-A"]').trigger('click')
    expect(wrapper.find('[data-test="find-duplicates"]').exists()).toBe(false)
    await wrapper.get('[data-test="tab-D"]').trigger('click')
    expect(wrapper.find('[data-test="duplicates-summary"]').exists()).toBe(false)
    // seleção manual anterior sobrevive à reclassificação
    await wrapper.get('[data-test="tab-A"]').trigger('click')
    await wrapper.findAll('[data-test="row"]')[0]!.get('input').trigger('change')
    await wrapper.get('[data-test="tab-D"]').trigger('click')
    await wrapper.get('[data-test="find-duplicates"]').trigger('click')
    await flushPromises()
    expect(gateway.findDuplicates).toHaveBeenCalledTimes(1)
    expect(classify).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-test="duplicates-summary"]').text()).toContain('2 confirmados byte a byte (1 grupos)')
    const row = wrapper.findAll('[data-test="row"]').find((r) => r.text().includes('b.zip'))!
    expect(row.text()).toContain('cópia de C:\\Users\\u\\a.zip')
    expect((row.get('input').element as HTMLInputElement).checked).toBe(false)
    await wrapper.get('[data-test="tab-A"]').trigger('click')
    expect((wrapper.findAll('[data-test="row"]')[0]!.get('input').element as HTMLInputElement).checked).toBe(false)
  })

  it('erro na busca aparece sem perder a classificação', async () => {
    const findDuplicates = vi.fn(async () => Promise.reject(new Error('sem acesso ao perfil')))
    const { wrapper } = await mountApp('/classificacao', fakeGateway({ findDuplicates }))
    await wrapper.get('[data-test="tab-D"]').trigger('click')
    await wrapper.get('[data-test="find-duplicates"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="classify-error"]').text()).toContain('sem acesso ao perfil')
    expect(wrapper.findAll('[data-test="tab-A"]')).toHaveLength(1)
  })
})

describe('Mapa do volume', () => {
  it('entra na pasta, volta pela trilha e não abre "outros" nem folha', async () => {
    const { wrapper } = await mountApp('/')
    await wrapper.get('[data-test="start-survey"]').trigger('click')
    await flushPromises()
    const cells = () => wrapper.findAll('[data-test="tm-cell"]')
    expect(cells().map((c) => c.attributes('aria-label'))).toEqual(['Users · 412,6 GB', 'Windows · 38,9 GB'])
    await cells()[1]!.trigger('click')
    expect(cells()).toHaveLength(2)
    await cells()[0]!.trigger('click')
    expect(wrapper.get('[data-test="crumb-1"]').text()).toBe('Users')
    expect(cells().map((c) => c.attributes('aria-label'))).toEqual(['u · 400,0 GB', 'outros · 12,6 GB'])
    await cells()[1]!.trigger('click')
    expect(wrapper.find('[data-test="crumb-2"]').exists()).toBe(false)
    await cells()[0]!.trigger('click')
    expect(wrapper.find('[data-test="crumb-2"]').exists()).toBe(false)
    await wrapper.get('[data-test="crumb-0"]').trigger('click')
    expect(cells()).toHaveLength(2)
  })

  it('volume sem subpastas medidas explica em vez de desenhar vazio', async () => {
    const runSurvey = vi.fn(async () => ({ ...survey, tree: { name: 'C:\\', bytes: 1, children: [] } }))
    const { wrapper } = await mountApp('/', fakeGateway({ runSurvey }))
    await wrapper.get('[data-test="start-survey"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="treemap-empty"]').text()).toContain('Sem subpastas')
  })
})

describe('Arquivos grandes na Classificação', () => {
  it('mostra a idade, avisa que nada vem marcado e deixa marcar um a um', async () => {
    const iso = candidate('file:C:\\Users\\u\\Downloads\\ubuntu.iso', 'D', 4.9, {
      origin: 'file',
      idleDays: 420,
      label: { pt: 'ubuntu.iso', en: 'ubuntu.iso' },
      risk: 'low',
    })
    const novo = candidate('file:C:\\Users\\u\\x.bin', 'D', 1, { origin: 'file', idleDays: null, label: { pt: 'x.bin', en: 'x.bin' } })
    const withFiles = { ...classification, candidates: [...classification.candidates, iso, novo] }
    const { wrapper } = await mountApp('/classificacao', fakeGateway({ classify: vi.fn(async () => withFiles) }))
    await wrapper.get('[data-test="tab-D"]').trigger('click')
    expect(wrapper.text()).toContain('nada vem marcado')
    const rows = wrapper.findAll('[data-test="row"]')
    expect(rows[0]!.text()).toContain('modificado há 420 dias')
    expect(rows[1]!.text()).toContain('idade desconhecida')
    const box = rows[0]!.get('input')
    expect((box.element as HTMLInputElement).checked).toBe(false)
    await box.trigger('change')
    expect((box.element as HTMLInputElement).checked).toBe(true)
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
    expect(approve.attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-test="approve-missing"]').text()).toContain('Confirme a revisão')
    expect(wrapper.get('[data-test="approve-tier-A"]').element).toHaveProperty('checked', true)
    expect(wrapper.get('[data-test="run-count"]').text()).toBe('3')
    // Sem varredura nesta sessão não há espaço livre de partida para estimar.
    expect(wrapper.find('[data-test="free-after"]').exists()).toBe(false)
    // Clicar antes da hora não aprova: destaca a confirmação que falta e põe o foco nela.
    await approve.trigger('click')
    await flushPromises()
    expect(gateway.approvePlan).not.toHaveBeenCalled()
    expect(wrapper.get('[data-test="ack"]').element.closest('label')!.classList.contains('attn')).toBe(true)
    await wrapper.get('[data-test="ack"]').setValue(true)
    expect(approve.attributes('aria-disabled')).toBe('false')
    expect(wrapper.find('[data-test="approve-missing"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="approve-ready"]').text()).toBe('Pronto para aprovar.')
    await wrapper.get('[data-test="approve-tier-A"]').setValue(false)
    await wrapper.get('[data-test="approve-tier-C"]').setValue(false)
    expect(wrapper.get('[data-test="approve-missing"]').text()).toContain('ao menos um tier')
    expect(wrapper.get('[data-test="plan-items"]').text()).toContain('fora desta execução')
    await approve.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="plan-tiers"]').classes()).toContain('attn')
    await wrapper.get('[data-test="approve-tier-A"]').setValue(true)
    await approve.trigger('click')
    await flushPromises()
    expect(gateway.approvePlan).toHaveBeenCalledWith(['A'], { A: 'permanent' }, true)
    // A Execução é carregada sob demanda: a navegação termina depois do import.
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/execucao'))
  })

  it('com varredura feita, estima o livre depois dos tiers que vão rodar', async () => {
    const { wrapper, router } = await mountApp('/')
    await wrapper.get('[data-test="start-survey"]').trigger('click')
    await flushPromises()
    await router.push('/classificacao')
    await flushPromises()
    await router.push('/plano')
    await flushPromises()
    // Só o que libera agora entra no livre depois: C vai para a Lixeira por padrão.
    const before = wrapper.get('[data-test="free-after"]').text()
    await wrapper.get('[data-test="approve-tier-C"]').setValue(false)
    expect(wrapper.get('[data-test="free-after"]').text()).toBe(before)
    expect(wrapper.get('[data-test="run-count"]').text()).toBe('2')
    await wrapper.get('[data-test="approve-tier-A"]').setValue(false)
    expect(wrapper.get('[data-test="free-after"]').text()).not.toBe(before)
  })

  it('escolhe o destino de cada tier e separa o que libera agora do que vai para a Lixeira', async () => {
    const { wrapper, gateway } = await planScreen()
    // Padrões: A definitivo; C (gradle, caminho de 14,2 GB) para a Lixeira.
    expect(wrapper.get('[data-test="dest-A-permanent"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-test="dest-C-trash"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-test="run-bytes"]').text()).toBe('11,2 GB')
    expect(wrapper.get('[data-test="trash-bytes"]').text()).toBe('14,2 GB')
    expect(wrapper.get('[data-test="plan-items"]').text()).toContain('vai para a Lixeira')
    expect(wrapper.get('[data-test="plan-items"]').text()).toContain('remoção definitiva')
    await wrapper.get('[data-test="dest-C-permanent"]').trigger('click')
    expect(wrapper.find('[data-test="trash-bytes"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="run-bytes"]').text()).toBe('25,4 GB')
    // Comando não vai para a Lixeira: em A só o caminho (4,8 GB) muda de destino.
    await wrapper.get('[data-test="dest-A-trash"]').trigger('click')
    expect(wrapper.get('[data-test="trash-bytes"]').text()).toBe('4,8 GB')
    await wrapper.get('[data-test="ack"]').setValue(true)
    await wrapper.get('[data-test="approve"]').trigger('click')
    await flushPromises()
    expect(gateway.approvePlan).toHaveBeenCalledWith(['A', 'C'], { A: 'trash', C: 'permanent' }, true)
  })

  it('tier só com comandos não tem destino a escolher', async () => {
    const { wrapper, pinia } = await planScreen()
    useClassificationStore(pinia).selected = ['npm-cache', 'gradle-caches']
    await flushPromises()
    expect(wrapper.find('[data-test="dest-A-trash"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="dest-A-none"]').text()).toContain('só comandos')
    expect(wrapper.find('[data-test="dest-C-trash"]').exists()).toBe(true)
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
    // Guia: passo 1 de 2, começando pelo tier A; o tier seguinte aguarda.
    expect(wrapper.get('[data-test="guide"]').text()).toContain('Passo 1 de 2')
    expect(wrapper.get('[data-test="guide"]').text()).toContain('Comece pelo tier A · Cache')
    const stages = wrapper.findAll('[data-test="stage"]')
    expect(stages[0]!.classes()).toContain('current')
    expect(stages[1]!.text()).toContain('Aguardando')

    await wrapper.get('[data-test="execute"]').trigger('click')
    expect(wrapper.get('[data-test="confirm"]').text()).toContain('2 itens')
    expect(wrapper.get('[data-test="guide"]').text()).toContain('Confirmar tier A')
    expect(wrapper.get('[data-test="execute"]').attributes('disabled')).toBeDefined()
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
    expect(wrapper.get('[data-test="guide"]').text()).toContain('Próximo: tier C')
    // Tier concluído recolhe; o resultado abre com um clique (e o atual não recolhe).
    const done = wrapper.findAll('[data-test="stage"]')[0]!
    expect(done.attributes('data-open')).toBe('false')
    await done.get('button').trigger('click')
    expect(done.attributes('data-open')).toBe('true')
    await wrapper.findAll('[data-test="stage"]')[1]!.get('button').trigger('click')
    expect(wrapper.findAll('[data-test="stage"]')[1]!.attributes('data-open')).toBe('true')

    await wrapper.get('[data-test="execute"]').trigger('click')
    await wrapper.get('[data-test="confirm-execute"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="total-freed"]').text()).toContain('24,8 GB')
    expect(wrapper.get('[data-test="guide"]').text()).toContain('Execução concluída')
    expect(wrapper.get('[data-test="guide"]').text()).toContain('Passo 2 de 2')
    expect(wrapper.get('[data-test="to-report"]').attributes('href')).toContain('relatorio')
  })

  it('mostra o tier em andamento e erros', async () => {
    const executeTier = vi.fn(() => new Promise<never>(() => {}))
    const { wrapper } = await executeScreen(fakeGateway({ executeTier }))
    await wrapper.get('[data-test="execute"]').trigger('click')
    await wrapper.get('[data-test="confirm-execute"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="guide"]').text()).toContain('Executando tier A · Cache')
    expect(wrapper.get('[data-test="executing"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-test="running"]').text()).toContain('na fila')

    const failing = await executeScreen(
      fakeGateway({ previewTier: vi.fn(async () => Promise.reject(new Error('nenhum plano aprovado'))) }),
    )
    expect(failing.wrapper.get('[data-test="execute-error"]').text()).toContain('nenhum plano aprovado')
  })
})

describe('Execução com Lixeira', () => {
  it('mostra o destino no dry-run, avisa na confirmação e conta o que foi para a Lixeira', async () => {
    const stepC = { ...stepsA[1]!, id: 'gradle-caches', tier: 'C' as const, target: 'C:\\x\\gradle-caches', disposal: 'trash' as const }
    const previewTier = vi.fn(async (tier: string) => (tier === 'A' ? stepsA : [stepC]))
    const executeTier = vi.fn(async (tier: string, onEvent: (e: never) => void) => {
      const run = tier === 'A' ? runA : runCTrash
      for (const item of run.items) onEvent({ kind: 'finished', id: item.id, result: item } as never)
      return run
    })
    const ctx = await mountApp('/', fakeGateway({ previewTier, executeTier } as never))
    usePlanStore(ctx.pinia).approval = { ...approval, disposals: { A: 'permanent', C: 'trash' } }
    await ctx.router.push('/execucao')
    await flushPromises()
    const w = ctx.wrapper
    expect(w.findAll('[data-test="step"]')[1]!.text()).toContain('definitivo')
    await w.get('[data-test="execute"]').trigger('click')
    expect(w.get('[data-test="confirm"]').text()).toContain('não pode ser desfeita')
    await w.get('[data-test="confirm-execute"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="step"]').text()).toContain('Lixeira')
    await w.get('[data-test="execute"]').trigger('click')
    expect(w.get('[data-test="confirm"]').text()).toContain('Lixeira')
    await w.get('[data-test="confirm-execute"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="total-trashed"]').text()).toContain('14,2 GB')
    expect(w.get('[data-test="guide"]').text()).toContain('na Lixeira')
    const stages = w.findAll('[data-test="stage"]')
    await stages[1]!.get('button').trigger('click')
    expect(stages[1]!.text()).toContain('14,2 GB na Lixeira')
    // Tier concluído mostra o medido, não mais o previsto.
    expect(stages[0]!.text()).not.toContain('previsto')
    expect(stages[1]!.text()).not.toContain('previsto')
  })
})

describe('Barra de status na Execução', () => {
  it('conta os itens já concluídos do tier em execução', async () => {
    const executeTier = vi.fn((_tier, onEvent) => {
      onEvent({ kind: 'started', id: 'npm-cache', result: null })
      onEvent({ kind: 'finished', id: 'npm-cache', result: runA.items[0]! })
      onEvent({ kind: 'started', id: 'nvidia-dxcache', result: null })
      return new Promise<never>(() => {})
    })
    const ctx = await mountApp('/', fakeGateway({ executeTier }))
    usePlanStore(ctx.pinia).approval = approval
    await ctx.router.push('/execucao')
    await flushPromises()
    await ctx.wrapper.get('[data-test="execute"]').trigger('click')
    await ctx.wrapper.get('[data-test="confirm-execute"]').trigger('click')
    await flushPromises()
    expect(ctx.wrapper.get('[data-test="sb-state"]').text()).toBe('Executando tier A · 1/2')
    expect(ctx.wrapper.get('[data-test="guide"]').text()).toContain('1 de 2 itens')
    const items = ctx.wrapper.findAll('[data-test="running"] .exec-item')
    expect(items[0]!.classes()).toContain('ok')
    expect(items[1]!.classes()).toContain('running')
  })
})

describe('Relatório', () => {
  it('mostra antes/depois, tiers, pendências, divergências e copia o Markdown', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { wrapper, gateway } = await mountApp('/relatorio')
    expect(gateway.report).toHaveBeenCalled()
    expect(wrapper.get('[data-test="report-freed"]').text()).toContain('+24,8 GB')
    expect(wrapper.find('[data-test="report-trashed"]').exists()).toBe(false)
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

  it('separa o que foi para a Lixeira do que foi liberado', async () => {
    const withTrash = { ...report, trashedBytes: 14.2 * GIB, runs: [runA, runCTrash] }
    const { wrapper } = await mountApp('/relatorio', fakeGateway({ report: vi.fn(async () => withTrash) }))
    expect(wrapper.get('[data-test="report-trashed"]').text()).toContain('14,2 GB')
    expect(wrapper.get('[data-test="report-tiers"]').text()).toContain('14,2 GB na Lixeira')
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

function seeded(): ScanSnapshot[] {
  const base = { volumeRoot: 'C:\\', profilePath: 'C:\\Users\\u', depth: 2 as const }
  const a = toSnapshot(survey, { ...base, id: 'a', at: new Date('2026-11-20T10:00:00Z') })
  const b = toSnapshot(
    { ...survey, volume: { ...survey.volume, usedBytes: survey.volume.usedBytes + 5 * GIB, freeBytes: survey.volume.freeBytes - 5 * GIB } },
    { ...base, id: 'b', at: new Date('2026-11-23T10:00:00Z') },
  )
  b.files = a.files + 1_000
  b.roots = b.roots.map((r) => (r.name === 'Windows' ? { ...r, bytes: r.bytes + 4 * GIB } : r))
  b.profile = [...b.profile.filter((p) => p.name !== 'AppData'), { key: 'Downloads', name: 'Downloads', bytes: 2 * GIB }]
  return [a, b]
}

describe('Histórico', () => {
  it('fica nas seções da barra lateral, sem as abas do fluxo', async () => {
    const { wrapper, router } = await mountApp('/historico')
    await flushPromises()
    expect(wrapper.find('[data-test="nav"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="nav-history"]').attributes('aria-current')).toBe('page')
    expect(wrapper.get('[data-test="history-empty"]').text()).toContain('Nenhuma varredura salva')

    await router.push('/plano')
    await flushPromises()
    expect(wrapper.get('[data-test="nav-cleanup"]').attributes('aria-current')).toBe('page')
    await router.push('/historico')
    await flushPromises()
    // "Limpeza" volta para a última etapa visitada.
    expect(wrapper.get('[data-test="nav-cleanup"]').attributes('href')).toContain('plano')
  })

  it('mostra KPIs, gráfico, comparação e tabela', async () => {
    const { wrapper } = await mountApp('/historico', fakeGateway(), { history: memoryHistoryStorage(seeded()) })
    await flushPromises()
    expect(wrapper.get('[data-test="kpi-count"]').text()).toContain('2')
    expect(wrapper.get('[data-test="kpi-previous"]').text()).toContain('+5,0 GB')
    expect(wrapper.findAll('[data-test="usage-chart"] circle')).toHaveLength(2)
    expect(wrapper.get('[data-test="cmp-summary"]').text()).toContain('3 dias')
    expect(wrapper.get('[data-test="diff-roots"]').text()).toContain('Windows')
    const profile = wrapper.get('[data-test="diff-profile"]').text()
    expect(profile).toContain('AppData')
    expect(profile).toContain('sumiu')
    expect(profile).toContain('nova')
    const rows = wrapper.findAll('[data-test="history-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('para')
    expect(rows[1]!.text()).toContain('de')

    await wrapper.get('[data-test="chart-hit"]').trigger('focus')
    expect(wrapper.get('[data-test="chart-tip"]').text()).toContain('+5,0 GB vs anterior')
    await wrapper.get('[data-test="chart-hit"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.get('[data-test="chart-tip"]').text()).not.toContain('vs anterior')
  })

  it('troca a comparação, exclui e limpa com confirmação', async () => {
    const storage = memoryHistoryStorage(seeded())
    const { wrapper } = await mountApp('/historico', fakeGateway(), { history: storage })
    await flushPromises()
    await wrapper.get('[data-test="cmp-from"]').setValue('b')
    expect(wrapper.find('[data-test="cmp-summary"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="same-scan"]').text()).toContain('diferentes')
    await wrapper.get('[data-test="cmp-from"]').setValue('a')
    expect(wrapper.get('[data-test="cmp-summary"]').text()).toContain('+5,0 GB')
    expect(wrapper.get('[data-test="cmp-summary"]').text()).toContain('+1.000')
    // Ordem invertida (para = a mais antiga): variação negativa.
    await wrapper.get('[data-test="cmp-from"]').setValue('b')
    await wrapper.get('[data-test="cmp-to"]').setValue('a')
    expect(wrapper.get('[data-test="cmp-summary"]').text()).toContain('-1.000')
    await wrapper.get('[data-test="cmp-from"]').setValue('a')
    await wrapper.get('[data-test="cmp-to"]').setValue('b')

    await wrapper.findAll('[data-test="remove-scan"]')[0]!.trigger('click')
    expect(wrapper.findAll('[data-test="history-row"]')).toHaveLength(1)
    expect(wrapper.find('[data-test="need-two"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="cmp-from"]').exists()).toBe(false)
    expect(storage.saved.at(-1)).toHaveLength(1)

    await wrapper.get('[data-test="clear-history"]').trigger('click')
    await wrapper.get('[data-test="clear-cancel"]').trigger('click')
    expect(wrapper.find('[data-test="clear-confirm"]').exists()).toBe(false)
    await wrapper.get('[data-test="clear-history"]').trigger('click')
    expect(wrapper.get('[data-test="clear-confirm"]').text()).toContain('Apagar as 1 varreduras')
    await wrapper.get('[data-test="clear-ok"]').trigger('click')
    expect(wrapper.find('[data-test="history-empty"]').exists()).toBe(true)
    expect(storage.saved.at(-1)).toEqual([])
  })

  it('avisa quando o perfil difere e quando não consegue gravar', async () => {
    const [a, b] = seeded()
    b!.profilePath = 'C:\\Users\\outro'
    const { wrapper } = await mountApp('/historico', fakeGateway(), { history: { load: () => [a, b], save: () => false } })
    await flushPromises()
    expect(wrapper.find('[data-test="profile-differs"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="diff-profile"]').exists()).toBe(false)
    await wrapper.findAll('[data-test="remove-scan"]')[0]!.trigger('click')
    expect(wrapper.find('[data-test="history-save-failed"]').exists()).toBe(true)
  })

  it('detalha uma varredura escolhida pela tabela, pelo seletor ou pelo gráfico', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    try {
      const { wrapper } = await mountApp('/historico', fakeGateway(), { history: memoryHistoryStorage(seeded()) })
      await flushPromises()
      // Padrão: a última, com a variação desde a anterior e as maiores pastas.
      const summary = () => wrapper.get('[data-test="detail-summary"]').text()
      expect(summary()).toContain('+5,0 GB')
      expect(wrapper.get('[data-test="detail-roots"]').text()).toContain('Windows')
      expect(wrapper.get('[data-test="detail-profile"]').text()).toContain('Downloads')
      expect(wrapper.findAll('[data-test="history-row"]')[0]!.text()).toContain('em detalhe')
      expect(wrapper.find('circle.cur').exists()).toBe(true)

      // Tabela: "Ver" na mais antiga leva o detalhe até ela.
      await wrapper.findAll('[data-test="view-scan"]')[1]!.trigger('click')
      expect((wrapper.get('[data-test="detail-pick"]').element as HTMLSelectElement).value).toBe('a')
      expect(summary()).toContain('primeira')
      expect(wrapper.get('[data-test="detail-profile"]').text()).toContain('AppData')
      expect(wrapper.find('[data-test="detail-compare"]').exists()).toBe(false)
      expect(wrapper.findAll('[data-test="history-row"]')[1]!.classes()).toContain('current')
      expect(scroll).toHaveBeenCalledTimes(1)

      // Seletor + atalho de comparação com a anterior.
      await wrapper.get('[data-test="cmp-from"]').setValue('b')
      await wrapper.get('[data-test="detail-pick"]').setValue('b')
      await wrapper.get('[data-test="detail-compare"]').trigger('click')
      expect(wrapper.get('[data-test="cmp-summary"]').text()).toContain('+5,0 GB')
      expect(scroll).toHaveBeenCalledTimes(2)

      // Gráfico: ← e Enter escolhem a anterior, sem rolar a página.
      const hit = wrapper.get('[data-test="chart-hit"]')
      await hit.trigger('focus')
      await hit.trigger('keydown', { key: 'ArrowLeft' })
      await hit.trigger('keydown', { key: 'Enter' })
      expect((wrapper.get('[data-test="detail-pick"]').element as HTMLSelectElement).value).toBe('a')
      expect(scroll).toHaveBeenCalledTimes(2)
    } finally {
      delete (Element.prototype as Partial<Element>).scrollIntoView
    }
  })

  it('detalhe sem perfil avisa em vez de lista vazia', async () => {
    const [a] = seeded()
    const solo = { ...a!, profilePath: null, profile: [] }
    const { wrapper } = await mountApp('/historico', fakeGateway(), { history: memoryHistoryStorage([solo]) })
    await flushPromises()
    expect(wrapper.find('[data-test="detail-no-profile"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="detail-roots"]').text()).toContain('Windows')
  })

  it('o Survey mostra a variação desde a varredura anterior', async () => {
    const { wrapper } = await mountApp('/', fakeGateway(), { history: memoryHistoryStorage(seeded()) })
    await wrapper.get('[data-test="start-survey"]').trigger('click')
    await flushPromises()
    const link = wrapper.get('[data-test="since-last"]')
    expect(link.text()).toContain('-5,0 GB desde')
    expect(link.attributes('href')).toContain('historico')
  })
})

describe('Exportação do relatório', () => {
  it('PDF abre a impressão; imagem gera o cartão e mostra onde gravou', async () => {
    const exporter = fakeExporter()
    const { wrapper } = await mountApp('/relatorio', fakeGateway(), { exporter })
    await flushPromises()
    await wrapper.get('[data-test="export-pdf"]').trigger('click')
    expect(exporter.print).toHaveBeenCalled()

    await wrapper.get('[data-test="export-image"]').trigger('click')
    await flushPromises()
    const [svg, width] = vi.mocked(exporter.renderPng).mock.calls[0]!
    expect(svg).toContain('Relatório da limpeza')
    expect(svg).toContain('C:\\')
    expect(width).toBe(1200)
    expect(vi.mocked(exporter.savePng).mock.calls[0]![1]).toMatch(/^disk-cleanup-relatorio-\d{4}-\d{2}-\d{2}\.png$/)
    expect(wrapper.get('[data-test="export-saved"]').text()).toContain('C:\\Users\\u\\r.png')
  })

  it('cancelar e falhar aparecem como avisos distintos', async () => {
    const cancelled = await mountApp('/relatorio', fakeGateway(), { exporter: fakeExporter({ savePng: vi.fn(async () => null) }) })
    await flushPromises()
    await cancelled.wrapper.get('[data-test="export-image"]').trigger('click')
    await flushPromises()
    expect(cancelled.wrapper.get('[data-test="export-cancelled"]').text()).toContain('cancelada')

    const failing = fakeExporter({ savePng: vi.fn(async () => Promise.reject({ code: 'export_write', params: { detail: 'disco cheio' } })) })
    const failed = await mountApp('/relatorio', fakeGateway(), { exporter: failing })
    await flushPromises()
    await failed.wrapper.get('[data-test="export-image"]').trigger('click')
    await flushPromises()
    expect(failed.wrapper.get('[data-test="export-error"]').text()).toContain('não foi possível gravar o arquivo: disco cheio')
  })

  it('desabilita os botões enquanto gera', async () => {
    let release: (b: Uint8Array) => void = () => {}
    const exporter = fakeExporter({ renderPng: vi.fn(() => new Promise<Uint8Array>((r) => (release = r))) })
    const { wrapper } = await mountApp('/relatorio', fakeGateway(), { exporter })
    await flushPromises()
    await wrapper.get('[data-test="export-image"]').trigger('click')
    expect(wrapper.get('[data-test="export-image"]').text()).toContain('Gerando')
    expect(wrapper.get('[data-test="export-pdf"]').attributes('disabled')).toBeDefined()
    release(new Uint8Array([137]))
    await flushPromises()
    expect(wrapper.get('[data-test="export-pdf"]').attributes('disabled')).toBeUndefined()
  })
})

describe('Nova análise', () => {
  it('do Relatório volta ao Survey vazio, tranca as abas e mantém o histórico', async () => {
    const { wrapper, router, pinia } = await mountApp('/')
    await wrapper.get('[data-test="start-survey"]').trigger('click')
    await flushPromises()
    usePlanStore(pinia).approval = approval
    await router.push('/relatorio')
    await flushPromises()
    expect(wrapper.get('[data-test="step-classify"]').element.tagName).toBe('A')

    await wrapper.get('[data-test="new-analysis"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
    expect(wrapper.find('[data-test="kpi-used"]').exists()).toBe(false)
    for (const step of ['classify', 'plan', 'execute', 'report']) {
      expect(wrapper.get(`[data-test="step-${step}"]`).attributes('aria-disabled')).toBe('true')
    }
    expect(usePlanStore(pinia).approval).toBeNull()
    await router.push('/historico')
    await flushPromises()
    expect(wrapper.get('[data-test="kpi-count"]').text()).toContain('1')
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
      projectRoots: [],
      minIdleDays: 90,
      userRules: [],
      disabledProfiles: [],
      findOrphans: false,
      backgroundEnabled: false,
      lowSpaceGb: 15,
      schedule: 'off',
      releaseNotes: true,
      // Instalação nova (sem preferências nem histórico): a versão já conta como vista.
      seenVersion: '0.1.0',
    })
  })

  it('regra própria passa pela validação do núcleo antes de salvar; perfis ligam e desligam', async () => {
    const checkRule = vi
      .fn()
      .mockResolvedValueOnce({ code: 'excluded', detail: 'C:\\Windows\\Installer', reason: { pt: 'cache do MSI', en: 'MSI cache' } })
      .mockResolvedValueOnce({ code: 'ok', detail: 'C:\\Users\\u\\Teams\\Cache', reason: null })
    const { wrapper, gateway, router, saved } = await mountApp('/configuracoes', fakeGateway({ checkRule }))
    expect(wrapper.find('[data-test="no-user-rules"]').exists()).toBe(true)
    await wrapper.get('[data-test="rule-path"]').setValue('C:\\Windows')
    await wrapper.get('[data-test="user-rule-form"]').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[data-test="rule-error"]').text()).toContain('C:\\Windows\\Installer')
    expect(wrapper.get('[data-test="rule-error"]').text()).toContain('cache do MSI')
    expect(wrapper.findAll('[data-test="user-rule"]')).toHaveLength(0)
    await wrapper.get('[data-test="rule-label"]').setValue('Teams')
    await wrapper.get('[data-test="rule-path"]').setValue('C:\\Users\\u\\Teams\\Cache')
    await wrapper.get('[data-test="user-rule-form"]').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[data-test="rule-error"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="user-rule"]').text()).toContain('Teams')
    expect(saved.at(-1)!.userRules).toEqual([{ label: 'Teams', path: 'C:\\Users\\u\\Teams\\Cache', tier: 'A' }])
    await wrapper.get('[data-test="profile-node"] input').setValue(false)
    expect(saved.at(-1)!.disabledProfiles).toEqual(['node'])
    expect((wrapper.get('[data-test="find-orphans"] input').element as HTMLInputElement).checked).toBe(false)
    await wrapper.get('[data-test="find-orphans"] input').setValue(true)
    expect(saved.at(-1)!.findOrphans).toBe(true)
    await router.push('/classificacao')
    await flushPromises()
    expect(gateway.classify).toHaveBeenCalledWith(
      expect.objectContaining({ disabledProfiles: ['node'], findOrphans: true, userRules: [expect.objectContaining({ label: 'Teams' })] }),
    )
    await router.push('/configuracoes')
    await flushPromises()
    await wrapper.get('[data-test="user-rule"] button').trigger('click')
    expect(wrapper.find('[data-test="no-user-rules"]').exists()).toBe(true)
  })

  it('adiciona e remove pastas de projetos, que vão para a classificação', async () => {
    const { wrapper, gateway, router } = await mountApp('/configuracoes')
    expect(wrapper.find('[data-test="no-project-roots"]').exists()).toBe(true)
    await wrapper.get('[data-test="new-project-root"]').setValue('D:\\dev')
    await wrapper.get('[data-test="project-roots-form"]').trigger('submit')
    expect(wrapper.findAll('[data-test="project-root"]')).toHaveLength(1)
    expect((wrapper.get('[data-test="new-project-root"]').element as HTMLInputElement).value).toBe('')
    await router.push('/classificacao')
    await flushPromises()
    expect(gateway.classify).toHaveBeenCalledWith(expect.objectContaining({ projectRoots: ['D:\\dev'] }))
    await router.push('/configuracoes')
    await flushPromises()
    await wrapper.get('[data-test="project-root"] button').trigger('click')
    expect(wrapper.find('[data-test="no-project-roots"]').exists()).toBe(true)
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
    expect(gateway.classify).toHaveBeenCalledWith(expect.objectContaining({ extraExclusions: ['C:\\Projetos'] }))
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
    expect(wrapper.get('h1').text()).toBe('Varredura do volume')
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
    pinia.use(backgroundPlugin(fakeBackground()))
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
    expect(ctx.wrapper.get('[data-test="sb-state"]').text()).toBe('Executando tier A · 0/2')
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

describe('Notas de versão', () => {
  // Atualizou da beta.5 direto para a beta.7: as notas das duas versões entram.
  const updated = () => ({ updater: fakeUpdater({ appVersion: vi.fn(async () => '0.1.0-beta.7') }), saved: { seenVersion: '0.1.0-beta.5' } })

  it('aviso não bloqueante com contagens; dispensar grava a versão e mantém o selo na barra de status', async () => {
    const { wrapper, saved } = await mountApp('/', fakeGateway(), updated())
    const notice = wrapper.get('[data-test="rn-notice"]')
    expect(notice.text()).toContain('Atualizado para v0.1.0-beta.7')
    expect(notice.text()).toContain('Lixeira, mapa do volume e duplicados · inclui v0.1.0-beta.6')
    expect(notice.get('[data-test="rn-count-new"]').text()).toBe('13 Novidades')
    expect(notice.get('[data-test="rn-count-fixed"]').text()).toBe('2 Correções')
    expect(notice.get('[data-test="rn-count-known"]').text()).toBe('3 Problemas conhecidos')
    expect(wrapper.get('[data-test="rn-chip"]').text()).toBe('Novidades da v0.1.0-beta.7')
    // Nada é gravado enquanto a pessoa não interage.
    expect(saved.some((s) => s.seenVersion === '0.1.0-beta.7')).toBe(false)
    await wrapper.get('[data-test="rn-dismiss"]').trigger('click')
    expect(wrapper.find('[data-test="rn-notice"]').exists()).toBe(false)
    expect(saved.at(-1)).toMatchObject({ seenVersion: '0.1.0-beta.7' })
    await wrapper.get('[data-test="rn-chip"]').trigger('click')
    expect(wrapper.find('[data-test="rn-drawer"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="rn-chip"]').exists()).toBe(false)
  })

  it('gaveta: abas por versão, filtros, item recolhido com antes/agora, Esc fecha', async () => {
    const { wrapper, saved } = await mountApp('/', fakeGateway(), updated())
    await wrapper.get('[data-test="rn-open"]').trigger('click')
    const drawer = wrapper.get('[data-test="rn-drawer"]')
    expect(saved.at(-1)).toMatchObject({ seenVersion: '0.1.0-beta.7' })
    expect(drawer.text()).toContain('Atualizado para v0.1.0-beta.7')
    expect(drawer.text()).toContain('27 de nov. de 2026')
    expect(drawer.get('[data-test="rn-tab-0.1.0-beta.7"]').attributes('aria-selected')).toBe('true')
    expect(drawer.get('[data-test="rn-tab-0.1.0-beta.7"]').text()).toContain('instalada')
    // Só o primeiro item abre: um GIF/detalhe por vez.
    expect(drawer.findAll('[data-test="rn-item"]')).toHaveLength(13)
    expect(drawer.findAll('[data-test="rn-detail"]')).toHaveLength(1)
    expect(drawer.get('[data-test="rn-detail"]').text()).toContain('Definitivo ou Lixeira')
    // Versão antiga: só texto (o pacote leva GIF apenas da mais recente).
    expect(drawer.find('[data-test="rn-media"]').exists()).toBe(false)
    await drawer.get('[data-test="rn-filter-fixed"]').trigger('click')
    expect(drawer.findAll('[data-test="rn-item"]')).toHaveLength(2)
    const fix = drawer.get('[data-test="rn-fix"]')
    expect(fix.text()).toContain('Antes')
    expect(fix.text()).toContain('Agora · v0.1.0-beta.7')
    expect(fix.text()).toContain(String.raw`C:\Windows\Installer`)
    // Abrir o segundo e recolher o primeiro.
    const items = drawer.findAll('[data-test="rn-item"] > button')
    await items[1]!.trigger('click')
    await items[0]!.trigger('click')
    expect(items[0]!.attributes('aria-expanded')).toBe('false')
    expect(items[1]!.attributes('aria-expanded')).toBe('true')
    await drawer.get('[data-test="rn-expand"]').trigger('click')
    expect(drawer.findAll('[data-test="rn-detail"]')).toHaveLength(2)
    expect(drawer.find('[data-test="rn-expand"]').exists()).toBe(false)
    // Versão pulada na própria aba, sem filtro de correções (não teve).
    await drawer.get('[data-test="rn-tab-0.1.0-beta.6"]').trigger('click')
    expect(drawer.text()).toContain('Barra de status e fluxo passo a passo')
    // O rótulo cita a versão instalada, não a aba aberta.
    expect(drawer.text()).toContain('Atualizado para v0.1.0-beta.7')
    expect(drawer.text()).not.toContain('Atualizado para v0.1.0-beta.6')
    expect(drawer.find('[data-test="rn-filter-fixed"]').exists()).toBe(false)
    expect(drawer.findAll('[data-test="rn-item"]')).toHaveLength(5)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    expect(wrapper.find('[data-test="rn-drawer"]').exists()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('[data-test="rn-drawer"]').exists()).toBe(false)
    // Esc com a gaveta fechada não faz nada.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  })

  it('versão mais recente: GIF no item aberto, com texto alternativo; sem correções, sem atalho para elas', async () => {
    const { wrapper } = await mountApp('/', fakeGateway(), {
      updater: fakeUpdater({ appVersion: vi.fn(async () => '0.1.0-beta.8') }),
      saved: { seenVersion: '0.1.0-beta.7' },
    })
    expect(wrapper.find('[data-test="rn-open-fixes"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="rn-count-fixed"]').exists()).toBe(false)
    await wrapper.get('[data-test="rn-open"]').trigger('click')
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    const media = wrapper.get('[data-test="rn-media"]')
    expect(media.attributes('src')).toContain('rn-release-notes')
    expect(media.attributes('loading')).toBe('lazy')
    expect(media.attributes('alt')).toContain('barra de status')
  })

  it('“Correções” no aviso abre filtrado; “Abrir” leva à tela e fecha a gaveta', async () => {
    const { wrapper, router } = await mountApp('/', fakeGateway(), updated())
    await wrapper.get('[data-test="rn-open-fixes"]').trigger('click')
    expect(wrapper.get('[data-test="rn-filter-fixed"]').attributes('aria-pressed')).toBe('true')
    await wrapper.get('[data-test="rn-filter-new"]').trigger('click')
    await wrapper.get('[data-test="rn-expand"]').trigger('click')
    await wrapper.get('[data-test="rn-go-b7-rules"]').trigger('click')
    // Configurações é carregada sob demanda: espera o import dinâmico.
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('settings'))
    expect(wrapper.find('[data-test="rn-drawer"]').exists()).toBe(false)
  })

  it('Configurações: liga/desliga e histórico de versões abre só a escolhida', async () => {
    const { wrapper, saved } = await mountApp('/configuracoes', fakeGateway(), {
      updater: fakeUpdater({ appVersion: vi.fn(async () => '0.1.0-beta.7') }),
      saved: { seenVersion: '0.1.0-beta.7' },
    })
    expect(wrapper.find('[data-test="rn-notice"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="rn-chip"]').exists()).toBe(false)
    const versions = wrapper.get('[data-test="rn-versions"]')
    expect(versions.text()).toContain('v0.1.0-beta.7')
    expect(versions.text()).toContain('instalada')
    expect(versions.text()).toContain('26 de nov. de 2026 · Barra de status e fluxo passo a passo')
    await wrapper.get('[data-test="release-notes"]').setValue(false)
    expect(saved.at(-1)).toMatchObject({ releaseNotes: false })
    await wrapper.get('[data-test="rn-see-0.1.0-beta.6"]').trigger('click')
    const drawer = wrapper.get('[data-test="rn-drawer"]')
    expect(drawer.text()).toContain('Histórico de versões')
    expect(drawer.find('[role="tablist"]').exists()).toBe(false)
    await drawer.get('.drawer-scrim').trigger('click')
    expect(wrapper.find('[data-test="rn-drawer"]').exists()).toBe(false)
    await wrapper.get('[data-test="rn-see-0.1.0-beta.7"]').trigger('click')
    await wrapper.get('[data-test="rn-close"]').trigger('click')
    expect(wrapper.find('[data-test="rn-drawer"]').exists()).toBe(false)
  })
})
