/**
 * Kolizje statyczne (Faza 7.1): read-only, nic nie zapisuje do modelu/JSON.
 *
 *  panelOverlap      — parami OBB SAT między płytami
 *  panelOutsideRoom  — AABB płyty vs AABB pokoju z realnych pozycji ścian
 *  wouldLeaveRoom    — predykat dla drag/Inspector (collision stop)
 */
import type { Panel, Project, Room, Vec3 } from './types'
import { buildOBB, testOBBOverlap, OBB_EPS, panelWorldAABB, type AABB3 } from './obb'
import { rotationMatrixXYZ, localToWorld } from './transform'
import { ROOM_WALL_THICKNESS } from './defaults'

export type ViolationKind = 'panelOverlap' | 'panelOutsideRoom'

export interface Violation {
  id: string
  kind: ViolationKind
  severity: 'error' | 'warning'
  panelIds: string[]
  message: string
}

// ── Panel vs panel ────────────────────────────────────────────────────────────

function panelOverlap(panels: Panel[]): Violation[] {
  const violations: Violation[] = []
  const obbs = panels.map((p) => buildOBB(p))

  for (let i = 0; i < panels.length - 1; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      if (testOBBOverlap(obbs[i], obbs[j])) {
        const a = panels[i], b = panels[j]
        violations.push({
          id: `overlap:${a.id}:${b.id}`,
          kind: 'panelOverlap',
          severity: 'error',
          panelIds: [a.id, b.id],
          message: `„${a.name}" nakłada się na „${b.name}"`,
        })
      }
    }
  }

  return violations
}

// ── Panel vs room ─────────────────────────────────────────────────────────────

/**
 * Oblicza AABB wnętrza pokoju (ograniczone wewnętrznymi twarzami ścian).
 *
 * Ściana = box [size[0], ROOM_WALL_THICKNESS, size[1]], obrócona i przesunięta
 * wg wall.transform — dokładnie jak RoomMesh.tsx.
 *
 * Kluczowa zasada: każda ściana ogranicza AABB WYŁĄCZNIE wzdłuż swojej osi
 * normalnej (dominująca oś axisY_world).  Ściany przednia/tylna dają granice Y,
 * ściany boczne — granice X, ściany poziome (sufit/podłoga) — granice Z.
 * Branie min/max narożników całej wewnętrznej twarzy byłoby błędem: przednia
 * ściana (szeroka na pełną szerokość pokoju) zanieczyszczałaby granicę X.
 *
 * Z: z wysokości pionowych ścian (środek wewnętrznej twarzy ± hz w świecie).
 *
 * Eksportowana — używana przez drag i Inspector do blokady wyjścia poza pokój.
 */
export function roomWorldAABB(room: Room): AABB3 | null {
  if (room.walls.length === 0) return null

  // X/Y: zacieśniamy od ±Infinity (każda ściana przesuwa granicę do środka).
  // Z: rozszerzamy od ±Infinity z wysokości ścian (sufit/podłoga).
  let minX = -Infinity, minY = -Infinity
  let maxX = Infinity,  maxY = Infinity
  let minZ = Infinity,  maxZ = -Infinity

  for (const wall of room.walls) {
    const hy = ROOM_WALL_THICKNESS / 2
    const hz = wall.size[1] / 2

    // axisY w świecie = R·[0,1,0] = kolumna 1 macierzy obrotu (row-major: m[1],m[4],m[7]).
    const m = rotationMatrixXYZ(wall.transform.rotation)
    const ayX = m[1], ayY = m[4], ayZ = m[7]
    const px = wall.transform.position[0]
    const py = wall.transform.position[1]
    const pz = wall.transform.position[2]

    // Wewnętrzna twarz: skierowana ku środkowi pokoju.
    // dot(axisY, wallPos) >= 0 → axisY odbiega od środka → wewnętrzna twarz przy sy = -1.
    const innerSy = (px * ayX + py * ayY + pz * ayZ) >= 0 ? -1 : 1

    // Środek wewnętrznej twarzy (wzdłuż normalnej ściany).
    const ifX = px + innerSy * hy * ayX
    const ifY = py + innerSy * hy * ayY
    const ifZ = pz + innerSy * hy * ayZ

    // Aktualizuj AABB TYLKO wzdłuż dominującej osi normalnej tej ściany.
    const absAyX = Math.abs(ayX), absAyY = Math.abs(ayY), absAyZ = Math.abs(ayZ)
    if (absAyX >= absAyY && absAyX >= absAyZ) {
      // Ściana boczna (normalna wzdłuż X).
      if (innerSy * ayX < 0) maxX = Math.min(maxX, ifX)
      else minX = Math.max(minX, ifX)
    } else if (absAyY >= absAyX && absAyY >= absAyZ) {
      // Ściana przednia/tylna (normalna wzdłuż Y).
      if (innerSy * ayY < 0) maxY = Math.min(maxY, ifY)
      else minY = Math.max(minY, ifY)
    } else {
      // Ściana pozioma — sufit/podłoga (normalna wzdłuż Z).
      if (innerSy * ayZ < 0) maxZ = Math.min(maxZ, ifZ)
      else minZ = Math.max(minZ, ifZ)
    }

    // Zakres Z z wysokości tej ściany (centrum wewnętrznej twarzy ± hz w świecie).
    const zTop = localToWorld(wall.transform, [0, innerSy * hy, hz])[2]
    const zBot = localToWorld(wall.transform, [0, innerSy * hy, -hz])[2]
    if (zTop > maxZ) maxZ = zTop
    if (zBot < minZ) minZ = zBot
  }

  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] }
}

function outsideAABB(pb: AABB3, roomBB: AABB3): boolean {
  return (
    pb.min[0] < roomBB.min[0] - OBB_EPS ||
    pb.max[0] > roomBB.max[0] + OBB_EPS ||
    pb.min[1] < roomBB.min[1] - OBB_EPS ||
    pb.max[1] > roomBB.max[1] + OBB_EPS ||
    pb.min[2] < roomBB.min[2] - OBB_EPS ||
    pb.max[2] > roomBB.max[2] + OBB_EPS
  )
}

function panelOutsideRoom(project: Project): Violation[] {
  if (project.rooms.length === 0) return []

  const violations: Violation[] = []

  for (const room of project.rooms) {
    const roomBB = roomWorldAABB(room)
    if (!roomBB) continue

    for (const panel of project.panels) {
      if (outsideAABB(panelWorldAABB(panel), roomBB)) {
        violations.push({
          id: `outside:${room.id}:${panel.id}`,
          kind: 'panelOutsideRoom',
          severity: 'warning',
          panelIds: [panel.id],
          message: `„${panel.name}" wystaje poza pokój „${room.name}"`,
        })
      }
    }
  }

  return violations
}

/**
 * Predykat dla drag/Inspector: czy płyta po przeniesieniu do `newTransform`
 * wybiega poza dowolny pokój w projekcie?
 * Brak pokoi → false (brak blokady).
 */
export function wouldLeaveRoom(
  panel: Panel,
  newTransform: { position: Vec3; rotation: Vec3 },
  rooms: Room[],
): boolean {
  if (rooms.length === 0) return false
  const testPanel = { ...panel, transform: newTransform }
  const pb = panelWorldAABB(testPanel)
  return rooms.some((room) => {
    const roomBB = roomWorldAABB(room)
    return roomBB ? outsideAABB(pb, roomBB) : false
  })
}

// ── Zbiorczy check ────────────────────────────────────────────────────────────

export function checkCollisions(project: Project): Violation[] {
  return [...panelOverlap(project.panels), ...panelOutsideRoom(project)]
}
