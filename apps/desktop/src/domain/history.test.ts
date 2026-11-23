import { describe, expect, it } from 'vitest'
import { survey } from '../test/fixtures'
import { GIB } from './format'
import {
  appendSnapshot,
  compareEntries,
  compareSnapshots,
  sanitizeHistory,
  toSnapshot,
  type ScanSnapshot,
  type SnapshotEntry,
} from './history'

const ctx = (id: string, iso: string, profilePath: string | null = 'C:\\Users\\u') => ({
  id,
  at: new Date(iso),
  volumeRoot: 'C:\\',
  profilePath,
  depth: 2 as const,
})
const snap = (id: string, iso: string, patch: Partial<ScanSnapshot> = {}): ScanSnapshot => ({
  ...toSnapshot(survey, ctx(id, iso)),
  ...patch,
})
const e = (key: string, gb: number): SnapshotEntry => ({ key, name: key, bytes: gb * GIB })

describe('toSnapshot', () => {
  it('guarda volume, contadores e o 1º nível completo do volume e do perfil', () => {
    const s = toSnapshot(survey, ctx('a', '2026-11-23T14:48:00Z'))
    expect(s.at).toBe('2026-11-23T14:48:00.000Z')
    expect(s.usedBytes).toBe(survey.volume.usedBytes)
    expect(s.roots).toHaveLength(survey.roots.length)
    expect(s.profile.map((p) => p.name)).toEqual(survey.profile.map((p) => p.name))
    expect(s.roots[0]).toEqual({ key: survey.roots[0]!.key.join('/'), name: survey.roots[0]!.name, bytes: survey.roots[0]!.logicalBytes })
    expect(s).not.toHaveProperty('children')
  })
})

describe('appendSnapshot', () => {
  it('mantém ordem cronológica e descarta a mais antiga acima do limite', () => {
    const list = [snap('b', '2026-11-02T00:00:00Z'), snap('c', '2026-11-03T00:00:00Z')]
    const out = appendSnapshot(list, snap('a', '2026-11-01T00:00:00Z'))
    expect(out.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    expect(appendSnapshot(out, snap('d', '2026-11-04T00:00:00Z'), 3).map((s) => s.id)).toEqual(['b', 'c', 'd'])
  })
})

describe('compareEntries', () => {
  it('ordena pela maior variação absoluta, marca novas/sumidas e ignora ruído', () => {
    const from = [e('Users', 200), e('Windows', 40), e('old', 3), e('tiny', 1)]
    const to = [e('Users', 195), e('Windows', 48), e('new', 2), e('tiny', 1.01)]
    const out = compareEntries(from, to)
    expect(out.map((d) => [d.name, Math.round(d.delta / GIB)])).toEqual([['Windows', 8], ['Users', -5], ['old', -3], ['new', 2]])
    expect(out.find((d) => d.name === 'new')).toMatchObject({ added: true, removed: false, before: 0 })
    expect(out.find((d) => d.name === 'old')).toMatchObject({ added: false, removed: true, after: 0 })
  })

  it('respeita o limite', () => {
    const from = Array.from({ length: 15 }, (_, i) => e(`d${i}`, 1))
    expect(compareEntries(from, [], undefined, 10)).toHaveLength(10)
  })
})

describe('compareSnapshots', () => {
  it('resume volume, arquivos e intervalo em dias', () => {
    const a = snap('a', '2026-11-20T10:00:00Z', { usedBytes: 600 * GIB, freeBytes: 353 * GIB, files: 100 })
    const b = snap('b', '2026-11-23T10:00:00Z', { usedBytes: 615 * GIB, freeBytes: 338 * GIB, files: 130 })
    const c = compareSnapshots(a, b)
    expect(c).toMatchObject({ usedDelta: 15 * GIB, freeDelta: -15 * GIB, filesDelta: 30, days: 3 })
    expect(c.profile).toEqual([])
  })

  it('omite o perfil quando os caminhos diferem', () => {
    const a = snap('a', '2026-11-20T10:00:00Z')
    const b = snap('b', '2026-11-23T10:00:00Z', { profilePath: 'C:\\Users\\outro' })
    expect(compareSnapshots(a, b).profile).toBeNull()
  })
})

describe('sanitizeHistory', () => {
  it('aceita só registros válidos, sem ids repetidos, em ordem cronológica', () => {
    const good = snap('a', '2026-11-02T00:00:00Z')
    const older = snap('b', '2026-11-01T00:00:00Z')
    const raw = [good, older, { ...good }, { ...good, id: 'x', at: 'ontem' }, { ...good, id: 'y', roots: [{ key: 1 }] }, null, 'lixo']
    expect(sanitizeHistory(raw).map((s) => s.id)).toEqual(['b', 'a'])
    expect(sanitizeHistory({ não: 'lista' })).toEqual([])
    expect(sanitizeHistory(null)).toEqual([])
  })
})
