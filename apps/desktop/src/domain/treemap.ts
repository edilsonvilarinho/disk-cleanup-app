// Layout "squarified" (Bruls et al.): retângulos com proporção próxima de 1,
// em porcentagem da área. Puro e testável; a tela só posiciona os botões.

export interface TreemapItem {
  key: string
  bytes: number
}

export interface TreemapRect {
  key: string
  x: number
  y: number
  w: number
  h: number
}

interface Sized {
  key: string
  area: number
}

function worst(row: readonly Sized[], side: number): number {
  const sum = row.reduce((s, r) => s + r.area, 0)
  const max = Math.max(...row.map((r) => r.area))
  const min = Math.min(...row.map((r) => r.area))
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
}

/** Ordena do maior para o menor e distribui em `width` × `height` (padrão 100 × 100 = %). */
export function squarify(items: readonly TreemapItem[], width = 100, height = 100): TreemapRect[] {
  const positive = items.filter((i) => i.bytes > 0).sort((a, b) => b.bytes - a.bytes)
  const total = positive.reduce((s, i) => s + i.bytes, 0)
  if (total === 0) return []
  const scale = (width * height) / total
  const rest: Sized[] = positive.map((i) => ({ key: i.key, area: i.bytes * scale }))
  const out: TreemapRect[] = []
  let x = 0
  let y = 0
  let w = width
  let h = height
  let row: Sized[] = []

  const lay = () => {
    const sum = row.reduce((s, r) => s + r.area, 0)
    if (w >= h) {
      const cw = sum / h
      let cy = y
      for (const r of row) {
        const ch = r.area / cw
        out.push({ key: r.key, x, y: cy, w: cw, h: ch })
        cy += ch
      }
      x += cw
      w -= cw
    } else {
      const rh = sum / w
      let cx = x
      for (const r of row) {
        const rw = r.area / rh
        out.push({ key: r.key, x: cx, y, w: rw, h: rh })
        cx += rw
      }
      y += rh
      h -= rh
    }
    row = []
  }

  while (rest.length > 0) {
    const next = rest[0]!
    const side = Math.min(w, h)
    if (row.length === 0 || worst([...row, next], side) <= worst(row, side)) {
      row.push(rest.shift()!)
    } else {
      lay()
    }
  }
  if (row.length > 0) lay()
  return out
}
