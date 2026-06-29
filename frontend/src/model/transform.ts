/**
 * Transform świata (Z-up): kompozycja pozycji + obrotu Euler XYZ (stopnie).
 *
 * Czysta matematyka (BEZ three), ale macierz obrotu REPLIKUJE dokładnie
 * THREE.Euler order 'XYZ', żeby punkty liczone tutaj zgadzały się co do mikrona
 * z renderowaną sceną — PanelMesh stawia płytę przez <group rotation={EulerXYZ}>.
 * Dzięki temu „lico A ↔ czoło B" wyprowadzamy z tej samej geometrii, którą widać.
 */
import type { Vec3 } from './types'

export interface Transform {
  position: Vec3
  rotation: Vec3 // Euler XYZ w stopniach
}

// Row-major 3x3 (9 liczb: wiersz po wierszu).
type Mat3 = [number, number, number, number, number, number, number, number, number]

const D2R = Math.PI / 180

/** Macierz obrotu (row-major) = dokładnie THREE.Euler order 'XYZ'. */
export function rotationMatrixXYZ(rotDeg: Vec3): Mat3 {
  const a = Math.cos(rotDeg[0] * D2R)
  const b = Math.sin(rotDeg[0] * D2R)
  const c = Math.cos(rotDeg[1] * D2R)
  const d = Math.sin(rotDeg[1] * D2R)
  const e = Math.cos(rotDeg[2] * D2R)
  const f = Math.sin(rotDeg[2] * D2R)
  const ae = a * e
  const af = a * f
  const be = b * e
  const bf = b * f
  return [
    c * e, -c * f, d,
    af + be * d, ae - bf * d, -b * c,
    bf - ae * d, be + af * d, a * c,
  ]
}

const mulVec = (m: Mat3, v: Vec3): Vec3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
]

/** Mnożenie przez transpozycję (= obrót odwrotny, bo macierz obrotu jest ortogonalna). */
const mulVecT = (m: Mat3, v: Vec3): Vec3 => [
  m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
  m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
  m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
]

/** Punkt lokalny płyty → świat. */
export function localToWorld(t: Transform, p: Vec3): Vec3 {
  const r = mulVec(rotationMatrixXYZ(t.rotation), p)
  return [r[0] + t.position[0], r[1] + t.position[1], r[2] + t.position[2]]
}

/** Punkt świata → układ lokalny płyty (odwrotność localToWorld). */
export function worldToLocal(t: Transform, p: Vec3): Vec3 {
  const d: Vec3 = [p[0] - t.position[0], p[1] - t.position[1], p[2] - t.position[2]]
  return mulVecT(rotationMatrixXYZ(t.rotation), d)
}

/** Obróć KIERUNEK (bez translacji) z układu lokalnego do świata. */
export function rotateDir(rotation: Vec3, v: Vec3): Vec3 {
  return mulVec(rotationMatrixXYZ(rotation), v)
}

/** Obróć KIERUNEK (bez translacji) ze świata do układu lokalnego (obrót odwrotny). */
export function inverseRotateDir(rotation: Vec3, v: Vec3): Vec3 {
  return mulVecT(rotationMatrixXYZ(rotation), v)
}
