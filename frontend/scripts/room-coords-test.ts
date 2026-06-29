/**
 * Sanity: pozycjonowanie płyt względem pokoju.
 *
 * (A) Płyta przy przedniej ścianie (+Y): Z od przodu ≈ 0
 * (B) worldToRoomCoords → roomCoordsToWorld round-trip: pozycja niezmieniona
 * (C) Zmiana X od lewej o 100mm: world X przesuwa się o 100mm
 * (D) Pokój 4000×3000, płyta przy lewej ścianie: X od lewej ≈ 0
 * (E) Płyta przy tylnej ścianie (−Y): Z od przodu ≈ głębokość pokoju
 * (F) Płyta przy podłodze: Y od podłogi ≈ 0
 */

import { worldToRoomCoords, roomCoordsToWorld } from '../src/model/roomCoords'
import { buildRoom } from '../src/model/factories'
import type { Panel, Room, Vec3 } from '../src/model/types'

let passed = 0
let failed = 0

function assert(cond: boolean, msg: string): void {
  if (cond) { console.log(`  ✓ ${msg}`); passed++ }
  else       { console.error(`  ✗ FAIL: ${msg}`); failed++ }
}

function dist3(a: Vec3, b: Vec3): number {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2)
}

function mkPanel(transform: { position: Vec3; rotation: Vec3 }): Panel {
  return {
    id: 'p1', name: 'test', materialId: 'm1', roomId: '',
    thickness: 18,
    contour: [[0,0],[600,0],[600,720],[0,720]],
    transform,
    edges: [{ cutAngle:90 },{ cutAngle:90 },{ cutAngle:90 },{ cutAngle:90 }],
    baseFace: 'front',
    operations: [],
  }
}

// Pokój standardowy 4000×3000×2600mm wyśrodkowany w (0,0)
// Wewnętrzne AABB: X∈[−1980,1980], Y∈[−1480,1480], Z∈[0,2600]
const room: Room = buildRoom({ w: 4000, d: 3000, h: 2600 })

// ── (A) Płyta przy przedniej ścianie (Y ≈ −1480), obrót pionowy ──────────────

console.log('\n(A) Płyta przy przedniej ścianie (+Y) — Z od przodu ≈ 0:')
{
  // ROOM_WALL_THICKNESS = 80, hy = 40. Pokój d=3000: front wall center Y=+1500.
  // Inner face Y = 1500 − 40 = +1460 → roomBB.maxY = +1460.
  // Formuła: z = roomBB.max[1] − pb.max[1]; z=0 gdy pb.max[1] = 1460.
  // Płyta pionowa rot [90,0,0]: maxY = position[1] + 18. By maxY=1460: position[1]=1442.
  const panel = mkPanel({ position: [-300, 1442, 0], rotation: [90, 0, 0] })
  const rc = worldToRoomCoords(panel, room)
  assert(Math.abs(rc.z) < 1, `Z od przodu = ${rc.z.toFixed(2)} (oczekiwane ≈ 0, maks. 1 mm)`)
}

// ── (B) Round-trip: worldToRoomCoords → roomCoordsToWorld ────────────────────

console.log('\n(B) Round-trip worldToRoomCoords → roomCoordsToWorld:')
{
  const panel = mkPanel({ position: [200, -500, 100], rotation: [0, 0, 0] })
  const rc = worldToRoomCoords(panel, room)
  const newPos = roomCoordsToWorld(rc, panel, room)
  const d = dist3(newPos, panel.transform.position)
  assert(d < 1e-6, `Δ pozycja = ${d.toExponential(2)} < 1e-6`)
}

// ── (C) Zmiana X od lewej o +100mm → world X += 100 ─────────────────────────

console.log('\n(C) Zmiana X od lewej o +100mm:')
{
  const panel = mkPanel({ position: [0, 0, 0], rotation: [0, 0, 0] })
  const rc0 = worldToRoomCoords(panel, room)
  const newPos0 = roomCoordsToWorld(rc0, panel, room)

  const rc1 = { ...rc0, x: rc0.x + 100 }
  const newPos1 = roomCoordsToWorld(rc1, panel, room)

  const deltaX = newPos1[0] - newPos0[0]
  assert(Math.abs(deltaX - 100) < 1e-6, `ΔX = ${deltaX.toFixed(4)} (oczekiwane 100)`)
  assert(Math.abs(newPos1[1] - newPos0[1]) < 1e-6, `Y niezmienione`)
  assert(Math.abs(newPos1[2] - newPos0[2]) < 1e-6, `Z (world) niezmienione`)
}

// ── (D) Płyta przy lewej ścianie — X od lewej ≈ 0 ───────────────────────────

console.log('\n(D) Płyta przy lewej ścianie — X od lewej ≈ 0:')
{
  // ROOM_WALL_THICKNESS = 80, hy = 40. Pokój w=4000: left wall center X=-2000.
  // Inner face X = -2000 + 40 = -1960 → roomBB.minX = -1960.
  // Płyta 600×720, brak obrotu: min X = position[0].
  // By minX = -1960: position[0] = -1960.
  const panel = mkPanel({ position: [-1960, 0, 0], rotation: [0, 0, 0] })
  const rc = worldToRoomCoords(panel, room)
  assert(Math.abs(rc.x) < 1, `X od lewej = ${rc.x.toFixed(2)} (oczekiwane ≈ 0, maks. 1 mm)`)
}

// ── (E) Płyta przy tylnej ścianie (−Y): Z ≈ głębokość pokoju ─────────────────

console.log('\n(E) Płyta przy tylnej ścianie (−Y) — Z ≈ głębokość pokoju:')
{
  // Back wall inner face: Y = -1460 → roomBB.minY = -1460.
  // Panel pionowy przy tylnej ścianie: maxY ≈ -1460 + 18 = -1442.
  // z = 1460 − (−1442) = 2902 ≈ inner depth (2920 = 2×1460).
  const panel = mkPanel({ position: [-300, -1460, 0], rotation: [90, 0, 0] })
  const rc = worldToRoomCoords(panel, room)
  const innerDepth = 2 * 1460  // 2920 mm
  assert(
    rc.z > innerDepth - 30 && rc.z <= innerDepth,
    `Z od przodu = ${rc.z.toFixed(1)} (oczekiwane ≈ głębokość ~${innerDepth})`,
  )
}

// ── (F) Płyta przy podłodze — Y od podłogi ≈ 0 ───────────────────────────────

console.log('\n(F) Płyta przy podłodze — Y od podłogi ≈ 0:')
{
  // roomBB.minZ = 0 (podłoga). Płyta flat brak obrotu: minZ = position[2] − 18 (lz=−T).
  // By minZ = 0: position[2] = 18.
  const panel = mkPanel({ position: [0, 0, 18], rotation: [0, 0, 0] })
  const rc = worldToRoomCoords(panel, room)
  assert(Math.abs(rc.y) < 1, `Y od podłogi = ${rc.y.toFixed(2)} (oczekiwane ≈ 0, maks. 1 mm)`)
}

// ── Podsumowanie ──────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(48)}`)
console.log(`Wynik: ${passed} ok, ${failed} fail`)
if (failed > 0) process.exit(1)
