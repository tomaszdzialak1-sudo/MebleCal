/**
 * Sanity Fazy 6 — rozkrój i nesting.
 * Uruchom: npm run test:cutlist
 *
 * (1) buildCutList: wymiary po odjęciu okleiny
 * (2) nest: brak nakładania formatek, kerf zachowany
 * (3) nest: wszystkie elementy ułożone
 * (4) migracja: stary projekt bez bandingThickness → 1, buildCutList bez NaN
 */
import { buildCutList } from '../src/model/cutlist'
import { nest } from '../src/model/nesting'
import { parseProjectFile, serializeProject } from '../src/model/serialization'
import type { Material, Panel, Project } from '../src/model/types'

// --- Helpers ----------------------------------------------------------------
let failed = 0
function assert(cond: boolean, msg: string) {
  if (!cond) { console.error(`  BŁĄD: ${msg}`); failed++ }
  else console.log(`  OK: ${msg}`)
}

const mkPanel = (over: Partial<Panel>): Panel => ({
  id: 'p1', name: 'bok', materialId: 'm1', roomId: '', thickness: 18,
  contour: [[0,0],[600,0],[600,720],[0,720]],
  transform: { position: [0,0,0], rotation: [0,0,0] },
  edges: [
    { cutAngle: 90 },
    { cutAngle: 90 },
    { cutAngle: 90 },
    { cutAngle: 90 },
  ],
  baseFace: 'front', operations: [], ...over,
})

const mat: Material = {
  id: 'm1', name: 'Płyta 18mm', thickness: 18, hasGrain: false,
  sheet: { w: 2800, h: 2070 },
}

const baseProject = (panels: Panel[], bandingThickness = 1): Project => ({
  id: 'P', name: 'test', units: 'mm',
  settings: { kerf: 3, bandingAllowance: 1, defaultBaseFace: 'front', bandingThickness },
  materials: [mat],
  panels,
  connectors: [], hardware: [], rooms: [],
})

// === (1) buildCutList: wymiary cięcia ======================================
console.log('\n=== (1) buildCutList — wymiary cięcia ===')
{
  // Płyta 600×720, oklejone krawędzie: 1 (P/prawo), 3 (L/lewo), 2 (G/góra), t=1
  const panel = mkPanel({
    edges: [
      { cutAngle: 90 },                          // 0: dół — brak okleiny
      { cutAngle: 90, bandingType: 'ABS 1mm' }, // 1: prawo  → −1 od szer.
      { cutAngle: 90, bandingType: 'ABS 1mm' }, // 2: góra   → −1 od wys.
      { cutAngle: 90, bandingType: 'ABS 1mm' }, // 3: lewo   → −1 od szer.
    ],
  })
  const list = buildCutList(baseProject([panel]))
  assert(list.length === 1, 'jedna pozycja')
  const item = list[0]
  assert(item.cutW === 598, `cutW=598 (600 − 1 − 1 = ${item.cutW})`)
  assert(item.cutH === 719, `cutH=719 (720 − 1 = ${item.cutH})`)
  assert(item.qty === 1, 'qty=1')
  assert(item.bandedEdges.join(',') === '1,2,3', `bandedEdges=[${item.bandedEdges}]`)
  assert(!item.hasMiter, 'hasMiter=false')
}
{
  // Dwie identyczne płyty → qty=2
  const p1 = mkPanel({ id: 'p1', name: 'bok', edges: [{ cutAngle: 90 },{ cutAngle: 90, bandingType:'ABS' },{ cutAngle: 90 },{ cutAngle: 90 }] })
  const p2 = mkPanel({ id: 'p2', name: 'bok', edges: [{ cutAngle: 90 },{ cutAngle: 90, bandingType:'ABS' },{ cutAngle: 90 },{ cutAngle: 90 }] })
  const list = buildCutList(baseProject([p1, p2]))
  assert(list.length === 1, 'dwie identyczne → 1 pozycja')
  assert(list[0].qty === 2, 'qty=2')
}

// === (2) nest: brak nakładania + kerf ======================================
console.log('\n=== (2) nest — brak nakładania formatek ===')
{
  const panels = Array.from({ length: 6 }, (_, i) =>
    mkPanel({ id: `p${i}`, name: `płyta ${i+1}` }),
  )
  const list = buildCutList(baseProject(panels))
  const result = nest(list, mat, 3)

  // Sprawdź wszystkie pary umieszczonych formatek na wszystkich arkuszach.
  let overlaps = 0
  for (const sheet of result.sheets) {
    const ps = sheet.placements
    for (let a = 0; a < ps.length; a++) {
      for (let b = a + 1; b < ps.length; b++) {
        const A = ps[a], B = ps[b]
        const overlapX = A.x + A.w > B.x && B.x + B.w > A.x
        const overlapY = A.y + A.h > B.y && B.y + B.h > A.y
        if (overlapX && overlapY) overlaps++
      }
    }
  }
  assert(overlaps === 0, `brak nakładania (nakładania: ${overlaps})`)
  assert(result.sheetCount >= 1, `arkusze: ${result.sheetCount}`)
  assert(result.totalWastePct >= 0 && result.totalWastePct <= 1, `totalWastePct ∈ [0,1]: ${result.totalWastePct.toFixed(2)}`)
  console.log(`  info: ${result.sheetCount} arkusz(y), ${Math.round(result.totalWastePct * 100)}% odpad`)
}

// === (3) nest: wszystkie elementy ułożone ==================================
console.log('\n=== (3) nest — wszystkie elementy ułożone ===')
{
  const panels = Array.from({ length: 4 }, (_, i) =>
    mkPanel({ id: `q${i}`, name: `el ${i+1}`, contour: [[0,0],[300,0],[300,400],[0,400]] }),
  )
  const list = buildCutList(baseProject(panels))
  const result = nest(list, mat, 3)
  const placed = result.sheets.reduce((s, sh) => s + sh.placements.length, 0)
  const expected = list.reduce((s, it) => s + it.qty, 0)
  assert(placed === expected, `ułożono ${placed}/${expected} elementów`)
}

// === (4) migracja: stary plik bez bandingThickness =========================
console.log('\n=== (4) migracja: stary projekt bez bandingThickness ===')
{
  const panel = mkPanel({ edges: [{ cutAngle:90 },{ cutAngle:90, bandingType:'ABS' },{ cutAngle:90 },{ cutAngle:90 }] })
  const proj = baseProject([panel])
  // Symuluj stary plik: usuń bandingThickness z settings.
  const raw = JSON.parse(serializeProject(proj))
  delete raw.project.settings.bandingThickness
  const text = JSON.stringify(raw)

  const loaded = parseProjectFile(text)
  assert(loaded.settings.bandingThickness === 1, `po migracji bandingThickness=1 (jest: ${loaded.settings.bandingThickness})`)

  const list = buildCutList(loaded)
  const noNaN = list.every((i) => !isNaN(i.cutW) && !isNaN(i.cutH))
  assert(noNaN, 'buildCutList nie zwraca NaN po migracji')
  assert(list[0].cutW === 599, `cutW=599 (600−1, krawędź prawo) = ${list[0].cutW}`)
}

// === Werdykt ===============================================================
console.log(`\n=== WERDYKT ===`)
if (failed === 0) {
  console.log('  OK ✅ — rozkrój/nesting/migracja poprawne')
  process.exit(0)
} else {
  console.log(`  BŁĄD ❌ — ${failed} asercja(e) nie przeszły`)
  process.exit(1)
}
