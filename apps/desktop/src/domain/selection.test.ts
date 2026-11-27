import { describe, expect, it } from 'vitest'
import type { CandidateDto, Tier } from './models'
import {
  countByTier,
  defaultSelection,
  isSelectable,
  selectionTotal,
  TIERS,
  toggle,
  toggleTier,
  totalsByTier,
} from './selection'

function candidate(id: string, tier: Tier, sizeBytes: number, blockedBy: string | null = null): CandidateDto {
  const blocked = blockedBy ? { code: 'env_var' as const, value: blockedBy } : null
  return { id, label: { pt: id, en: id }, tier, kind: 'path', target: id, sizeBytes, risk: 'none', note: { pt: '', en: '' }, blocked, project: null, idleDays: null }
}

const candidates = [
  candidate('npm', 'A', 100),
  candidate('pip', 'A', 50),
  candidate('cuda', 'C', 70, 'CUDA_PATH'),
  candidate('gradle', 'C', 30),
]

describe('selection', () => {
  it('expõe os tiers na ordem de execução', () => {
    expect(TIERS).toEqual(['A', 'B', 'C', 'D'])
  })

  it('seleciona por padrão só o que não está bloqueado', () => {
    expect(isSelectable(candidates[2]!)).toBe(false)
    expect(defaultSelection(candidates)).toEqual(['npm', 'pip', 'gradle'])
  })

  it('alterna um item sem mutar a seleção original', () => {
    const sel = ['npm']
    expect(toggle(sel, 'pip')).toEqual(['npm', 'pip'])
    expect(toggle(sel, 'npm')).toEqual([])
    expect(sel).toEqual(['npm'])
  })

  it('alterna o tier inteiro ignorando bloqueados', () => {
    expect(toggleTier([], candidates, 'C')).toEqual(['gradle'])
    expect(toggleTier(['gradle', 'npm'], candidates, 'C')).toEqual(['npm'])
    expect(toggleTier(['npm'], candidates, 'A')).toEqual(['npm', 'pip'])
  })

  it('soma por tier e no total, ignorando bloqueados mesmo se marcados', () => {
    const totals = totalsByTier(candidates, ['npm', 'cuda', 'gradle'])
    expect(totals).toEqual([
      { tier: 'A', count: 1, bytes: 100 },
      { tier: 'B', count: 0, bytes: 0 },
      { tier: 'C', count: 1, bytes: 30 },
      { tier: 'D', count: 0, bytes: 0 },
    ])
    expect(selectionTotal(candidates, ['npm', 'cuda', 'gradle'])).toEqual({ count: 2, bytes: 130 })
    expect(countByTier(candidates)).toEqual({ A: 2, B: 0, C: 2, D: 0 })
  })
})
