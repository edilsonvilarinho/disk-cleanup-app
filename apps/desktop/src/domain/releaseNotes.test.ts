import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  countKinds,
  decideNotes,
  isVersion,
  notesBetween,
  type ReleaseNotes,
} from './releaseNotes'

const text = (s: string) => ({ pt: s, en: s })
function notes(version: string, kinds: ('new' | 'fixed' | 'known')[] = ['new']): ReleaseNotes {
  return {
    version,
    date: '2026-11-27',
    headline: text(version),
    summary: text(version),
    items: kinds.map((kind, i) => ({ id: `${version}-${i}`, kind, area: text('a'), title: text('t'), body: text('b') })),
  }
}
const CATALOG = [notes('0.2.0'), notes('0.2.0-beta.2'), notes('0.2.0-beta.1'), notes('0.1.0')]

describe('compareVersions', () => {
  it('segue a precedência do SemVer, com prerelease antes da estável', () => {
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0)
    expect(compareVersions('0.1.0', '0.2.0')).toBeLessThan(0)
    expect(compareVersions('1.0.0', '0.9.9')).toBeGreaterThan(0)
    expect(compareVersions('0.1.10', '0.1.9')).toBeGreaterThan(0)
    expect(compareVersions('0.2.0-beta.1', '0.2.0')).toBeLessThan(0)
    expect(compareVersions('0.2.0', '0.2.0-beta.9')).toBeGreaterThan(0)
    // Identificador numérico compara como número; o mais longo vence no empate.
    expect(compareVersions('0.1.0-beta.10', '0.1.0-beta.9')).toBeGreaterThan(0)
    expect(compareVersions('0.1.0-beta', '0.1.0-beta.1')).toBeLessThan(0)
    expect(compareVersions('0.1.0-beta.1', '0.1.0-beta')).toBeGreaterThan(0)
    // Numérico vem antes de alfanumérico; alfanuméricos em ordem ASCII.
    expect(compareVersions('0.1.0-1', '0.1.0-alpha')).toBeLessThan(0)
    expect(compareVersions('0.1.0-alpha', '0.1.0-1')).toBeGreaterThan(0)
    expect(compareVersions('0.1.0-alpha', '0.1.0-beta')).toBeLessThan(0)
    expect(compareVersions('0.1.0-beta', '0.1.0-alpha')).toBeGreaterThan(0)
    // Identificador alfanumérico fica acima do numérico: '7-demo' > '8'.
    expect(compareVersions('0.1.0-beta.7-demo', '0.1.0-beta.8')).toBeGreaterThan(0)
    // Metadados de build não contam.
    expect(compareVersions('0.1.0+abc', '0.1.0')).toBe(0)
    expect(compareVersions('0.1.0-beta.7+demo', '0.1.0-beta.7')).toBe(0)
  })

  it('não compara o que não é versão', () => {
    expect(compareVersions('x', '0.1.0')).toBeNull()
    expect(compareVersions('0.1.0', '1.0')).toBeNull()
    expect(isVersion('0.1.0-beta.7')).toBe(true)
    expect(isVersion('v0.1.0')).toBe(false)
    expect(isVersion('01.0.0')).toBe(false)
  })
})

describe('notesBetween', () => {
  it('devolve as versões depois da vista até a instalada, a mais nova primeiro', () => {
    expect(notesBetween(CATALOG, '0.1.0', '0.2.0').map((n) => n.version)).toEqual(['0.2.0', '0.2.0-beta.2', '0.2.0-beta.1'])
    expect(notesBetween(CATALOG, '0.2.0-beta.1', '0.2.0-beta.2').map((n) => n.version)).toEqual(['0.2.0-beta.2'])
    expect(notesBetween(CATALOG, '0.2.0', '0.2.0')).toEqual([])
  })
})

describe('decideNotes', () => {
  const on = { enabled: true, existingUser: true }

  it('atualização: mostra o que entrou desde a última versão vista', () => {
    const d = decideNotes(CATALOG, '0.2.0-beta.2', { ...on, seen: '0.1.0' })
    expect(d.show.map((n) => n.version)).toEqual(['0.2.0-beta.2', '0.2.0-beta.1'])
    // Só grava "vista" quando a pessoa abre ou dispensa.
    expect(d.markSeen).toBeNull()
  })

  it('instalação nova: não mostra e grava a versão atual', () => {
    expect(decideNotes(CATALOG, '0.2.0', { enabled: true, existingUser: false, seen: null })).toEqual({ show: [], markSeen: '0.2.0' })
  })

  it('quem já usava antes do recurso (sem versão vista): só as notas da versão instalada', () => {
    const d = decideNotes(CATALOG, '0.2.0', { ...on, seen: null })
    expect(d.show.map((n) => n.version)).toEqual(['0.2.0'])
    expect(d.markSeen).toBeNull()
  })

  it('sem nada novo, desligado ou versão sem notas: não mostra e registra a versão', () => {
    expect(decideNotes(CATALOG, '0.2.0', { ...on, seen: '0.2.0' })).toEqual({ show: [], markSeen: null })
    expect(decideNotes(CATALOG, '0.2.0', { ...on, enabled: false, seen: '0.1.0' })).toEqual({ show: [], markSeen: '0.2.0' })
    expect(decideNotes(CATALOG, '0.3.0', { ...on, seen: '0.2.0' })).toEqual({ show: [], markSeen: '0.3.0' })
    expect(decideNotes(CATALOG, '0.3.0', { ...on, seen: null })).toEqual({ show: [], markSeen: '0.3.0' })
  })

  it('versão mais antiga que a vista (downgrade) ou inválida: nada a fazer', () => {
    expect(decideNotes(CATALOG, '0.1.0', { ...on, seen: '0.2.0' })).toEqual({ show: [], markSeen: null })
    expect(decideNotes(CATALOG, 'dev', { ...on, seen: '0.1.0' })).toEqual({ show: [], markSeen: null })
    // Versão vista corrompida conta como ausente.
    expect(decideNotes(CATALOG, '0.2.0', { ...on, seen: 'lixo' }).show.map((n) => n.version)).toEqual(['0.2.0'])
  })
})

describe('countKinds', () => {
  it('soma por tipo em todas as versões', () => {
    expect(countKinds([notes('0.2.0', ['new', 'new', 'fixed']), notes('0.1.0', ['known', 'new'])])).toEqual({ new: 3, fixed: 1, known: 1 })
  })
})
