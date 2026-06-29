/**
 * Dowód przypisania parametrów mimośrodu (cam) do właściwych nawiertów.
 * Uruchom: npm run test:cam.
 *
 * Sprawdzamy empirycznie:
 *  (1) emit z różnymi Ø: puszka 15 / trzpień 8 / dojście 30,
 *  (2) perturbację kluczy parametrów,
 *  (3) CAM_PARAMS jako źródło etykiet UI,
 *  (4) przypisanie do płyt i typów lica,
 *  (5) działanie camFace, autoCamFace i camEdgeDistance,
 *  (6) fallback ról przy niejednoznacznym styku,
 *  (7) brak fałszywego ostrzeżenia walidacji dla cam,
 *  (8) rozsunięte płyty bez uciekania nawiertu poza obrys,
 *  (9) import/regeneracja układu z pliku użytkownika,
 *  (10) werdykt.
 */
import { emitConnectorOps, CAM_PARAMS, autoCamFace, deriveConnectorAnchor, resolveConnectorRoles } from '../src/model/connectors'
import { collectWarnings } from '../src/model/validate'
import type { Connector, Panel, Project } from '../src/model/types'

const mkPanel = (over: Partial<Panel>): Panel => ({
  id: 'x',
  name: 'x',
  materialId: 'm',
  roomId: '',
  thickness: 18,
  contour: [
    [0, 0],
    [600, 0],
    [600, 720],
    [0, 720],
  ],
  transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
  edges: [{ cutAngle: 90 }, { cutAngle: 90 }, { cutAngle: 90 }, { cutAngle: 90 }],
  baseFace: 'front',
  operations: [],
  ...over,
})

// A = płyta z LICEM styku (→ trzpień).
// B = płyta dochodząca CZOŁEM (→ puszka na licu B + dojście od czoła B).
const panelA = mkPanel({ id: 'A', name: 'A', transform: { position: [0, 0, 0], rotation: [0, 0, 0] } })
const panelB = mkPanel({ id: 'B', name: 'B', transform: { position: [0, 0, 0], rotation: [90, 0, 0] } })

const conn = (params: Record<string, number>, patch: Partial<Connector> = {}): Connector => ({
  id: 'C',
  type: 'cam',
  panelA: 'A',
  panelB: 'B',
  placement: { fromEdge: 0, offset: 300 },
  params,
  ...patch,
})

function role(id: string): string {
  if (id.endsWith(':A:0')) return 'TRZPIEŃ'
  if (id.endsWith(':B:0')) return 'PUSZKA'
  if (id.endsWith(':B:1')) return 'DOJŚCIE'
  return '?'
}

console.log('=== (1) emit: puszka Ø15, trzpień Ø8, dojście Ø30 ===')
const res = emitConnectorOps(
  conn({ camDiameter: 15, boltDiameter: 8, crossDiameter: 30 }),
  panelA,
  panelB,
)
const { opsA, opsB } = res
const panelOf = new Map<string, string>()
for (const o of opsA) panelOf.set(o.id, 'panel A (lico styku)')
for (const o of opsB) panelOf.set(o.id, 'panel B (czoło + lico z puszką)')
const ops = [...opsA, ...opsB]
for (const o of ops) {
  const h = o.hole!
  console.log(
    `  ${o.id}  ${role(o.id).padEnd(8)} Ø=${h.diameter}  głęb=${h.depth}  poz=(${h.x.toFixed(1)},${h.y.toFixed(1)})  →  ${panelOf.get(o.id)}  (face=${JSON.stringify(o.face)})`,
  )
}

console.log('\n=== (2) perturbacja Ø: bump klucza o +500, który otwór się zmienił ===')
const diaKeys = ['camDiameter', 'boltDiameter', 'crossDiameter']
const base: Record<string, number> = { camDiameter: 100, boltDiameter: 100, crossDiameter: 100 }
const baseOps = [...emitConnectorOps(conn(base), panelA, panelB).opsA, ...emitConnectorOps(conn(base), panelA, panelB).opsB]
const baseDia: Record<string, number> = Object.fromEntries(baseOps.map((o) => [o.id, o.hole!.diameter]))

for (const k of diaKeys) {
  const p = { ...base, [k]: 600 }
  const r = [...emitConnectorOps(conn(p), panelA, panelB).opsA, ...emitConnectorOps(conn(p), panelA, panelB).opsB]
  const changed = r.filter((o) => o.hole!.diameter !== baseDia[o.id]).map((o) => `${o.id} (${role(o.id)})`)
  console.log(`  params.${k}  steruje Ø otworu:  ${changed.join(', ') || '— (nic!)'}`)
}

console.log('\n=== (3) CAM_PARAMS (źródło etykiet UI) — klucz → etykieta → otwór ===')
for (const f of CAM_PARAMS) console.log(`  ${f.key.padEnd(18)} "${f.label}"  (otwór: ${f.hole})`)

console.log('\n=== (4) przypisanie otworów do płyt i lic ===')
const aIds = new Set(opsA.map((o) => o.id))
const bIds = new Set(opsB.map((o) => o.id))
const opBy = (id: string) => ops.find((o) => o.id === id)!
const trzOnA = aIds.has('C:A:0') && typeof opBy('C:A:0').face === 'string'
const puszkaOnBFace = bIds.has('C:B:0') && typeof opBy('C:B:0').face === 'string'
const dojscieOnBEdge = bIds.has('C:B:1') && typeof opBy('C:B:1').face !== 'string'
const cupH = opBy('C:B:0').hole!
const accessH = opBy('C:B:1').hole!
const sameAxis = cupH.x === accessH.x
console.log(`  panel A / lico:             ${[...aIds].map(role).join(', ')}`)
console.log(`  panel B / puszka+dojście:   ${[...bIds].map(role).join(', ')}`)
console.log(`  puszka  poz=(${cupH.x.toFixed(1)}, ${cupH.y.toFixed(1)})  face=${JSON.stringify(opBy('C:B:0').face)}`)
console.log(`  dojście poz=(${accessH.x.toFixed(1)}, ${accessH.y.toFixed(1)})  face=${JSON.stringify(opBy('C:B:1').face)}`)
console.log(`  dojście i puszka w tej samej osi wzdłuż krawędzi: ${sameAxis}`)

console.log('\n=== (5) camFace + camEdgeDistance ===')
const tuned = emitConnectorOps(
  conn(
    { camDiameter: 15, boltDiameter: 8, crossDiameter: 30, camEdgeDistance: 42 },
    { camFace: 'back' },
  ),
  panelA,
  panelB,
)
const tunedCup = [...tuned.opsA, ...tuned.opsB].find((o) => o.id === 'C:B:0')!
const faceOk = tunedCup.face === 'back'
const edgeDistanceOk = tunedCup.hole!.y === 42
const autoFace = autoCamFace(panelA, panelB)
const defaultCup = opBy('C:B:0')
const defaultAccess = opBy('C:B:1')
const defaultDistanceOk = defaultCup.hole!.y === 34
const defaultCupDepthOk = defaultCup.hole!.depth === 13
const defaultAccessDepthOk = defaultAccess.hole!.depth === 34
console.log(`  camFace='back' → face puszki: ${JSON.stringify(tunedCup.face)}`)
console.log(`  camEdgeDistance=42 → pozycja puszki w głąb od czoła: ${tunedCup.hole!.y}`)
console.log(`  autoCamFace(panelA,panelB) → ${autoFace}`)
console.log(`  defaulty: camEdgeDistance=${defaultCup.hole!.y}, camDepth=${defaultCup.hole!.depth}, crossDepth=${defaultAccess.hole!.depth}`)

console.log('\n=== (6) fallback ról dla cam przy niejednoznacznym styku ===')
const fallback = resolveConnectorRoles('cam', panelB, panelA)
const fallbackOk = fallback.edgePanel.id === 'B' && fallback.facePanel.id === 'A'
console.log(`  dodajesz z panelu B do A → panel B = puszka/dojście, panel A = trzpień: ${fallbackOk}`)

console.log('\n=== (7) walidacja miękka nie ostrzega o symetrii cam ===')
const project: Project = {
  id: 'P',
  name: 'test',
  units: 'mm',
  settings: { kerf: 3.2, bandingAllowance: 2, defaultBaseFace: 'front' },
  materials: [{ id: 'm', name: 'm', thickness: 18, hasGrain: false, sheet: { w: 2800, h: 2070 } }],
  panels: [panelA, panelB],
  connectors: [conn({})],
  hardware: [],
  rooms: [],
}
const camWarnings = collectWarnings(project).filter((w) => w.includes('nie da się jednoznacznie ustalić'))
const validationOk = camWarnings.length === 0
console.log(`  ostrzeżenia o niejednoznacznych rolach cam: ${camWarnings.length}`)

console.log('\n=== (8) rozsunięte płyty: nawiert zostaje w swojej płycie ===')
const shiftedA = mkPanel({ id: 'A', name: 'A', transform: { position: [0, 60, 0], rotation: [0, 0, 0] } })
const shiftedAnchor = deriveConnectorAnchor(shiftedA, panelB, conn({}).placement)
const shiftedOps = emitConnectorOps(conn({ boltDiameter: 60 }), shiftedA, panelB)
const shiftedBolt = shiftedOps.opsA.find((o) => o.id === 'C:A:0')!.hole!
const shiftedRadius = shiftedBolt.diameter / 2
const shiftedSafe =
  shiftedBolt.x >= shiftedRadius &&
  shiftedBolt.x <= 600 - shiftedRadius &&
  shiftedBolt.y >= shiftedRadius &&
  shiftedBolt.y <= 720 - shiftedRadius &&
  shiftedAnchor.touching === false &&
  shiftedAnchor.onFaceA === false
console.log(`  surowy anchor: x=${shiftedAnchor.xA.toFixed(1)}, y=${shiftedAnchor.yA.toFixed(1)}, onFaceA=${shiftedAnchor.onFaceA}`)
console.log(`  nawiert po zabezpieczeniu: x=${shiftedBolt.x.toFixed(1)}, y=${shiftedBolt.y.toFixed(1)}, cały okrąg w obrysie=${shiftedSafe}`)

console.log('\n=== (9) import z rozsuniętym układem: poprawna strona + bez wystawania ===')
const importedA = mkPanel({
  id: 'A',
  name: 'płyta 2',
  transform: { position: [-298.7, 46.2, 736.3], rotation: [0, 0, 0] },
})
const importedB = mkPanel({
  id: 'B',
  name: 'bok lewy',
  transform: { position: [-300, 0, 0], rotation: [90, 0, 0] },
})
const importedConnector = conn({}, { placement: { fromEdge: 2, offset: 300 } })
const importedAnchor = deriveConnectorAnchor(importedA, importedB, importedConnector.placement)
const importedOps = emitConnectorOps(importedConnector, importedA, importedB)
const importedBoltOp = importedOps.opsA.find((o) => o.id === 'C:A:0')!
const importedBolt = importedBoltOp.hole!
const importedRadius = importedBolt.diameter / 2
const importedSafe =
  importedBoltOp.face === 'back' &&
  importedBolt.x >= importedRadius &&
  importedBolt.x <= 600 - importedRadius &&
  importedBolt.y >= importedRadius &&
  importedBolt.y <= 720 - importedRadius &&
  importedAnchor.touching === false &&
  importedAnchor.onFaceA === false
console.log(`  surowy anchor: face=${importedAnchor.faceA}, x=${importedAnchor.xA.toFixed(1)}, y=${importedAnchor.yA.toFixed(1)}, onFaceA=${importedAnchor.onFaceA}`)
console.log(`  trzpień po regeneracji: face=${JSON.stringify(importedBoltOp.face)}, x=${importedBolt.x.toFixed(1)}, y=${importedBolt.y.toFixed(1)}, cały okrąg w obrysie=${importedSafe}`)

const pus = opBy('C:B:0').hole!.diameter
const trz = opBy('C:A:0').hole!.diameter
const doj = opBy('C:B:1').hole!.diameter
const layout =
  trzOnA &&
  puszkaOnBFace &&
  dojscieOnBEdge &&
  sameAxis &&
  faceOk &&
  edgeDistanceOk &&
  defaultDistanceOk &&
  defaultCupDepthOk &&
  defaultAccessDepthOk &&
  fallbackOk &&
  validationOk &&
  shiftedSafe &&
  importedSafe
const ok = pus === 15 && trz === 8 && doj === 30 && layout

console.log(`\n=== (10) WERDYKT ===`)
console.log(`  puszka(B:0) Ø=${pus}/15 · trzpień(A:0) Ø=${trz}/8 · dojście(B:1) Ø=${doj}/30`)
console.log(`  trzpień w licu A: ${trzOnA} · puszka na licu B: ${puszkaOnBFace} · dojście w czole B: ${dojscieOnBEdge}`)
console.log(`  camFace działa: ${faceOk} · camEdgeDistance działa: ${edgeDistanceOk} · fallback ról działa: ${fallbackOk} · walidacja działa: ${validationOk} · rozsunięcie bez uciekania: ${shiftedSafe} · import OK: ${importedSafe}`)
console.log(`  ${ok ? 'OK ✅ — mapowanie + układ płyt/lic + parametry mimośrodu poprawne' : 'BŁĄD ❌'}`)
process.exit(ok ? 0 : 1)
