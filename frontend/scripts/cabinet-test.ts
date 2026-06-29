import { generateCabinet, generateCabinetFromObj, sanityCabinetGenerate } from '../src/model/cabinet-templates'
import { createCabinet } from '../src/model/factories'
import { contourSize } from '../src/model/factories'
import { localToWorld } from '../src/model/transform'
import { buildOBB, testOBBOverlap } from '../src/model/obb'
import type { Panel } from '../src/model/types'

/** World AABB (min/max per axis) dla płyty — 8 rogów bryły. */
function worldAABB(p: Panel): { min: [number,number,number]; max: [number,number,number] } {
  const T = p.thickness
  const xs = p.contour.map((c) => c[0])
  const ys = p.contour.map((c) => c[1])
  const xMax = Math.max(...xs), yMax = Math.max(...ys)
  const corners: [number,number,number][] = [
    [0,0,0],[xMax,0,0],[0,yMax,0],[xMax,yMax,0],
    [0,0,-T],[xMax,0,-T],[0,yMax,-T],[xMax,yMax,-T],
  ]
  const pts = corners.map((c) => localToWorld(p.transform, c))
  return {
    min: [Math.min(...pts.map(p=>p[0])), Math.min(...pts.map(p=>p[1])), Math.min(...pts.map(p=>p[2]))],
    max: [Math.max(...pts.map(p=>p[0])), Math.max(...pts.map(p=>p[1])), Math.max(...pts.map(p=>p[2]))],
  }
}

/** World Z-range dla płyty. */
function panelZRange(p: Panel): [number, number] {
  const bb = worldAABB(p)
  return [bb.min[2], bb.max[2]]
}

/** Sprawdza czy drzwi są w całości PRZED szafką (Y ≤ -DOOR_GAP). */
function doorYMax(p: Panel): number {
  return worldAABB(p).max[1]
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

// ─── sanity (delegates to the built-in sanity fn) ────────────────────────────

const r = sanityCabinetGenerate()
assert(r.ok, `sanityCabinetGenerate failed: ${r.detail}`)
console.log(`[ok] sanityCabinetGenerate: ${r.detail}`)

// ─── boki: weryfikacja że Z ∈ [0, H] (regresja błędu [0,-90,90]) ─────────────

const stand = generateCabinet({
  type: 'standing', W: 600, H: 720, D: 560, T: 18, backT: 4,
  materialId: 'm1', roomId: 'r1', doors: 1, shelves: 0,
})
const bokL = stand.panels.find((p) => p.name === 'bok lewy')!
const bokP = stand.panels.find((p) => p.name === 'bok prawy')!
const [lMin, lMax] = panelZRange(bokL)
const [pMin, pMax] = panelZRange(bokP)
const EPS = 0.001
assert(lMin >= -EPS && Math.abs(lMax - 720) < EPS,
  `bok lewy Z=[${lMin.toFixed(1)},${lMax.toFixed(1)}], expected [0,720]`)
assert(pMin >= -EPS && Math.abs(pMax - 720) < EPS,
  `bok prawy Z=[${pMin.toFixed(1)},${pMax.toFixed(1)}], expected [0,720]`)
console.log(`[ok] boki Z-range: lewy=[${lMin.toFixed(0)},${lMax.toFixed(0)}] prawy=[${pMin.toFixed(0)},${pMax.toFixed(0)}]`)

// ─── brak kolizji w wygenerowanej szafce ─────────────────────────────────────

const standFront  = stand.panels.find((p) => p.name === 'front')!
const standGora   = stand.panels.find((p) => p.name === 'wieniec górny')!
const standDol    = stand.panels.find((p) => p.name === 'dół')!
const standPlecy  = stand.panels.find((p) => p.name === 'plecy')!

// Drzwi muszą być PRZED szafką (Y ≤ 0 przy py=0, pyMax ≤ 0mm → brak nakładania ze strukturą)
const frontYMax = doorYMax(standFront)
assert(frontYMax <= EPS, `front tylna ściana na Y=${frontYMax.toFixed(1)}, expected ≤0 (przed szafką)`)

// Para dół↔plecy: regresja nakładania głębokość D vs backT
assert(!testOBBOverlap(buildOBB(standDol), buildOBB(standPlecy)),
  'dół ↔ plecy: kolizja (głębokość dna = D zamiast D-backT)')

// Para front↔bok lewy: regresja złej pozycji Y drzwi
assert(!testOBBOverlap(buildOBB(standFront), buildOBB(bokL)),
  'front ↔ bok lewy: kolizja (zła pozycja Y drzwi)')

// Para front↔wieniec i front↔dół: te same powody
assert(!testOBBOverlap(buildOBB(standFront), buildOBB(standGora)),
  'front ↔ wieniec: kolizja')
assert(!testOBBOverlap(buildOBB(standFront), buildOBB(standDol)),
  'front ↔ dół: kolizja')

console.log(`[ok] brak kolizji: front Y_max=${frontYMax.toFixed(1)}mm, dół↔plecy OK, front↔struktura OK`)

// ─── szafka dolna (base) ─────────────────────────────────────────────────────

const base = generateCabinet({
  type: 'base', W: 600, H: 820, D: 560, T: 18, backT: 4,
  materialId: 'm1', roomId: 'r1', doors: 1, shelves: 0, plinth: 100,
})
// H=820, plinthH=100, boxH=720
// panels: bok lewy, bok prawy, dół, plecy, listewka przednia, listewka tylna, cokół, front
assert(base.panels.length === 8, `base panels=${base.panels.length}, expected 8`)
const cokol = base.panels.find((p) => p.name === 'cokół')
assert(!!cokol, 'brak cokołu w base')
const cs = contourSize(cokol!.contour)
assert(cs.w === 600 && cs.h === 100, `cokół ${cs.w}×${cs.h}, expected 600×100`)
const bokLewyBase = base.panels.find((p) => p.name === 'bok lewy')
const bcs = contourSize(bokLewyBase!.contour)
assert(bcs.w === 560 && bcs.h === 720, `bok lewy base ${bcs.w}×${bcs.h}, expected 560×720`)
console.log(`[ok] base cabinet: panels=${base.panels.length} cokół=${cs.w}×${cs.h} bok=${bcs.w}×${bcs.h}`)

// ─── 2 drzwi ──────────────────────────────────────────────────────────────────

const double = generateCabinet({
  type: 'standing', W: 900, H: 720, D: 560, T: 18, backT: 4,
  materialId: 'm1', roomId: 'r1', doors: 2, shelves: 1,
})
const fronts = double.panels.filter((p) => p.name.startsWith('front'))
assert(fronts.length === 2, `doors=2 → fronts=${fronts.length}`)
// each door = (900-36+32)/2 = 448
const lFront = fronts[0]
const lfcs = contourSize(lFront.contour)
assert(lfcs.w === 448, `front lewy ${lfcs.w}, expected 448`)
// shelves: 1 extra panel
const shelfPanels = double.panels.filter((p) => p.name.startsWith('półka'))
assert(shelfPanels.length === 1, `shelves=${shelfPanels.length}`)
// hardware: 2 hinges (one per door)
assert(double.hardware.length === 2, `hardware=${double.hardware.length}, expected 2`)
console.log(`[ok] 2 doors + 1 shelf: fronts=${fronts.length} dw=${lfcs.w} shelves=${shelfPanels.length} hw=${double.hardware.length}`)

// ─── szafka wisząca (wall) = same as standing ─────────────────────────────────

const wall = generateCabinet({
  type: 'wall', W: 600, H: 720, D: 320, T: 18, backT: 4,
  materialId: 'm1', roomId: 'r1', doors: 1, shelves: 0,
})
// Same structure as standing — 6 panels (bok×2 + góra + dół + plecy + front)
assert(wall.panels.length === 6, `wall panels=${wall.panels.length}`)
const wallBok = wall.panels.find((p) => p.name === 'bok lewy')
const wcs = contourSize(wallBok!.contour)
assert(wcs.w === 320, `wall bok głębokość ${wcs.w}, expected 320`)
console.log(`[ok] wall cabinet: panels=${wall.panels.length} bok głęb=${wcs.w}`)

// ─── groupId wspólny dla wszystkich elementów ─────────────────────────────────

const { panels: ps, connectors: cs2, hardware: hs } = generateCabinet({
  type: 'standing', W: 600, H: 720, D: 560, T: 18, backT: 4,
  materialId: 'm1', roomId: 'r1', doors: 1, shelves: 0,
})
const gids = new Set([...ps.map((p) => p.groupId), ...cs2.map((c) => c.groupId), ...hs.map((h) => h.groupId)])
assert(gids.size === 1 && gids.has(ps[0].groupId), `groupId nie jest wspólny: ${[...gids].join(',')}`)
console.log(`[ok] groupId wspólny: ${ps[0].groupId}`)

// ─── deterministyczne ID (generateCabinetFromObj) ────────────────────────────

const cab = createCabinet('standing', 'm1', 'r1')
const fromObj = generateCabinetFromObj(cab)

const slotPanel = (slot: string) => fromObj.panels.find((p) => p.id === `${cab.id}:panel:${slot}`)
assert(!!slotPanel('bok-lewy'),   'brak ID bok-lewy')
assert(!!slotPanel('bok-prawy'),  'brak ID bok-prawy')
assert(!!slotPanel('wieniec'),    'brak ID wieniec')
assert(!!slotPanel('dno'),        'brak ID dno')
assert(!!slotPanel('plecy'),      'brak ID plecy')
assert(!!slotPanel('front'),      'brak ID front')
for (const p of fromObj.panels) {
  assert(p.cabinetId === cab.id, `panel ${p.name} ma złe cabinetId: ${p.cabinetId}`)
}
console.log(`[ok] deterministyczne ID: ${fromObj.panels.length} paneli z cabinetId=${cab.id.slice(0,6)}`)

// ─── regeneracja po zmianie W — te same ID, nowe wymiary ─────────────────────

const cab2 = { ...cab, params: { ...cab.params, W: 900 } }
const regen = generateCabinetFromObj(cab2)

const slotPanel2 = (slot: string) => regen.panels.find((p) => p.id === `${cab2.id}:panel:${slot}`)
const bokL2 = slotPanel2('bok-lewy')!
assert(!!bokL2, 'brak ID bok-lewy po zmianie W')
// boki mają głębokość, nie szerokość — sprawdzamy kontur
const bcs2 = contourSize(bokL2.contour)
assert(bcs2.w === 560, `bok lewy głębokość po zmianie W: ${bcs2.w}, expected 560`)
// wieniec powinien mieć szerokość W-2T = 900-36 = 864
const wieniec2 = slotPanel2('wieniec')!
assert(!!wieniec2, 'brak ID wieniec po zmianie W')
const wcs2 = contourSize(wieniec2.contour)
assert(wcs2.w === 864, `wieniec szerokość po zmianie W: ${wcs2.w}, expected 864`)
console.log(`[ok] regeneracja W=900: bok głęb=${bcs2.w} wieniec szer=${wcs2.w}`)

// ─── przesunięcie position → panele przesunięte ───────────────────────────────

const cabMoved = { ...cab, position: [1000, 200, 0] as [number,number,number] }
const moved = generateCabinetFromObj(cabMoved)
const bokLMoved = moved.panels.find((p) => p.name === 'bok lewy')!
// bok lewy x = px+T = 1000+18 = 1018
const bbMoved = worldAABB(bokLMoved)
assert(Math.abs(bbMoved.min[0] - 1000) < EPS, `bok lewy moved X.min=${bbMoved.min[0].toFixed(1)}, expected 1000`)
console.log(`[ok] position [1000,200,0]: bok lewy X.min=${bbMoved.min[0].toFixed(0)}`)

console.log('\n✅ Wszystkie testy cabinet-test przeszły.')
