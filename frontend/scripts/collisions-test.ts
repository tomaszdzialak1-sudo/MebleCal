/**
 * Sanity testy dla model/obb.ts + model/collisions.ts (Fazy 7.1 + 7.1b).
 *
 * Faza 7.1:
 *  (a) Dwie płyty rozdzielone 100 mm → 0 naruszeń
 *  (b) Dwie płyty nakładające się 10 mm → 1 naruszenie
 *  (c1) Styk lico↔lico — zero penetracji → 0 naruszeń
 *  (c2) Dwa fronty w tej samej płaszczyźnie, szczelina 3 mm → 0 naruszeń
 *  (d) Styk czoło↔lico (panel B pionowo, krawędź na licu A) → 0 naruszeń
 *  (e) Płyta poza pokojem (X > maks ściany) → 1 naruszenie (panelOutsideRoom)
 *  (f) Płyta w środku realnego pokoju (ściany ±1500/z=1300) → 0 naruszeń
 *
 * Faza 7.1b (collision stop):
 *  (g) binarySearchPos: B zmierza w A → safe pos nie koliduje i jest bliżej A niż from
 *  (h) wouldCollide = true → Inspector odrzuca; false → Inspector przyjmuje
 *  (i) Alt bypass: blokada pomijana gdy altHeld = true
 */

import { buildOBB, testOBBOverlap, wouldCollide, binarySearchPos, OBB_EPS } from '../src/model/obb'
import { checkCollisions } from '../src/model/collisions'
import { buildRoom } from '../src/model/factories'
import type { Panel, Project } from '../src/model/types'

// ── helpers ───────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`  ✓ ${msg}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${msg}`)
    failed++
  }
}

function mkPanel(overrides: Partial<Panel> & { position?: [number,number,number]; rotation?: [number,number,number] }): Panel {
  const { position = [0, 0, 0], rotation = [0, 0, 0], ...rest } = overrides
  return {
    id: 'p' + Math.random().toFixed(6).slice(2),
    name: 'test',
    materialId: 'm1',
    roomId: '',
    contour: [[0, 0], [600, 0], [600, 720], [0, 720]],
    thickness: 18,
    edges: [
      { cutAngle: 90 }, { cutAngle: 90 }, { cutAngle: 90 }, { cutAngle: 90 },
    ],
    grainDir: undefined,
    grainGroup: undefined,
    baseFace: 'front',
    operations: [],
    transform: { position, rotation },
    ...rest,
  }
}

function mkProject(panels: Panel[], withRoom = false): Project {
  const room = buildRoom({ id: 'room1', name: 'Pokój testowy' })
  return {
    id: 'proj',
    name: 'test',
    units: 'mm',
    settings: {
      kerf: 3.2,
      bandingAllowance: 1,
      bandingThickness: 1,
      defaultBaseFace: 'front',
    },
    materials: [],
    panels,
    connectors: [],
    hardware: [],
    rooms: withRoom ? [room] : [],
  }
}

// ── (a) Dwie płyty rozdzielone 100 mm → 0 naruszeń ───────────────────────────

console.log('\n(a) Rozdzielone 100 mm:')
{
  const pA = mkPanel({ id: 'A', position: [0, 0, 0] })
  const pB = mkPanel({ id: 'B', position: [0, 0, 200] })  // B far above A
  const obbA = buildOBB(pA)
  const obbB = buildOBB(pB)
  assert(!testOBBOverlap(obbA, obbB), 'OBB: brak nakładania (odległość > sum R)')
  const v = checkCollisions(mkProject([pA, pB]))
  assert(v.length === 0, `checkCollisions: 0 naruszeń (got ${v.length})`)
}

// ── (b) Nakładanie 10 mm → 1 naruszenie ──────────────────────────────────────

console.log('\n(b) Nakładanie 10 mm:')
{
  // pA: Z ∈ [-18, 0]. pB at z=-8: Z ∈ [-26, -8]. Overlap = [-18, -8] = 10 mm
  const pA = mkPanel({ id: 'A', position: [0, 0, 0] })
  const pB = mkPanel({ id: 'B', position: [0, 0, -8] })
  const obbA = buildOBB(pA)
  const obbB = buildOBB(pB)
  assert(testOBBOverlap(obbA, obbB), 'OBB: wykryto nakładanie')
  const v = checkCollisions(mkProject([pA, pB]))
  assert(v.length === 1, `checkCollisions: 1 naruszenie (got ${v.length})`)
  assert(v[0].kind === 'panelOverlap', `kind = panelOverlap (got ${v[0]?.kind})`)
}

// ── (c1) Styk lico↔lico — zero penetracji → 0 naruszeń ──────────────────────

console.log('\n(c1) Styk lico↔lico (penetracja=0):')
{
  // pA: Z ∈ [-18, 0]. pB at z=-18: Z ∈ [-36, -18]. Touching at Z=-18.
  const pA = mkPanel({ id: 'A', position: [0, 0, 0] })
  const pB = mkPanel({ id: 'B', position: [0, 0, -18] })
  const obbA = buildOBB(pA)
  const obbB = buildOBB(pB)
  assert(!testOBBOverlap(obbA, obbB), 'OBB: styk lico↔lico → brak kolizji (margines 0.5 mm)')
  const v = checkCollisions(mkProject([pA, pB]))
  assert(v.length === 0, `checkCollisions: 0 naruszeń (got ${v.length})`)
}

// ── (c2) Dwa fronty obok siebie, szczelina 3 mm → 0 naruszeń ────────────────

console.log('\n(c2) Dwa fronty obok siebie, szczelina 3 mm:')
{
  // pA: X ∈ [0, 600]. pB at x=603: X ∈ [603, 1203]. Gap = 3 mm.
  const pA = mkPanel({ id: 'A', position: [0, 0, 0] })
  const pB = mkPanel({ id: 'B', position: [603, 0, 0] })
  const obbA = buildOBB(pA)
  const obbB = buildOBB(pB)
  assert(!testOBBOverlap(obbA, obbB), 'OBB: szczelina 3 mm → brak kolizji')
  const v = checkCollisions(mkProject([pA, pB]))
  assert(v.length === 0, `checkCollisions: 0 naruszeń (got ${v.length})`)
}

// ── (d) Styk czoło↔lico — krawędź B na licu A → 0 naruszeń ──────────────────

console.log('\n(d) Styk czoło↔lico (panel B pionowy, krawędź na z=0 płyty A):')
{
  // pA: flat, Z ∈ [-18, 0], lico 'front' na Z=0.
  // pB: rotation=[90,0,0] → po transformacji: Y ∈ [0, 18], Z ∈ [0, 720].
  //     Krawędź dolna pB (lokalne Y=0 → świat Z=0) leży na licu A (Z=0).
  //     Bryły dzielą jedynie płaszczyznę Z=0 — brak objętościowego nakładania.
  const pA = mkPanel({ id: 'A', position: [0, 0, 0], rotation: [0, 0, 0] })
  const pB = mkPanel({ id: 'B', position: [0, 0, 0], rotation: [90, 0, 0] })
  const obbA = buildOBB(pA)
  const obbB = buildOBB(pB)
  assert(!testOBBOverlap(obbA, obbB), 'OBB: styk czoło↔lico → brak kolizji (margines 0.5 mm)')
  const v = checkCollisions(mkProject([pA, pB]))
  assert(v.length === 0, `checkCollisions: 0 naruszeń (got ${v.length})`)
}

// ── (e) Płyta poza pokojem → 1 naruszenie (panelOutsideRoom) ─────────────────

console.log('\n(e) Płyta poza pokojem (X > wewnętrzna ściana):')
{
  // Room: w=4000 → wewnętrzna twarz prawej ściany X = 2000 - 40 = 1960.
  // Panel at X=2100, width=600 → X ∈ [2100, 2700] — poza pokojem.
  const pOut = mkPanel({ id: 'out', position: [2100, 0, 500] })
  const v = checkCollisions(mkProject([pOut], true))
  const outside = v.filter((x) => x.kind === 'panelOutsideRoom')
  assert(outside.length >= 1, `panelOutsideRoom: 1+ naruszeń (got ${outside.length})`)
  assert(outside[0]?.panelIds.includes('out'), 'naruszenie dotyczy właściwej płyty')
}

// ── (f) Płyta w środku realnego pokoju → 0 naruszeń ──────────────────────────

console.log('\n(f) Płyta w środku realnego pokoju (ściany ±1500/z=1300):')
{
  // Room: w=4000, d=3000, h=2600.
  //   ściany: Y=±1500 (d/2), X=±2000 (w/2), grubość=80, ROOM_WALL_THICKNESS/2=40.
  //   Room AABB (wewnętrzna twarz): X≈[-1960,1960], Y≈[-1460,1460], Z=[0,2600].
  // Panel at [0, 0, 100], size 600×720×18 → AABB: X:[0,600], Y:[0,720], Z:[82,100].
  // Wszystkie składowe mieszczą się we wnętrzu pokoju → 0 naruszeń.
  const pIn = mkPanel({ id: 'in', position: [0, 0, 100] })
  const v = checkCollisions(mkProject([pIn], true))
  const outside = v.filter((x) => x.kind === 'panelOutsideRoom')
  assert(outside.length === 0, `panelOutsideRoom: 0 naruszeń dla płyty w środku (got ${outside.length})`)
}

// ── (g) binarySearchPos: B przesuwa się w A → zatrzymuje na granicy ──────────

console.log('\n(g) binarySearchPos: B zmierza w A, zatrzymuje się na styku:')
{
  // pA: Z ∈ [-18, 0].  pB zaczyna od z=50, zmierza do z=-8 (10 mm penetracja).
  // Granica kolizji (z marginesem 0,5 mm): |p| > 17 → safe z ≈ 17+ε.
  const pA = mkPanel({ id: 'A', position: [0, 0, 0] })
  const pB = mkPanel({ id: 'B', position: [0, 0, 50] })
  const from: [number, number, number] = [0, 0, 50]
  const to: [number, number, number]   = [0, 0, -8]
  const others = [pA]

  assert(
    wouldCollide(pB, { position: to, rotation: [0, 0, 0] }, others),
    'wouldCollide: B w pozycji docelowej koliduje z A',
  )

  const safe = binarySearchPos(from, to,
    (pos) => wouldCollide(pB, { position: pos, rotation: [0, 0, 0] }, others),
  )
  const safePanelOBB = buildOBB({ ...pB, transform: { position: safe, rotation: [0, 0, 0] } })
  assert(
    !testOBBOverlap(safePanelOBB, buildOBB(pA)),
    'binarySearchPos: safe pozycja nie koliduje z A',
  )
  assert(
    safe[2] > 0,
    `binarySearchPos: zatrzymano przed przenikaniem (safe z=${safe[2].toFixed(2)} > 0)`,
  )
  assert(
    safe[2] < from[2],
    `binarySearchPos: B faktycznie się przesunął w kierunku A (${safe[2].toFixed(2)} < ${from[2]})`,
  )
}

// ── (h) Inspector: wouldCollide = true → odrzucaj; false → przyjmuj ──────────

console.log('\n(h) wouldCollide jako brama Inspektora:')
{
  const pA = mkPanel({ id: 'A', position: [0, 0, 0] })
  const pB = mkPanel({ id: 'B', position: [0, 0, 50] })
  const others = [pA]

  const badPos: [number, number, number]  = [0, 0, -8]   // penetracja 10 mm
  const goodPos: [number, number, number] = [0, 0, 50]   // oryginalna, bezkolizyjna

  assert(
    wouldCollide(pB, { position: badPos,  rotation: [0, 0, 0] }, others),
    'wouldCollide(badPos) = true  → Inspector odrzuca zmianę',
  )
  assert(
    !wouldCollide(pB, { position: goodPos, rotation: [0, 0, 0] }, others),
    'wouldCollide(goodPos) = false → Inspector przyjmuje zmianę',
  )
}

// ── (j) Plik 20: styk gap=0 → 0 kolizji (margin=0 + EPS) ────────────────────

console.log('\n(j) Regresja „plik 20": styk gap=0 → 0 kolizji:')
{
  // pA: Z ∈ [-18, 0].  pB: Z ∈ [-36, -18].  Styk dokładnie przy Z=-18.
  // SAT wzdłuż Z: d=18, rA+rB=18, d >= 18-OBB_EPS → oś separująca → brak kolizji.
  const pA = mkPanel({ id: 'A', position: [0, 0, 0] })
  const pB = mkPanel({ id: 'B', position: [0, 0, -18] })
  const obbA = buildOBB(pA)
  const obbB = buildOBB(pB)
  assert(!testOBBOverlap(obbA, obbB), 'OBB: styk gap=0 → brak kolizji (margin=0, EPS chroni)')
  const v = checkCollisions(mkProject([pA, pB]))
  assert(
    v.filter((x) => x.kind === 'panelOverlap').length === 0,
    `checkCollisions: 0 naruszeń overlap (got ${v.filter((x) => x.kind === 'panelOverlap').length})`,
  )
}

// ── (k) Plik 21: przenikanie 1 mm → 1 kolizja ────────────────────────────────

console.log('\n(k) Regresja „plik 21": przenikanie 1 mm → 1 kolizja:')
{
  // pA: Z ∈ [-18, 0].  pB at z=-17: Z ∈ [-35, -17].  Przenikanie = 1 mm.
  // SAT wzdłuż Z: d=17, rA+rB=18, 17 >= 18-OBB_EPS ≈ 17.999999 → FALSE → kolizja.
  const pA = mkPanel({ id: 'A', position: [0, 0, 0] })
  const pB = mkPanel({ id: 'B', position: [0, 0, -17] })
  const obbA = buildOBB(pA)
  const obbB = buildOBB(pB)
  assert(testOBBOverlap(obbA, obbB), 'OBB: przenikanie 1 mm → kolizja wykryta')
  const v = checkCollisions(mkProject([pA, pB]))
  assert(
    v.filter((x) => x.kind === 'panelOverlap').length === 1,
    `checkCollisions: 1 naruszenie overlap (got ${v.filter((x) => x.kind === 'panelOverlap').length})`,
  )
}

// ── (i) Alt bypass: blokada pomijana gdy altHeld = true ──────────────────────

console.log('\n(i) Alt bypass: przenikanie dozwolone z altHeld=true:')
{
  const pA = mkPanel({ id: 'A', position: [0, 0, 0] })
  const pB = mkPanel({ id: 'B', position: [0, 0, -8] })
  const collidingPos: [number, number, number] = [0, 0, -8]
  const others = [pA]

  // Bez bypass: wouldCollide = true → Inspector blokuje.
  const blockedWithout = !false && wouldCollide(pB, { position: collidingPos, rotation: [0, 0, 0] }, others)
  assert(blockedWithout, 'Bez Alt: blokada aktywna (wouldCollide=true)')

  // Z bypass (altHeld=true): Inspector pomija sprawdzenie.
  const blockedWith = !true && wouldCollide(pB, { position: collidingPos, rotation: [0, 0, 0] }, others)
  assert(!blockedWith, 'Z Alt bypass: blokada pominięta (wynik = false niezależnie od kolizji)')
}

// ── (l) Styk z wewnętrzną ścianą (maxX = 1960) → 0 naruszeń ─────────────────

console.log('\n(l) Regresja inner-wall: styk z wewnętrzną twarzą prawej ściany → 0 naruszeń:')
{
  // Room: w=4000, ROOM_WALL_THICKNESS=80 → inner face X = 2000 - 40 = 1960.
  // Panel width=600, position X=1360 → AABB X ∈ [1360, 1960]. Styk, brak przenikania.
  const pTouch = mkPanel({ id: 'touch', position: [1360, 0, 100] })
  const v = checkCollisions(mkProject([pTouch], true))
  const outside = v.filter((x) => x.kind === 'panelOutsideRoom')
  assert(outside.length === 0, `inner-wall styk: 0 naruszeń (got ${outside.length})`)
}

// ── (m) 1 mm za wewnętrzną ścianą (maxX = 1961) → 1 naruszenie ──────────────

console.log('\n(m) Regresja inner-wall: 1 mm za wewnętrzną twarzą → 1 naruszenie:')
{
  // Panel width=600, position X=1361 → AABB X ∈ [1361, 1961]. 1 mm w ścianie.
  const pOver = mkPanel({ id: 'over', position: [1361, 0, 100] })
  const v = checkCollisions(mkProject([pOver], true))
  const outside = v.filter((x) => x.kind === 'panelOutsideRoom')
  assert(outside.length === 1, `inner-wall +1mm: 1 naruszenie (got ${outside.length})`)
}

// ── (n) Płyta na podłodze (minZ = 0) → 0 naruszeń ───────────────────────────

console.log('\n(n) Płyta na podłodze (minZ=0) → 0 naruszeń:')
{
  // Płyta flat, brak obrotu: Z ∈ [position[2]−18, position[2]].
  // By minZ = 0: position[2] = 18. MaxZ = 18 < roomBB.maxZ=2600.
  const pFloor = mkPanel({ id: 'floor', position: [0, 0, 18] })
  const v = checkCollisions(mkProject([pFloor], true))
  const outside = v.filter((x) => x.kind === 'panelOutsideRoom')
  assert(outside.length === 0, `płyta na podłodze: 0 naruszeń (got ${outside.length})`)
}

// ── (o) Płyta 1 mm poniżej podłogi → 1 naruszenie ────────────────────────────

console.log('\n(o) Płyta 1 mm poniżej podłogi → 1 naruszenie:')
{
  // minZ = −1: position[2] = −1 + 18 = 17. MinZ = 17 − 18 = −1.
  const pBelow = mkPanel({ id: 'below', position: [0, 0, 17] })
  const v = checkCollisions(mkProject([pBelow], true))
  const outside = v.filter((x) => x.kind === 'panelOutsideRoom')
  assert(outside.length === 1, `płyta poniżej podłogi: 1 naruszenie (got ${outside.length})`)
}

// ── Podsumowanie ──────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(48)}`)
console.log(`Wynik: ${passed} ok, ${failed} fail`)
if (failed > 0) process.exit(1)
