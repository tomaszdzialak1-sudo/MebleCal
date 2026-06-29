/**
 * OBB (Oriented Bounding Box) + SAT (Separating Axis Theorem) dla płyt.
 *
 * Układ współrzędnych płyty: lico 'front' na Z=0, materiał ku −Z.
 * Bryła płyty (kontur prostokąta): X∈[0,W], Y∈[0,H], Z∈[−T,0].
 * OBB środek w (W/2, H/2, −T/2) lokalnie → transformowany do świata.
 */
import type { Panel, Vec3 } from './types'
import { rotationMatrixXYZ, localToWorld } from './transform'

/** Przenikanie musi być realne — styk gap=0 NIE jest kolizją. */
export const COLLISION_MARGIN_MM = 0

/**
 * Tylko ochrona przed błędem zaokrągleń float przy idealnym styku —
 * NIE jest tolerancją przenikania.
 */
export const OBB_EPS = 1e-6

export interface OBB {
  center: Vec3
  halfExtents: Vec3            // [W/2, H/2, T/2]
  axes: [Vec3, Vec3, Vec3]     // lokalne osie w świecie — kolumny macierzy obrotu
}

export function buildOBB(panel: Panel): OBB {
  const xs = panel.contour.map((p) => p[0])
  const ys = panel.contour.map((p) => p[1])
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yMin = Math.min(...ys), yMax = Math.max(...ys)
  const W = xMax - xMin
  const H = yMax - yMin
  const T = panel.thickness

  const center = localToWorld(panel.transform, [
    (xMin + xMax) / 2,
    (yMin + yMax) / 2,
    -T / 2,
  ])

  // Kolumny macierzy obrotu = lokalne osie układu płyty w świecie.
  const m = rotationMatrixXYZ(panel.transform.rotation)
  const axes: [Vec3, Vec3, Vec3] = [
    [m[0], m[3], m[6]],  // R·[1,0,0]
    [m[1], m[4], m[7]],  // R·[0,1,0]
    [m[2], m[5], m[8]],  // R·[0,0,1]
  ]

  return { center, halfExtents: [W / 2, H / 2, T / 2], axes }
}

// ── SAT helpers ──────────────────────────────────────────────────────────────

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

/** Rzut OBB na oś L (znormalizowana): suma |dot(half·axis, L)| po 3 osiach. */
function obbRadius(halfExt: Vec3, axes: [Vec3, Vec3, Vec3], L: Vec3): number {
  return (
    halfExt[0] * Math.abs(dot(axes[0], L)) +
    halfExt[1] * Math.abs(dot(axes[1], L)) +
    halfExt[2] * Math.abs(dot(axes[2], L))
  )
}

/**
 * Sprawdza czy dwa OBB zachodzą na siebie.
 *
 * Styk (d == rA+rB) traktowany jest jako „bez kolizji" dzięki OBB_EPS —
 * ochrona przed błędem float przy idealnie przylegających płytach.
 * Realne przenikanie (nawet 0.001 mm) → kolizja.
 */
export function testOBBOverlap(a: OBB, b: OBB, margin = COLLISION_MARGIN_MM): boolean {
  // Skurcz halfExtents o margines. Przy COLLISION_MARGIN_MM=0 jest no-op;
  // pozostawiony dla ewentualnego dostrojenia bez zmiany reszty kodu.
  const ha: Vec3 = [
    Math.max(0, a.halfExtents[0] - margin),
    Math.max(0, a.halfExtents[1] - margin),
    Math.max(0, a.halfExtents[2] - margin),
  ]
  const hb: Vec3 = [
    Math.max(0, b.halfExtents[0] - margin),
    Math.max(0, b.halfExtents[1] - margin),
    Math.max(0, b.halfExtents[2] - margin),
  ]

  const D: Vec3 = [
    b.center[0] - a.center[0],
    b.center[1] - a.center[1],
    b.center[2] - a.center[2],
  ]

  // 15 osi SAT: 3 face-normalne A + 3 face-normalne B + 9 iloczynów wektorowych.
  const candidates: Vec3[] = [
    ...a.axes,
    ...b.axes,
    ...a.axes.flatMap((ai) => b.axes.map((bi) => cross(ai, bi))),
  ]

  for (const L of candidates) {
    const len2 = L[0] * L[0] + L[1] * L[1] + L[2] * L[2]
    if (len2 < 1e-10) continue  // zdegenerowany iloczyn wektorowy (osie równoległe)
    const inv = 1 / Math.sqrt(len2)
    const Ln: Vec3 = [L[0] * inv, L[1] * inv, L[2] * inv]

    const rA = obbRadius(ha, a.axes, Ln)
    const rB = obbRadius(hb, b.axes, Ln)
    const d = Math.abs(dot(D, Ln))

    // Oś separująca: styk (d == rA+rB) i rozdzielenie (d > rA+rB) → brak kolizji.
    // OBB_EPS chroni przed fałszywą kolizją przy idealnym styku z błędem float.
    if (d >= rA + rB - OBB_EPS) return false
  }

  return true  // brak osi separującej → kolizja
}

// ── World AABB ────────────────────────────────────────────────────────────────

export interface AABB3 {
  min: Vec3
  max: Vec3
}

/** Oblicza world-AABB płyty (przy aktualnym transform) ze zbioru 8 narożników bryły. */
export function panelWorldAABB(panel: Panel, overrideTransform?: { position: Vec3; rotation: Vec3 }): AABB3 {
  const transform = overrideTransform ?? panel.transform
  const xs = panel.contour.map((p) => p[0])
  const ys = panel.contour.map((p) => p[1])
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yMin = Math.min(...ys), yMax = Math.max(...ys)

  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  for (const lx of [xMin, xMax]) {
    for (const ly of [yMin, yMax]) {
      for (const lz of [0, -panel.thickness]) {
        const world = localToWorld(transform, [lx, ly, lz])
        if (world[0] < minX) minX = world[0]
        if (world[0] > maxX) maxX = world[0]
        if (world[1] < minY) minY = world[1]
        if (world[1] > maxY) maxY = world[1]
        if (world[2] < minZ) minZ = world[2]
        if (world[2] > maxZ) maxZ = world[2]
      }
    }
  }

  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] }
}

// ── Collision-stop helpers ────────────────────────────────────────────────────

/**
 * Sprawdza czy płyta po przeniesieniu do `newTransform` kolidowałaby z którąkolwiek z `others`.
 * Używane przez drag (SceneCanvas) i walidację Inspektora.
 */
export function wouldCollide(
  panel: Panel,
  newTransform: { position: Vec3; rotation: Vec3 },
  others: Panel[],
): boolean {
  const testPanel = { ...panel, transform: newTransform }
  const obbA = buildOBB(testPanel)
  return others.some((o) => testOBBOverlap(obbA, buildOBB(o)))
}

/**
 * Szuka ostatniej bezpiecznej pozycji wzdłuż wektora ruchu `from → to`.
 *
 * `from` = ostatnia znana bezpieczna pozycja,
 * `to`   = cel (może być zablokowany przez `isBlocked`).
 * `isBlocked` łączy dowolne warunki: kolizja płyt, wyjście poza pokój itp.
 * Jeśli nawet `from` jest zablokowane, zwraca `from`.
 */
export function binarySearchPos(
  from: Vec3,
  to: Vec3,
  isBlocked: (pos: Vec3) => boolean,
  iterations = 16,
): Vec3 {
  let lo = 0, hi = 1
  for (let k = 0; k < iterations; k++) {
    const t = (lo + hi) / 2
    const pos: Vec3 = [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t,
    ]
    if (isBlocked(pos)) {
      hi = t
    } else {
      lo = t
    }
  }
  return [
    from[0] + (to[0] - from[0]) * lo,
    from[1] + (to[1] - from[1]) * lo,
    from[2] + (to[2] - from[2]) * lo,
  ]
}
