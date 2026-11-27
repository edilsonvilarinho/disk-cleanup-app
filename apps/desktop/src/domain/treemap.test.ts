import { describe, expect, it } from 'vitest'
import { squarify } from './treemap'

describe('squarify', () => {
  it('cobre a área inteira, proporcional ao tamanho, sem sair da caixa', () => {
    const items = [
      { key: 'a', bytes: 60 },
      { key: 'b', bytes: 30 },
      { key: 'c', bytes: 6 },
      { key: 'd', bytes: 4 },
      { key: 'zero', bytes: 0 },
    ]
    const rects = squarify(items)
    expect(rects.map((r) => r.key)).toEqual(['a', 'b', 'c', 'd'])
    const area = (k: string) => {
      const r = rects.find((x) => x.key === k)!
      return r.w * r.h
    }
    expect(area('a')).toBeCloseTo(6000, 6)
    expect(area('d')).toBeCloseTo(400, 6)
    expect(rects.reduce((s, r) => s + r.w * r.h, 0)).toBeCloseTo(10_000, 6)
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-9)
      expect(r.y).toBeGreaterThanOrEqual(-1e-9)
      expect(r.x + r.w).toBeLessThanOrEqual(100 + 1e-9)
      expect(r.y + r.h).toBeLessThanOrEqual(100 + 1e-9)
    }
  })

  it('caixa alta, lista vazia e tudo zerado', () => {
    const tall = squarify(
      [
        { key: 'a', bytes: 1 },
        { key: 'b', bytes: 1 },
      ],
      10,
      100,
    )
    expect(tall).toHaveLength(2)
    expect(tall[0]!.w).toBeCloseTo(10, 6)
    expect(squarify([])).toEqual([])
    expect(squarify([{ key: 'z', bytes: 0 }])).toEqual([])
  })
})
