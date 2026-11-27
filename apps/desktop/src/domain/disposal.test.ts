import { describe, expect, it } from 'vitest'
import { defaultDisposal, defaultDisposals, splitByDisposal } from './disposal'

describe('destino por tier', () => {
  it('cache sai de vez; os demais tiers vão para a Lixeira', () => {
    expect(defaultDisposal('A')).toBe('permanent')
    expect((['B', 'C', 'D'] as const).map((t) => defaultDisposal(t))).toEqual(['trash', 'trash', 'trash'])
    expect(defaultDisposals(['A', 'C'])).toEqual({ A: 'permanent', C: 'trash' })
  })

  it('separa o que libera agora do que vai para a Lixeira; comando nunca vai', () => {
    const items = [
      { tier: 'A' as const, kind: 'command' as const, sizeBytes: 10 },
      { tier: 'A' as const, kind: 'path' as const, sizeBytes: 20 },
      { tier: 'C' as const, kind: 'path' as const, sizeBytes: 40 },
      { tier: 'C' as const, kind: 'command' as const, sizeBytes: 5 },
    ]
    expect(splitByDisposal(items, { A: 'permanent', C: 'trash' })).toEqual({ now: 35, trash: 40 })
    expect(splitByDisposal(items, { A: 'trash', C: 'trash' })).toEqual({ now: 15, trash: 60 })
    // tier sem escolha usa o padrão
    expect(splitByDisposal(items, {})).toEqual({ now: 35, trash: 40 })
  })
})
