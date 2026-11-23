import { invoke } from '@tauri-apps/api/core'
import type { ReportExporter } from '../application/exporter'

/** Erro com código traduzível (`errors.export_render`). */
const renderError = (detail: string) => ({ code: 'export_render', params: { detail } })

export interface CanvasDeps {
  createImage(): HTMLImageElement
  createCanvas(): HTMLCanvasElement
}

export const browserCanvas: CanvasDeps = {
  createImage: () => new Image(),
  createCanvas: () => document.createElement('canvas'),
}

/** SVG → PNG via `<img>` + canvas (escala 2 para telas de alta densidade).
 *  `data:` é permitido pela CSP (`img-src 'self' data:`). */
export async function svgToPng(svg: string, width: number, height: number, scale = 2, deps: CanvasDeps = browserCanvas): Promise<Uint8Array> {
  const img = deps.createImage()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(renderError('svg'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
  const canvas = deps.createCanvas()
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw renderError('canvas')
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw renderError('png')
  return new Uint8Array(await blob.arrayBuffer())
}

/** Cabeçalho lido por `save_png` (src-tauri/src/bootstrap.rs). */
export const FILE_NAME_HEADER = 'x-file-name'

export class TauriExporter implements ReportExporter {
  constructor(
    private readonly call: typeof invoke = invoke,
    private readonly render: typeof svgToPng = svgToPng,
  ) {}

  print(): Promise<void> {
    return this.call<void>('print_page')
  }

  renderPng(svg: string, width: number, height: number): Promise<Uint8Array> {
    return this.render(svg, width, height)
  }

  /** Corpo cru (sem JSON): os bytes vão direto ao comando. */
  savePng(bytes: Uint8Array, fileName: string): Promise<string | null> {
    return this.call<string | null>('save_png', bytes, { headers: { [FILE_NAME_HEADER]: fileName } })
  }
}

/** Fora do Tauri (`pnpm dev`): impressão do navegador e download comum. */
export class BrowserExporter implements ReportExporter {
  constructor(
    private readonly win: Pick<Window, 'print'> = window,
    private readonly render: typeof svgToPng = svgToPng,
  ) {}

  async print(): Promise<void> {
    this.win.print()
  }

  renderPng(svg: string, width: number, height: number): Promise<Uint8Array> {
    return this.render(svg, width, height)
  }

  async savePng(bytes: Uint8Array, fileName: string): Promise<string | null> {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' }))
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      return fileName
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}
