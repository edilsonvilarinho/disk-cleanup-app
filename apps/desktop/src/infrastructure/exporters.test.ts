import { describe, expect, it, vi } from 'vitest'
import { browserCanvas, BrowserExporter, FILE_NAME_HEADER, svgToPng, TauriExporter, type CanvasDeps } from './exporters'

function fakeCanvas(opts: { fail?: 'load' | 'ctx' | 'blob' } = {}) {
  const ctx = { scale: vi.fn(), drawImage: vi.fn() }
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => (opts.fail === 'ctx' ? null : ctx)),
    toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(opts.fail === 'blob' ? null : new Blob([new Uint8Array([137, 80, 78, 71])]))),
  }
  const img = {
    onload: null as null | (() => void),
    onerror: null as null | (() => void),
    set src(value: string) {
      img.loaded = value
      queueMicrotask(() => (opts.fail === 'load' ? img.onerror?.() : img.onload?.()))
    },
    loaded: '',
  }
  const deps: CanvasDeps = { createImage: () => img as never, createCanvas: () => canvas as never }
  return { deps, ctx, canvas, img }
}

describe('svgToPng', () => {
  it('desenha o SVG em escala e devolve os bytes do PNG', async () => {
    const { deps, ctx, canvas, img } = fakeCanvas()
    const bytes = await svgToPng('<svg>á</svg>', 100, 50, 2, deps)
    expect(Array.from(bytes)).toEqual([137, 80, 78, 71])
    expect(img.loaded).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg>á</svg>')}`)
    expect([canvas.width, canvas.height]).toEqual([200, 100])
    expect(ctx.scale).toHaveBeenCalledWith(2, 2)
    expect(ctx.drawImage).toHaveBeenCalledWith(img, 0, 0, 100, 50)
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
  })

  it.each([
    ['load', 'svg'],
    ['ctx', 'canvas'],
    ['blob', 'png'],
  ] as const)('falha "%s" vira erro traduzível', async (fail, detail) => {
    await expect(svgToPng('<svg/>', 1, 1, 1, fakeCanvas({ fail }).deps)).rejects.toEqual({ code: 'export_render', params: { detail } })
  })
})

describe('browserCanvas', () => {
  it('cria <img> e <canvas> do documento', () => {
    expect(browserCanvas.createImage()).toBeInstanceOf(HTMLImageElement)
    expect(browserCanvas.createCanvas()).toBeInstanceOf(HTMLCanvasElement)
  })
})

describe('TauriExporter', () => {
  it('imprime pelo comando nativo e grava com corpo cru + nome no cabeçalho', async () => {
    const invoke = vi.fn(async () => 'C:\r.png')
    const render = vi.fn(async () => new Uint8Array([1]))
    const exporter = new TauriExporter(invoke as never, render)
    await exporter.print()
    expect(invoke).toHaveBeenCalledWith('print_page')
    expect(await exporter.renderPng('<svg/>', 10, 20)).toEqual(new Uint8Array([1]))
    expect(render).toHaveBeenCalledWith('<svg/>', 10, 20)
    const bytes = new Uint8Array([137])
    expect(await exporter.savePng(bytes, 'r.png')).toBe('C:\r.png')
    expect(invoke).toHaveBeenCalledWith('save_png', bytes, { headers: { [FILE_NAME_HEADER]: 'r.png' } })
  })
})

describe('BrowserExporter', () => {
  it('usa a impressão do navegador e baixa o PNG por link temporário', async () => {
    const print = vi.fn()
    const render = vi.fn(async () => new Uint8Array([2]))
    const create = vi.fn(() => 'blob:x')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const exporter = new BrowserExporter({ print }, render)
    await exporter.print()
    expect(print).toHaveBeenCalled()
    expect(await exporter.renderPng('<svg/>', 1, 2)).toEqual(new Uint8Array([2]))
    expect(await exporter.savePng(new Uint8Array([3]), 'r.png')).toBe('r.png')
    expect(click).toHaveBeenCalled()
    expect(revoke).toHaveBeenCalledWith('blob:x')
  })
})
