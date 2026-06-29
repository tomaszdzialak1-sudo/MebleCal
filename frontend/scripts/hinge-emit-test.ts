/**
 * Dowód parametrów nawiertów zawiasu Blum CLIP top BLUMOTION 110°.
 * Uruchom: npm run test:hinge.
 */
import { cupCenterDistance, cupMountHoles, plateHoles } from '../src/model/blum-catalog'
import { deriveHingeAnchor, emitHingeOps } from '../src/model/hinges'
import type { Hardware, Panel } from '../src/model/types'
import { saveUserCatalog, type HardwareEntry } from '../src/model/hardware-catalog'

const mkPanel = (over: Partial<Panel>): Panel => ({
  id: 'x',
  name: 'x',
  materialId: 'm',
  roomId: '',
  thickness: 18,
  contour: [
    [0, 0],
    [400, 0],
    [400, 700],
    [0, 700],
  ],
  transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
  edges: [{ cutAngle: 90 }, { cutAngle: 90 }, { cutAngle: 90 }, { cutAngle: 90 }],
  baseFace: 'front',
  operations: [],
  ...over,
})

const front = mkPanel({ id: 'F', name: 'front' })
const side = mkPanel({ id: 'S', name: 'bok', transform: { position: [0, 0, 0], rotation: [0, -90, 0] } })

const hardware: Hardware = {
  id: 'h',
  kind: 'hinge',
  hinge: {
    family: 'CLIP top BLUMOTION',
    openingAngle: 110,
    overlayClass: 'full',
    cup: { diameter: 35, distanceTB: 5, depth: 13, mounting: 'screw', screwPattern: [] },
    plate: { distance: 0, type: 'CLIP', screwPattern: [] },
    options: { blumotion: true, tipOn: false, servoDrive: false },
    doorPanel: 'F',
    sidePanel: 'S',
    placement: [{ fromEdge: 3, offset: 100 }],
  },
}

const hinge = hardware.hinge!
const { opsFront, opsSide } = emitHingeOps(hardware, front, side)
const all = [...opsFront, ...opsSide]
const byId = (id: string) => all.find((o) => o.id === id)!
const hole = (id: string) => byId(id).hole!

console.log('=== Blum CLIP top BLUMOTION 110° — nawierty ===')

const cup = hole('h:cup:0')
const s0 = hole('h:cupscrew:0:0')
const s1 = hole('h:cupscrew:0:1')
const p0 = hole('h:plate:0:0')
const p1 = hole('h:plate:0:1')

console.log(`  TB/B = ${hinge.cup.distanceTB}`)
console.log(`  środek puszki C = TB + Ø/2 = ${cupCenterDistance(hinge.cup.distanceTB, hinge.cup.diameter)}`)
console.log(`  puszka:    Ø=${cup.diameter}, głęb=${cup.depth}, poz=(${cup.x}, ${cup.y}), face=${JSON.stringify(byId('h:cup:0').face)}`)
console.log(`  mocowanie: Ø=${s0.diameter}/${s1.diameter}, poz=(${s0.x}, ${s0.y}) i (${s1.x}, ${s1.y})`)
console.log(`  prowadnik: Ø=${p0.diameter}/${p1.diameter}, rozstaw=${Math.abs(p0.y - p1.y)}, face=${JSON.stringify(byId('h:plate:0:0').face)}`)

const screwPattern = cupMountHoles('screw')
const insertaPattern = cupMountHoles('inserta')
const platePattern = plateHoles()
const anchor = deriveHingeAnchor(front, side, 3, 100, hinge.cup.distanceTB, hinge.cup.diameter)

const cupOk = cup.diameter === 35 && cup.depth === 13 && cup.x === 22.5 && cup.y === 600
const screwOk =
  s0.diameter === 3.5 &&
  s1.diameter === 3.5 &&
  s0.x === 32 &&
  s1.x === 32 &&
  Math.abs(s0.y - s1.y) === 45
const insertaOk = insertaPattern.every((h) => h.diameter === 8 && h.inward === 9.5) && Math.abs(insertaPattern[0].along - insertaPattern[1].along) === 45
const plateOk = platePattern.every((h) => h.diameter === 5 && h.inward === 37) && Math.abs(platePattern[0].along - platePattern[1].along) === 32
const emittedPlateOk = p0.diameter === 5 && p1.diameter === 5 && byId('h:plate:0:0').face === 'back'
const axisOk = anchor.axisWorld.length === 2 && anchor.axisWorld.every((p) => p.length === 3)

console.log('\n=== WERDYKT ===')
console.log(`  puszka C=22.5 przy TB=5: ${cupOk}`)
console.log(`  mocowanie puszki 45/9.5 po dalszej stronie puszki: ${screwOk}`)
console.log(`  INSERTA/EXPANDO Ø8 na 45/9.5: ${insertaOk}`)
console.log(`  prowadnik system 32: 37 / 32 / Ø5 na wewnętrznym licu: ${plateOk && emittedPlateOk}`)
console.log(`  oś obrotu dostępna jako axisWorld: ${axisOk}`)

// === Test: zawias z katalogu (hingeId → Ø36/głęb.14, wkręty X=9.5/Y=±22.5) ===
console.log('\n=== Zawias z katalogu — hingeId → niestandardowe nawierty ===')

const customEntry: HardwareEntry = {
  id: 'custom-hinge-test',
  name: 'Test Ø36',
  manufacturer: 'Test',
  kind: 'hinge',
  drillPattern: [
    { x: 0,   y:    0,  diameter: 36, depth: 14,   group: 1, role: 'cup' },
    { x: 9.5, y:  22.5, diameter: 3,  depth: 10,   group: 1, role: 'cupScrew' },
    { x: 9.5, y: -22.5, diameter: 3,  depth: 10,   group: 1, role: 'cupScrew' },
    { x: 37,  y:   16,  diameter: 5,  depth: 11.5, group: 2, role: 'plate' },
    { x: 37,  y:  -16,  diameter: 5,  depth: 11.5, group: 2, role: 'plate' },
  ],
  meta: {},
}
// Wpis z jawnym inward/along (x/y celowo błędne → dowód, że emiter czyta inward/along)
const plateInwardEntry: HardwareEntry = {
  id: 'custom-hinge-plate-inward-test',
  name: 'Test plate inward/along',
  manufacturer: 'Test',
  kind: 'hinge',
  drillPattern: [
    { x: 0,   y: 0,  diameter: 36, depth: 14,   group: 1, role: 'cup' },
    { x: 9.5, y:  22.5, diameter: 3, depth: 10,  group: 1, role: 'cupScrew' },
    { x: 9.5, y: -22.5, diameter: 3, depth: 10,  group: 1, role: 'cupScrew' },
    // x/y=99 (złe) — emiter ma czytać inward=37, along=±16
    { x: 99, y: 99, diameter: 5, depth: 11.5, group: 2, role: 'plate', inward: 37, along:  16 },
    { x: 99, y: 99, diameter: 5, depth: 11.5, group: 2, role: 'plate', inward: 37, along: -16 },
  ],
  meta: {},
}
saveUserCatalog([customEntry, plateInwardEntry])

const hardwareCat: Hardware = {
  id: 'hcat',
  kind: 'hinge',
  hinge: {
    family: 'CLIP top BLUMOTION',
    openingAngle: 110,
    overlayClass: 'full',
    cup: { diameter: 35, distanceTB: 5, depth: 13, mounting: 'screw', screwPattern: [] },
    plate: { distance: 0, type: 'CLIP', screwPattern: [] },
    options: { blumotion: true, tipOn: false, servoDrive: false },
    doorPanel: 'F',
    sidePanel: 'S',
    placement: [{ fromEdge: 3, offset: 100 }],
    hingeId: 'custom-hinge-test',
  },
}

const { opsFront: catFront, opsSide: catSide } = emitHingeOps(hardwareCat, front, side)
const cupCat  = catFront.find((o) => o.id === 'hcat:cup:0')?.hole
const sc0     = catFront.find((o) => o.id === 'hcat:cupscrew:0:0')?.hole
const sc1     = catFront.find((o) => o.id === 'hcat:cupscrew:0:1')?.hole
const pl0     = catSide.find((o) => o.id === 'hcat:plate:0:0')?.hole

// Ø36/14 z katalogu (NIE Ø35/13 z modelu)
const cupCatalogOk = cupCat?.diameter === 36 && cupCat?.depth === 14
console.log(`  puszka: Ø${cupCat?.diameter}/głęb.${cupCat?.depth} (oczekiwano Ø36/14): ${cupCatalogOk}`)

// Wkręty: X=9.5/Y=±22.5 dodawane bezpośrednio do środka puszki, bez przeliczania.
// Przy TB=5, Ø36: C = 5 + 18 = 23; edge 3 → along=[0,−1], inward=[1,0]
// cupCat.x=23, cupCat.y=600; screw(x=9.5, y=22.5) → pos=[32.5, 577.5]
// inward offset = sc.x − cup.x = 9.5; along offset = |sc.y − cup.y| = 22.5
const inwardOk = !!sc0 && !!cupCat && Math.abs((sc0.x - cupCat.x) - 9.5) < 1e-9
const along0Ok = !!sc0 && !!cupCat && Math.abs(Math.abs(sc0.y - cupCat.y) - 22.5) < 1e-9
const along1Ok = !!sc1 && !!cupCat && Math.abs(Math.abs(sc1.y - cupCat.y) - 22.5) < 1e-9
const screwOffsetOk = inwardOk && along0Ok && along1Ok
console.log(`  wkręt inward: ${sc0 && cupCat ? (sc0.x - cupCat.x).toFixed(9) : '?'} (oczekiwano 9.5): ${inwardOk}`)
console.log(`  wkręt along±: ${sc0 && cupCat ? Math.abs(sc0.y - cupCat.y).toFixed(9) : '?'} / ${sc1 && cupCat ? Math.abs(sc1.y - cupCat.y).toFixed(9) : '?'} (oczekiwano 22.5): ${screwOffsetOk}`)

// Prowadnik z katalogu: Ø5/głęb.11.5
const plateCatalogOk = pl0?.diameter === 5 && pl0?.depth === 11.5
console.log(`  prowadnik: Ø${pl0?.diameter}/głęb.${pl0?.depth} (oczekiwano Ø5/11.5): ${plateCatalogOk}`)

// Regresja pozycji: katalog (x=37,y=±16) musi dawać te same pozycje co fallback.
// Kolejność wierceń może być różna → porównujemy jako zbiór (po y).
const pl1 = catSide.find((o) => o.id === 'hcat:plate:0:1')?.hole
const catYs  = [pl0, pl1].filter(Boolean).map((h) => h!.y).sort((a, b) => a - b)
const fallYs = [p0, p1].map((h) => h.y).sort((a, b) => a - b)
const catX   = pl0?.x
const fallX  = p0.x
const platePosCatEqFallback =
  !!pl0 && !!pl1 &&
  Math.abs((catX ?? 0) - fallX) < 1e-9 &&
  catYs.every((y, i) => Math.abs(y - fallYs[i]) < 1e-9)
console.log(`  pozycje prowadnika kat=fallback: kat x=${catX?.toFixed(1)} y=[${catYs.map((y)=>y.toFixed(1))}] vs fallback x=${fallX.toFixed(1)} y=[${fallYs.map((y)=>y.toFixed(1))}]: ${platePosCatEqFallback}`)

// Wkręty mają Ø3/głęb.10 z katalogu (NIE Ø3.5/głęb.11 z blum-catalog.ts)
const screwDiamOk = sc0?.diameter === 3 && sc0?.depth === 10 && sc1?.diameter === 3
console.log(`  wkręty: Ø${sc0?.diameter}/głęb.${sc0?.depth} (oczekiwano Ø3/10): ${screwDiamOk}`)

// === Test: fallback (brak hingeId) → Ø35/13 jak wcześniej ==================
console.log('\n=== Fallback (brak hingeId) → Ø35/13 ===')
// hardware z wcześniej (bez hingeId) → cupOk już to pokrywa, tu jawne potwierdzenie
const { opsFront: fallFront } = emitHingeOps(hardware, front, side)
const cupFall = fallFront.find((o) => o.id === 'h:cup:0')?.hole
const fallbackOk = cupFall?.diameter === 35 && cupFall?.depth === 13
console.log(`  puszka fallback: Ø${cupFall?.diameter}/głęb.${cupFall?.depth} (oczekiwano Ø35/13): ${fallbackOk}`)

// === Regresja Y=683 — ścieżka inward/along (x/y=99 celowo złe) ================
// Dowód, że emiter czyta h.inward/h.along zamiast h.x/h.y dla role='plate'.
console.log('\n=== Regresja Y=683: ścieżka inward/along (x/y=99), offset=100, h=799mm ===')
const front799ia = mkPanel({ id: 'F799ia', name: 'front-799ia', contour: [[0,0],[400,0],[400,799],[0,799]] })
const side799ia  = mkPanel({ id: 'S799ia', name: 'bok-799ia',   contour: [[0,0],[400,0],[400,799],[0,799]], transform: { position: [0,0,0], rotation: [0,-90,0] } })
const hw799ia: Hardware = {
  id: 'h799ia',
  kind: 'hinge',
  hinge: {
    family: 'CLIP top BLUMOTION',
    openingAngle: 110,
    overlayClass: 'full',
    cup: { diameter: 35, distanceTB: 5, depth: 13, mounting: 'screw', screwPattern: [] },
    plate: { distance: 0, type: 'CLIP', screwPattern: [] },
    options: { blumotion: true, tipOn: false, servoDrive: false },
    doorPanel: 'F799ia',
    sidePanel: 'S799ia',
    placement: [{ fromEdge: 3, offset: 100 }],
    hingeId: 'custom-hinge-plate-inward-test',
  },
}
const { opsSide: ops799ia } = emitHingeOps(hw799ia, front799ia, side799ia)
const ys799ia = ops799ia.filter((o) => o.id.startsWith('h799ia:plate')).map((o) => o.hole!.y).sort((a, b) => a - b)
const regInwardAlongOk = ys799ia.length === 2 && Math.abs(ys799ia[0] - 683) < 1e-9 && Math.abs(ys799ia[1] - 715) < 1e-9
console.log(`  prowadnik ys=[${ys799ia.map((y) => y.toFixed(1))}] (oczekiwano [683.0, 715.0]): ${regInwardAlongOk}`)

// === Regresja Y=683: katalog (x/y), offset=100, TB=5, panel 799mm =============
// a.height=100 na boku → otwory: 799−(100+16)=683, 799−(100−16)=715.
console.log('\n=== Regresja Y=683: katalog (x/y), offset=100, TB=5, h=799mm ===')
const front799 = mkPanel({ id: 'F799', name: 'front-799', contour: [[0,0],[400,0],[400,799],[0,799]] })
const side799  = mkPanel({ id: 'S799', name: 'bok-799',   contour: [[0,0],[400,0],[400,799],[0,799]], transform: { position: [0,0,0], rotation: [0,-90,0] } })
const hw799: Hardware = {
  id: 'h799',
  kind: 'hinge',
  hinge: {
    family: 'CLIP top BLUMOTION',
    openingAngle: 110,
    overlayClass: 'full',
    cup: { diameter: 35, distanceTB: 5, depth: 13, mounting: 'screw', screwPattern: [] },
    plate: { distance: 0, type: 'CLIP', screwPattern: [] },
    options: { blumotion: true, tipOn: false, servoDrive: false },
    doorPanel: 'F799',
    sidePanel: 'S799',
    placement: [{ fromEdge: 3, offset: 100 }],
    hingeId: 'custom-hinge-test',
  },
}
const { opsSide: ops799 } = emitHingeOps(hw799, front799, side799)
const ys799 = ops799.filter((o) => o.id.startsWith('h799:plate')).map((o) => o.hole!.y).sort((a, b) => a - b)
const regY683ok = ys799.length === 2 && Math.abs(ys799[0] - 683) < 1e-9 && Math.abs(ys799[1] - 715) < 1e-9
console.log(`  prowadnik ys=[${ys799.map((y) => y.toFixed(1))}] (oczekiwano [683.0, 715.0]): ${regY683ok}`)

const ok =
  cupOk && screwOk && insertaOk && plateOk && emittedPlateOk && axisOk &&
  cupCatalogOk && screwOffsetOk && plateCatalogOk && screwDiamOk && fallbackOk &&
  platePosCatEqFallback && regInwardAlongOk && regY683ok
console.log(`  ${ok ? 'OK ✅ — parametry zawiasu poprawne' : 'BŁĄD ❌'}`)
process.exit(ok ? 0 : 1)
