// Destino do que um tier remove: Lixeira (recuperável até ser esvaziada) ou
// remoção definitiva. Espelha `Disposal::default_for` do núcleo; quem decide
// de fato é a aprovação no núcleo, isto só alimenta a tela antes de aprovar.
import type { ActionKind, Disposal, Tier } from './models'

export function defaultDisposal(tier: Tier): Disposal {
  return tier === 'A' ? 'permanent' : 'trash'
}

export function defaultDisposals(tiers: readonly Tier[]): Partial<Record<Tier, Disposal>> {
  return Object.fromEntries(tiers.map((t) => [t, defaultDisposal(t)]))
}

/** Estimativa: o que libera agora × o que vai para a Lixeira. Comando nunca vai. */
export function splitByDisposal(
  items: readonly { tier: Tier; kind: ActionKind; sizeBytes: number }[],
  disposals: Partial<Record<Tier, Disposal>>,
): { now: number; trash: number } {
  return items.reduce(
    (acc, i) => {
      const toTrash = i.kind === 'path' && (disposals[i.tier] ?? defaultDisposal(i.tier)) === 'trash'
      return toTrash ? { ...acc, trash: acc.trash + i.sizeBytes } : { ...acc, now: acc.now + i.sizeBytes }
    },
    { now: 0, trash: 0 },
  )
}
