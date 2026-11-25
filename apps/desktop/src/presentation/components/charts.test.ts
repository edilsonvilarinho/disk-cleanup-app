import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GIB } from '../../domain/format'
import { SYSTEM_LANGUAGES_KEY } from '../i18n'
import DiffList from './DiffList.vue'
import UsageChart, { type UsagePoint } from './UsageChart.vue'

const global = () => ({ plugins: [createPinia()], provide: { [SYSTEM_LANGUAGES_KEY]: () => ['pt-BR'] } })
const point = (id: string, iso: string, gb: number): UsagePoint => ({ id, at: iso, usedBytes: gb * GIB })
const points = [point('a', '2026-10-02T12:00:00Z', 891), point('b', '2026-10-03T12:00:00Z', 897), point('c', '2026-11-23T12:00:00Z', 615)]

afterEach(() => vi.unstubAllGlobals())

describe('UsageChart', () => {
  it('desenha ticks redondos, capacidade, rótulo final e destaca as marcas escolhidas', () => {
    const w = mount(UsageChart, { props: { points, capacityBytes: 953 * GIB, highlight: ['c'] }, global: global() })
    const ticks = w.findAll('.axis text').map((t) => t.text())
    expect(ticks.slice(0, 4)).toEqual(['0', '250', '500', '750'])
    // 02/10 e 03/10 ficam a menos de 48px: só a primeira data aparece.
    expect(ticks).toContain('02/10')
    expect(ticks).not.toContain('03/10')
    expect(ticks).toContain('23/11')
    expect(w.findAll('circle.sel')).toHaveLength(1)
    expect(w.get('.end-label').text()).toBe('615,0')
    expect(w.get('svg').attributes('aria-label')).toContain('02/10')
  })

  it('tooltip por ponteiro (com inversão à direita), teclado e saída', async () => {
    const w = mount(UsageChart, { props: { points, capacityBytes: 953 * GIB }, global: global() })
    const svg = w.get('svg').element as SVGSVGElement
    svg.getBoundingClientRect = () => ({ left: 0, width: 800 }) as DOMRect
    const hit = w.get('[data-test="chart-hit"]')

    await hit.trigger('pointermove', { clientX: 790 })
    expect(w.get('[data-test="chart-tip"]').text()).toContain('615,0 GB')
    expect(w.get('[data-test="chart-tip"]').attributes('style')).toContain('calc(-100% - 12px)')
    await hit.trigger('pointermove', { clientX: 0 })
    expect(w.get('[data-test="chart-tip"]').text()).not.toContain('vs anterior')
    expect(w.find('.cross').exists()).toBe(true)

    await hit.trigger('keydown', { key: 'ArrowRight' })
    expect(w.get('[data-test="chart-tip"]').text()).toContain('+6,0 GB vs anterior')
    await hit.trigger('keydown', { key: 'Enter' })
    expect(w.get('[data-test="chart-tip"]').text()).toContain('+6,0 GB')
    await hit.trigger('pointerleave')
    expect(w.find('[data-test="chart-tip"]').exists()).toBe(false)

    await hit.trigger('keydown', { key: 'ArrowLeft' })
    expect(w.get('[data-test="chart-tip"]').text()).toContain('897,0 GB')
    await hit.trigger('blur')
    expect(w.find('[data-test="chart-tip"]').exists()).toBe(false)
  })

  it('clique, Enter e espaço escolhem a varredura; a selecionada ganha anel', async () => {
    const w = mount(UsageChart, { props: { points, capacityBytes: 953 * GIB, selected: 'b' }, global: global() })
    const cur = w.get('circle.cur')
    expect(cur.attributes('r')).toBe('6')
    expect(w.findAll('circle[r="4"]')).toHaveLength(2)
    ;(w.get('svg').element as SVGSVGElement).getBoundingClientRect = () => ({ left: 0, width: 800 }) as DOMRect
    const hit = w.get('[data-test="chart-hit"]')

    await hit.trigger('click')
    expect(w.emitted('pick')).toBeUndefined()
    await hit.trigger('pointermove', { clientX: 0 })
    await hit.trigger('click')
    await hit.trigger('pointerleave')
    await hit.trigger('keydown', { key: 'Enter' })
    await hit.trigger('keydown', { key: 'ArrowLeft' })
    await hit.trigger('keydown', { key: ' ' })
    expect(w.emitted('pick')).toEqual([['a'], ['c'], ['b']])
  })

  it('última data colada na penúltima: mostra a última', () => {
    const close = [point('a', '2026-10-02T12:00:00Z', 1), point('b', '2026-11-22T12:00:00Z', 2), point('c', '2026-11-23T12:00:00Z', 3)]
    const labels = mount(UsageChart, { props: { points: close, capacityBytes: 953 * GIB }, global: global() })
      .findAll('.axis text')
      .map((t) => t.text())
    expect(labels).toContain('23/11')
    expect(labels).not.toContain('22/11')
  })

  it('sem área do svg o ponteiro é ignorado', async () => {
    const w = mount(UsageChart, { props: { points, capacityBytes: 953 * GIB }, global: global() })
    ;(w.get('svg').element as SVGSVGElement).getBoundingClientRect = () => ({ left: 0, width: 0 }) as DOMRect
    await w.get('[data-test="chart-hit"]').trigger('pointermove', { clientX: 10 })
    expect(w.find('[data-test="chart-tip"]').exists()).toBe(false)
  })

  it('um ponto só, rótulo abaixo da capacidade e passo fracionário em volume pequeno', () => {
    const w = mount(UsageChart, { props: { points: [point('a', '2026-11-23T12:00:00Z', 9.4)], capacityBytes: 9.5 * GIB }, global: global() })
    expect(w.findAll('circle')).toHaveLength(1)
    expect(w.findAll('.axis text').map((t) => t.text())).toContain('2,5')
    const dot = Number(w.get('circle').attributes('cy'))
    expect(Number(w.get('.end-label').attributes('y'))).toBe(dot + 18)
  })

  it('sem pontos não quebra', () => {
    const w = mount(UsageChart, { props: { points: [], capacityBytes: 0 }, global: global() })
    expect(w.find('.end-label').exists()).toBe(false)
    expect(w.get('svg').attributes('aria-label')).toBe('')
  })

  it('acompanha a largura do contêiner e desconecta ao desmontar', () => {
    let callback: ResizeObserverCallback = () => {}
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: ResizeObserverCallback) {
          callback = cb
        }
        observe() {}
        disconnect = disconnect
      },
    )
    const w = mount(UsageChart, { props: { points, capacityBytes: 953 * GIB }, global: global() })
    callback([{ contentRect: { width: 1000 } } as ResizeObserverEntry], {} as ResizeObserver)
    return w.vm.$nextTick().then(() => {
      expect(w.get('svg').attributes('width')).toBe('1000')
      callback([] as ResizeObserverEntry[], {} as ResizeObserver)
      w.unmount()
      expect(disconnect).toHaveBeenCalled()
    })
  })
})

describe('DiffList', () => {
  it('lista vazia mostra a mensagem; variação zero não desenha barra', () => {
    expect(mount(DiffList, { props: { items: [] }, global: global() }).find('[data-test="diff-empty"]').exists()).toBe(true)
    const zero = { key: 'x', name: 'x', before: 1, after: 1, delta: 0, added: false, removed: false }
    const w = mount(DiffList, { props: { items: [zero] }, global: global() })
    expect(w.get('.diff-track span').attributes('style')).toContain('width: 0%')
  })
})
