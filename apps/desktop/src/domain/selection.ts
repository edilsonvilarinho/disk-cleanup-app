// Regras de seleção de candidatos (puras, sem estado).
import type { CandidateDto, Tier } from './models'

export const TIERS: readonly Tier[] = ['A', 'B', 'C', 'D']

export interface TierTotal {
  tier: Tier
  count: number
  bytes: number
}

export function isSelectable(candidate: CandidateDto): boolean {
  return candidate.blocked === null
}

/** Artefato de projeto só conta como parado com idade conhecida ≥ `minIdleDays`. */
export function isIdleEnough(c: CandidateDto, minIdleDays: number): boolean {
  return c.idleDays !== null && c.idleDays >= minIdleDays
}

/** Tudo o que é selecionável, exceto projeto com atividade recente ou idade desconhecida. */
export function defaultSelection(candidates: readonly CandidateDto[], minIdleDays = 0): string[] {
  return candidates.filter((c) => isSelectable(c) && (c.project === null || isIdleEnough(c, minIdleDays))).map((c) => c.id)
}

export function toggle(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
}

/** Marca o tier inteiro; se já estiver todo marcado, desmarca. Bloqueados nunca entram. */
export function toggleTier(selected: readonly string[], candidates: readonly CandidateDto[], tier: Tier): string[] {
  const ids = candidates.filter((c) => c.tier === tier && isSelectable(c)).map((c) => c.id)
  const allOn = ids.every((id) => selected.includes(id))
  if (allOn) return selected.filter((s) => !ids.includes(s))
  return [...selected, ...ids.filter((id) => !selected.includes(id))]
}

function chosen(candidates: readonly CandidateDto[], selected: readonly string[]): CandidateDto[] {
  return candidates.filter((c) => isSelectable(c) && selected.includes(c.id))
}

export function totalsByTier(candidates: readonly CandidateDto[], selected: readonly string[]): TierTotal[] {
  const picked = chosen(candidates, selected)
  return TIERS.map((tier) => {
    const items = picked.filter((c) => c.tier === tier)
    return { tier, count: items.length, bytes: items.reduce((sum, c) => sum + c.sizeBytes, 0) }
  })
}

export function selectionTotal(
  candidates: readonly CandidateDto[],
  selected: readonly string[],
): { count: number; bytes: number } {
  const picked = chosen(candidates, selected)
  return { count: picked.length, bytes: picked.reduce((sum, c) => sum + c.sizeBytes, 0) }
}

export function countByTier(candidates: readonly CandidateDto[]): Record<Tier, number> {
  const counts: Record<Tier, number> = { A: 0, B: 0, C: 0, D: 0 }
  for (const c of candidates) counts[c.tier] += 1
  return counts
}
