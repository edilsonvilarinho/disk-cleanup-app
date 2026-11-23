import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import type { DiskCleanupGateway } from '../application/gateway'
import { gatewayPlugin } from '../application/gatewayPlugin'
import { ThemeController } from '../application/theme'
import { approval, classification, report, survey } from '../test/fixtures'
import { usePlanStore } from '../application/stores/plan'
import { fakeGateway } from '../test/fakeGateway'
import App from './App.vue'
import { riskLabel, volumeLabel } from './labels'
import { createAppRouter } from './router'
import { THEME_KEY, useTheme } from './theme'
import { defineComponent } from 'vue'

async function mountApp(path: string, gateway: DiskCleanupGateway = fakeGateway()) {
  const pinia = createPinia()
  pinia.use(gatewayPlugin(gateway))
  const router = createAppRouter(createMemoryHistory())
  const storage = { value: null as string | null, get: () => null, set: vi.fn() }
  const theme = new ThemeController(storage, () => true, vi.fn())
  theme.init()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [pinia, router], provide: { [THEME_KEY]: theme } } })
  await flushPromises()
  return { wrapper, gateway, router, theme, pinia }
}

describe('useTheme', () => {
  it('falha explicitamente sem ThemeController fornecido', () => {
    const Probe = defineComponent({ setup: () => useTheme(), render: () => null })
    expect(() => mount(Probe)).toThrow('ThemeController')
  })
})

describe('labels', () => {
  it('traduz risco e normaliza o volume para o plan.json', () => {
    expect(riskLabel('none')).toBe('nenhum')
    expect(riskLabel('low')).toBe('baixo')
    expect(riskLabel('redownload')).toBe('re-download')
    expect(riskLabel('long-running')).toBe('operação longa')
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
    expect(router.currentRoute.value.path).toBe('/execucao')
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
