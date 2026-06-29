/**
 * Geometria płyty — budowa slaba ze ściętymi bokami (cutAngle per krawędź).
 *
 * Czyste funkcje matematyczne (BEZ zależności od three) — łatwe do testu i
 * niezależne od renderera. THREE wchodzi dopiero w PanelMesh.
 *
 * Konwencja (zgodna z nagłówkiem types.ts):
 *   • Lico 'front' = płaszczyzna Z=0, trzyma NIEZMIENIONY `contour`.
 *   • Materiał idzie ku −Z, lico 'back' = Z=−thickness.
 *   • cutAngle (θ) = kąt między płaszczyzną boku a licem bazowym (Z=0):
 *       90°  → bok prostopadły (brak ścięcia),
 *       <90° → lico 'back' cofa się DO WEWNĄTRZ (front szerszy),
 *       >90° → lico 'back' wychodzi NA ZEWNĄTRZ (front węższy).
 *   • Poziome cofnięcie krawędzi: Δ = thickness / tan(θ).
 *   Obrys bazowy (front) NIGDY się nie zmienia — ścięcie żyje w grubości.
 */
import type { Edge, Vec2, Vec3 } from './types'

const EPS = 1e-9

/** Ramka krawędzi n: punkty a→b, jednostkowy kierunek wzdłuż i normalna DO WEWNĄTRZ. */
export function edgeFrame(contour: Vec2[], edge: number) {
  const n = contour.length
  const a = contour[((edge % n) + n) % n]
  const b = contour[(((edge + 1) % n) + n) % n]
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const along: Vec2 = [dx / len, dy / len]
  const inward: Vec2 = [-along[1], along[0]] // CCW → ku środkowi konturu
  return { a, b, along, inward, length: len }
}

/**
 * Punkt kotwiczenia operacji w CZOLE krawędzi (konwencja Fazy 3 — p. nagłówek
 * types.ts): x = wzdłuż krawędzi od contour[edge], y = przez grubość od lica
 * 'front' (z = −y). Kotwica leży na LINII krawędzi lica 'front' (NIE na ściętej
 * powierzchni) — dlatego cutAngle NIE wchodzi do wzoru.
 *
 * WSPÓLNA dla ręcznych otworów (OperationMarks) i dla łączników (connectors.ts)
 * — nie dublować implementacji, żeby konwencja przy cutAngle≠90 była identyczna.
 */
export function edgeAnchorLocal(contour: Vec2[], edge: number, x: number, y: number): Vec3 {
  const { a, along } = edgeFrame(contour, edge)
  return [a[0] + along[0] * x, a[1] + along[1] * x, -y]
}

/** Poziome cofnięcie krawędzi na licu 'back' (Z=−t) względem 'front' (Z=0). */
export function edgeRecession(thickness: number, cutAngle: number): number {
  const t = Math.tan((cutAngle * Math.PI) / 180)
  if (Math.abs(t) < EPS) return 0 // ~0°/~180° — zabezpieczenie, traktuj jak brak
  return thickness / t
}

/** Normalna krawędzi (a→b) skierowana DO WEWNĄTRZ konturu CCW: (−dy, dx). */
function inwardNormal(a: Vec2, b: Vec2): Vec2 {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  return [-dy / len, dx / len]
}

/** Przecięcie dwóch prostych (punkt + kierunek). Fallback gdy ~równoległe. */
function intersect(p: Vec2, dp: Vec2, q: Vec2, dq: Vec2, fallback: Vec2): Vec2 {
  const denom = dp[0] * dq[1] - dp[1] * dq[0]
  if (Math.abs(denom) < EPS) return fallback
  const s = ((q[0] - p[0]) * dq[1] - (q[1] - p[1]) * dq[0]) / denom
  return [p[0] + s * dp[0], p[1] + s * dp[1]]
}

/**
 * Kontur lica 'back' (Z=−t). Każda krawędź cofnięta wzdłuż swojej normalnej o
 * edgeRecession(edge); wierzchołek Wᵢ = przecięcie przesuniętych prostych
 * krawędzi (i−1) i (i). Front (`contour`) pozostaje nietknięty.
 */
export function backContour(contour: Vec2[], edges: Edge[], thickness: number): Vec2[] {
  const n = contour.length
  // Przesunięta prosta per krawędź: punkt bazowy + kierunek krawędzi.
  const lines = contour.map((v, i) => {
    const next = contour[(i + 1) % n]
    const nrm = inwardNormal(v, next)
    const d = edgeRecession(thickness, edges[i]?.cutAngle ?? 90)
    const point: Vec2 = [v[0] + d * nrm[0], v[1] + d * nrm[1]]
    const dir: Vec2 = [next[0] - v[0], next[1] - v[1]]
    return { point, dir }
  })
  // Wᵢ = przecięcie prostych krawędzi (i−1) i (i) — obie spotykały się w Vᵢ.
  return contour.map((_, i) => {
    const prev = lines[(i - 1 + n) % n]
    const cur = lines[i]
    return intersect(prev.point, prev.dir, cur.point, cur.dir, [cur.point[0], cur.point[1]])
  })
}

/**
 * Pozycje (non-indexed) trójkątów slaba: lico front (Z=0) + back (Z=−t) + boki.
 * Non-indexed → po computeVertexNormals() dostajemy płaskie cieniowanie per
 * ściana (ostre krawędzie). Czapki: wachlarz (kontur prostokąt/trapez = wypukły).
 */
export function slabPositions(contour: Vec2[], edges: Edge[], thickness: number): Float32Array {
  const n = contour.length
  const back = backContour(contour, edges, thickness)
  const F = contour.map<[number, number, number]>((p) => [p[0], p[1], 0])
  const B = back.map<[number, number, number]>((p) => [p[0], p[1], -thickness])
  const out: number[] = []
  const tri = (a: number[], b: number[], c: number[]) => out.push(...a, ...b, ...c)

  // Lico 'front' (czapka, wachlarz od F0) — normalna ku +Z.
  for (let i = 1; i < n - 1; i++) tri(F[0], F[i], F[i + 1])
  // Lico 'back' (odwrotne nawinięcie) — normalna ku −Z.
  for (let i = 1; i < n - 1; i++) tri(B[0], B[i + 1], B[i])
  // Boki: quad [Fᵢ, Fⱼ, Bⱼ, Bᵢ] na 2 trójkąty (j = i+1).
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    tri(F[i], F[j], B[j])
    tri(F[i], B[j], B[i])
  }
  return new Float32Array(out)
}
