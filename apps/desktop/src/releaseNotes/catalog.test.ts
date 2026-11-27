// @vitest-environment node
// Lê a pasta de mídia do disco: sem DOM.
import { existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compareVersions, isVersion, NOTE_KINDS } from '../domain/releaseNotes'
import { RELEASE_NOTES } from './catalog'

describe('catálogo de notas de versão', () => {
  it('versões válidas, únicas e da mais nova para a mais antiga', () => {
    const versions = RELEASE_NOTES.map((n) => n.version)
    expect(versions.length).toBeGreaterThan(0)
    expect(versions.every(isVersion)).toBe(true)
    expect(new Set(versions).size).toBe(versions.length)
    for (let i = 1; i < versions.length; i++) expect(compareVersions(versions[i - 1]!, versions[i]!)).toBeGreaterThan(0)
  })

  it('datas AAAA-MM-DD reais, sem voltar no tempo', () => {
    const dates = RELEASE_NOTES.map((n) => n.date)
    for (const d of dates) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10)).toBe(d)
    }
    for (let i = 1; i < dates.length; i++) expect(dates[i - 1]! >= dates[i]!).toBe(true)
  })

  it('itens com id único, texto nos dois idiomas e tipo conhecido', () => {
    const ids = RELEASE_NOTES.flatMap((n) => n.items.map((i) => i.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const n of RELEASE_NOTES) {
      expect(n.items.length).toBeGreaterThan(0)
      for (const text of [n.headline, n.summary, ...n.items.flatMap((i) => [i.area, i.title, i.body])]) {
        expect(text.pt.trim()).not.toBe('')
        expect(text.en.trim()).not.toBe('')
      }
      for (const item of n.items) {
        expect(NOTE_KINDS).toContain(item.kind)
        // Antes/agora só faz sentido em correção.
        if (item.fix) expect(item.kind).toBe('fixed')
      }
    }
  })

  it('GIF só na versão mais recente: o pacote não carrega mídia de versões antigas', () => {
    const withMedia = RELEASE_NOTES.filter((n) => n.items.some((i) => i.media))
    expect(withMedia.every((n) => n === RELEASE_NOTES[0])).toBe(true)
    for (const item of RELEASE_NOTES[0]!.items.filter((i) => i.media)) {
      expect(item.media!.alt.pt.trim()).not.toBe('')
      expect(item.media!.alt.en.trim()).not.toBe('')
    }
  })

  it('orçamento de mídia: só a pasta da versão mais recente, até 4 MB, sem arquivo sobrando', () => {
    const root = fileURLToPath(new URL('./media', import.meta.url))
    const dirs = existsSync(root) ? readdirSync(root) : []
    const used = RELEASE_NOTES[0]!.items.filter((i) => i.media).length
    // Versão nova sem GIF: a pasta da anterior também sai do pacote.
    expect(dirs).toEqual(used ? [RELEASE_NOTES[0]!.version] : [])
    if (!used) return
    const files = readdirSync(`${root}/${dirs[0]}`)
    const bytes = files.reduce((sum, f) => sum + statSync(`${root}/${dirs[0]}/${f}`).size, 0)
    expect(bytes).toBeLessThanOrEqual(4 * 1024 * 1024)
    expect(files).toHaveLength(used)
  })
})
