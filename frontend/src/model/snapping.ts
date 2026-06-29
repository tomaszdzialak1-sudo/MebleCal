/**
 * Snapping („magnes") płyt przy przeciąganiu gizmem — stan WIDOKU, nie modelu
 * (wynik trafia tylko do pozycji przez zwykłą edycję transformu po puszczeniu).
 *
 * Podejście: world-AABB płyt. Dla mebli płytowych (boki/półki po obrotach o 90°)
 * pudełka są osiowe, więc dociąganie ścian AABB jest przewidywalne i tanie:
 * per oś świata szukamy najbliższej pary „lic/krawędzi" w progu i dociągamy na
 * styk LUB do licowania. To celowo NIE jest detekcja kolizji (Faza 7).
 */
import type { Panel, Vec3 } from './types'
import { backContour } from './geometry'
import { localToWorld, type Transform } from './transform'

export interface AABB {
  min: Vec3
  max: Vec3
}

/** Lokalne narożniki bryły płyty: lico 'front' (z=0) + 'back' (z=−grubość). */
export function panelCorners(panel: Panel): Vec3[] {
  const t = panel.thickness
  const back = backContour(panel.contour, panel.edges, t)
  const front = panel.contour.map<Vec3>(([x, y]) => [x, y, 0])
  const b = back.map<Vec3>(([x, y]) => [x, y, -t])
  return [...front, ...b]
}

/** AABB w świecie z lokalnych narożników i transformu (pozycja + obrót XYZ). */
export function worldAABB(corners: Vec3[], transform: Transform): AABB {
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const c of corners) {
    const w = localToWorld(transform, c)
    for (let i = 0; i < 3; i++) {
      if (w[i] < min[i]) min[i] = w[i]
      if (w[i] > max[i]) max[i] = w[i]
    }
  }
  return { min, max }
}

export interface SnapResult {
  offset: Vec3 // przesunięcie pozycji do nałożenia (snap)
  contacts: Vec3[][] // pętle (5 pkt) do narysowania linii styku — feedback
}

// dla osi a → pozostałe dwie osie (płaszczyzna styku)
const OTHER: [number, number][] = [
  [1, 2],
  [0, 2],
  [0, 1],
]

/** Przedział nakładania AABB na danej osi (z marginesem); null gdy rozłączne. */
function overlapSpan(a: AABB, b: AABB, axis: number, margin: number): [number, number] | null {
  const lo = Math.max(a.min[axis], b.min[axis])
  const hi = Math.min(a.max[axis], b.max[axis])
  if (hi < lo - margin) return null
  return [lo, hi]
}

/** Prostokąt styku (pętla 5 pkt) na płaszczyźnie osi a = coord. */
function contactLoop(dragged: AABB, other: AABB, a: number, coord: number): Vec3[] {
  const [u, v] = OTHER[a]
  const u0 = Math.max(dragged.min[u], other.min[u])
  const u1 = Math.min(dragged.max[u], other.max[u])
  const v0 = Math.max(dragged.min[v], other.min[v])
  const v1 = Math.min(dragged.max[v], other.max[v])
  const pt = (uu: number, vv: number): Vec3 => {
    const p: Vec3 = [0, 0, 0]
    p[a] = coord
    p[u] = uu
    p[v] = vv
    return p
  }
  return [pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1), pt(u0, v0)]
}

/**
 * Policz snap przeciąganej płyty względem pozostałych. Dla każdej osi świata
 * niezależnie bierze najbliższą parę lic w progu `threshold` (styk min↔max lub
 * licowanie min↔min / max↔max), pod warunkiem że płyty „patrzą na siebie"
 * (nakładają się w pozostałych dwóch osiach).
 */
export function computeSnap(dragged: AABB, others: AABB[], threshold: number): SnapResult {
  const offset: Vec3 = [0, 0, 0]
  const contacts: Vec3[][] = []

  for (let a = 0; a < 3; a++) {
    const [u, v] = OTHER[a]
    let best: { dist: number; delta: number; coord: number; other: AABB } | null = null

    for (const o of others) {
      if (!overlapSpan(dragged, o, u, threshold) || !overlapSpan(dragged, o, v, threshold)) continue
      // (delta = ile dosunąć, coord = współrzędna płaszczyzny styku)
      const variants: { delta: number; coord: number }[] = [
        { delta: o.max[a] - dragged.min[a], coord: o.max[a] }, // min na max (styk)
        { delta: o.min[a] - dragged.max[a], coord: o.min[a] }, // max na min (styk)
        { delta: o.min[a] - dragged.min[a], coord: o.min[a] }, // licowanie min
        { delta: o.max[a] - dragged.max[a], coord: o.max[a] }, // licowanie max
      ]
      for (const vt of variants) {
        const d = Math.abs(vt.delta)
        if (d <= threshold && (best === null || d < best.dist)) {
          best = { dist: d, delta: vt.delta, coord: vt.coord, other: o }
        }
      }
    }

    if (best) {
      offset[a] = best.delta
      contacts.push(contactLoop(dragged, best.other, a, best.coord))
    }
  }

  return { offset, contacts }
}

/** Czy krawędź łącząca panelu B jest gerunkowa (cutAngle≠90) — nieobsługiwane v1. */
export function isMiterEdge(panel: Panel, edge: number, eps = 0.01): boolean {
  const e = panel.edges[edge]
  return !!e && Math.abs(e.cutAngle - 90) > eps
}
