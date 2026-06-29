/**
 * Test kreatora okuć: ręcznie wpisany zawias ma tworzyć jeden kompletny szablon
 * z nawiertami na froncie i boku.
 * Uruchom: npm run test:hardware-template
 */
import { buildHingeTemplateEntry, validateHingeTemplateDraft, type HingeTemplateDraft } from '../src/model/hardware-template'
import { emitHingeOps } from '../src/model/hinges'
import { saveUserCatalog } from '../src/model/hardware-catalog'
import type { Hardware, Panel } from '../src/model/types'

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

let ok = true
const fail = (msg: string) => {
  console.log(`  BŁĄD ❌ ${msg}`)
  ok = false
}

console.log('=== Kreator okuć — walidacja pustego zawiasu ===')
const empty = validateHingeTemplateDraft({ name: '', manufacturer: '' })
console.log(`  błędy: ${empty.errors.length}`)
if (empty.errors.length < 3) fail('pusty szablon powinien wymagać nazwy, puszki i prowadnika')
else console.log('  OK ✅')

console.log('\n=== Kreator okuć — kompletny zawias ręczny ===')
const draft: HingeTemplateDraft = {
  name: 'Ręczny CLIP top 110',
  manufacturer: 'Blum',
  openingAngle: 110,
  overlayClass: 'full',
  tbDefault: 5,
  plateDistance: 0,
  cupDiameter: 35,
  cupDepth: 13,
  cupScrewDiameter: 2.5,
  cupScrewDepth: 3,
  cupScrewInward: 9.5,
  cupScrewSpacing: 45,
  plateDiameter: 2.5,
  plateDepth: 3,
  plateInward: 37,
  plateSpacing: 32,
}
const validation = validateHingeTemplateDraft(draft)
console.log(`  błędy: ${validation.errors.length}, ostrzeżenia: ${validation.warnings.length}`)
if (validation.errors.length) fail(validation.errors[0])

const entry = buildHingeTemplateEntry('manual-hinge-test', draft)
const cup = entry.drillPattern.filter((h) => h.role === 'cup')
const cupScrews = entry.drillPattern.filter((h) => h.role === 'cupScrew')
const plate = entry.drillPattern.filter((h) => h.role === 'plate')
const plateAlong = plate.map((h) => h.along).sort((a, b) => (a ?? 0) - (b ?? 0))
const completeOk =
  entry.kind === 'hinge' &&
  cup.length === 1 &&
  cupScrews.length === 2 &&
  plate.length === 2 &&
  plate.every((h) => h.inward === 37) &&
  plateAlong[0] === -16 &&
  plateAlong[1] === 16
console.log(`  role: cup=${cup.length}, cupScrew=${cupScrews.length}, plate=${plate.length}`)
console.log(`  prowadnik along=[${plateAlong.join(', ')}], inward=${plate[0]?.inward}`)
if (!completeOk) fail('szablon powinien mieć puszkę, 2 mocowania puszki i 2 otwory prowadnika ±16')
else console.log('  OK ✅')

console.log('\n=== Kreator okuć — emisja na dwóch płytach ===')
saveUserCatalog([entry])
const front = mkPanel({ id: 'F', name: 'front' })
const side = mkPanel({ id: 'S', name: 'bok', transform: { position: [0, 0, 0], rotation: [0, -90, 0] } })
const hardware: Hardware = {
  id: 'hmanual',
  kind: 'hinge',
  hinge: {
    family: 'Ręczny CLIP top 110',
    openingAngle: 110,
    overlayClass: 'full',
    cup: { diameter: 35, distanceTB: 5, depth: 13, mounting: 'screw', screwPattern: [] },
    plate: { distance: 0, type: 'CLIP', screwPattern: [] },
    options: { blumotion: true, tipOn: false, servoDrive: false },
    doorPanel: 'F',
    sidePanel: 'S',
    placement: [{ fromEdge: 3, offset: 100 }],
    hingeId: entry.id,
  },
}
const { opsFront, opsSide } = emitHingeOps(hardware, front, side)
const plateOps = opsSide.filter((o) => o.id.startsWith('hmanual:plate'))
const frontOk = opsFront.some((o) => o.id === 'hmanual:cup:0') && opsFront.filter((o) => o.id.includes('cupscrew')).length === 2
const sideOk = plateOps.length === 2
const sideYs = plateOps.map((o) => o.hole!.y).sort((a, b) => a - b)
console.log(`  front ops=${opsFront.length}, side ops=${opsSide.length}, prowadnik y=[${sideYs.join(', ')}]`)
if (!frontOk || !sideOk || Math.abs(sideYs[1] - sideYs[0] - 32) > 1e-9) {
  fail('emiter powinien dostać nawierty na front i dwa oddzielne otwory prowadnika na bok')
} else console.log('  OK ✅')

console.log(`\n=== WERDYKT: ${ok ? 'OK ✅ — kreator okuć zapisuje poprawny szablon zawiasu' : 'BŁĄD ❌'} ===`)
process.exit(ok ? 0 : 1)

