import { createPinia, setActivePinia } from 'pinia'
import { createApp } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { exporterPlugin, type ReportExporter } from './exporter'
import { useExportStore } from './stores/export'

function setup(overrides: Partial<ReportExporter> = {}) {
  const exporter: ReportExporter = {
    print: vi.fn(async () => {}),
    renderPng: vi.fn(async () => new Uint8Array([137])),
    savePng: vi.fn(async () => 'C:\r.png'),
    ...overrides,
  }
  const pinia = createPinia()
  pinia.use(exporterPlugin(exporter))
  createApp({}).use(pinia)
  setActivePinia(pinia)
  return { exporter, store: useExportStore() }
}

const request = { svg: '<svg/>', width: 10, height: 20, fileName: 'r.png' }

describe('export store', () => {
  it('imprime e volta ao repouso; falha vira erro', async () => {
    const { exporter, store } = setup()
    await store.print()
    expect(exporter.print).toHaveBeenCalled()
    expect(store.status).toBe('idle')

    const failing = setup({ print: vi.fn(async () => Promise.reject({ code: 'export_print', params: { detail: 'x' } })) })
    await failing.store.print()
    expect(failing.store.status).toBe('error')
    expect(failing.store.error).toEqual({ code: 'export_print', params: { detail: 'x' } })
  })

  it('rasteriza, grava e guarda o caminho; cancelar não é erro', async () => {
    const { exporter, store } = setup()
    await store.savePng(request)
    expect(exporter.renderPng).toHaveBeenCalledWith('<svg/>', 10, 20)
    expect(exporter.savePng).toHaveBeenCalledWith(new Uint8Array([137]), 'r.png')
    expect(store.status).toBe('saved')
    expect(store.savedPath).toBe('C:\r.png')

    const cancelled = setup({ savePng: vi.fn(async () => null) })
    await cancelled.store.savePng(request)
    expect(cancelled.store.status).toBe('cancelled')
    expect(cancelled.store.error).toBeNull()
  })

  it('erro de render não chama a gravação; ação repetida durante a anterior é ignorada', async () => {
    const broken = setup({ renderPng: vi.fn(async () => Promise.reject(new Error('sem canvas'))) })
    await broken.store.savePng(request)
    expect(broken.exporter.savePng).not.toHaveBeenCalled()
    expect(broken.store.error).toEqual({ message: 'sem canvas' })

    let release: () => void = () => {}
    const slow = setup({ print: vi.fn(() => new Promise<void>((r) => (release = r))) })
    const first = slow.store.print()
    expect(slow.store.busy).toBe(true)
    await slow.store.print()
    await slow.store.savePng(request)
    release()
    await first
    expect(slow.exporter.print).toHaveBeenCalledTimes(1)
    expect(slow.exporter.renderPng).not.toHaveBeenCalled()
  })
})
