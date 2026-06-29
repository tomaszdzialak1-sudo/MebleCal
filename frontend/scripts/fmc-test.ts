/**
 * Sanity FMC: parser + katalog okuć.
 * Uruchom: npm run test:fmc
 */
import * as fs from 'fs'
import * as path from 'path'
import { parseFMC } from '../src/model/importers/fmc'
import { getFullCatalog, saveUserCatalog, type HardwareEntry } from '../src/model/hardware-catalog'
import { parseHardwareFile } from '../src/model/importers'

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')

async function main(): Promise<boolean> {
  let allOk = true
  const fail = (msg: string) => { console.log(`  BŁĄD ❌ ${msg}`); allOk = false }

  // --- Test 1: hinge-cup.fmc → 3 nawierty -----------------------------------
  console.log('\n=== Test 1: parseFMC — hinge-cup.fmc ===')
  const cup = parseFMC(fixture('hinge-cup.fmc'))
  cup.forEach((h, i) => console.log(`  [${i}] Ø${h.diameter}, głęb=${h.depth}, X=${h.x}, Y=${h.y}, GRP=${h.group}`))

  if (cup.length !== 3) fail(`oczekiwano 3 nawiertów, jest ${cup.length}`)
  else {
    if (!(cup[0].diameter === 35 && cup[0].depth === 13 && cup[0].x === 0 && cup[0].y === 0))
      fail(`puszka: oczekiwano Ø35/13 @ (0,0), jest Ø${cup[0].diameter}/${cup[0].depth} @ (${cup[0].x},${cup[0].y})`)
    if (!(cup[1].diameter === 2.5 && cup[1].depth === 3 && cup[1].x === 9.5 && cup[1].y === 22.5))
      fail(`wkręt 1: oczekiwano Ø2.5/3 @ (9.5,22.5)`)
    if (!(cup[2].diameter === 2.5 && cup[2].depth === 3 && cup[2].x === 9.5 && cup[2].y === -22.5))
      fail(`wkręt 2: oczekiwano Ø2.5/3 @ (9.5,-22.5)`)
    // wkręty Ø2.5 w innych pozycjach → NIE mergowane jako pilot
    if (cup[0].pilotDiameter !== undefined)
      fail(`puszka nie powinna mieć pilotDiameter (wkręty są w innych pozycjach)`)
    console.log('  OK ✅')
  }

  // --- Test 2: plate.fmc → 2 nawierty --------------------------------------
  console.log('\n=== Test 2: parseFMC — plate.fmc ===')
  const plate = parseFMC(fixture('plate.fmc'))
  plate.forEach((h, i) => console.log(`  [${i}] Ø${h.diameter}, głęb=${h.depth}, X=${h.x}, Y=${h.y}`))

  if (plate.length !== 2) fail(`oczekiwano 2 nawiertów, jest ${plate.length}`)
  else {
    const xSet = new Set(plate.map(h => h.x))
    const allOk5 = plate.every(h => h.diameter === 5 && h.depth === 11.5 && h.y === 0)
    const hasPos16 = xSet.has(16) && xSet.has(-16)
    if (!allOk5) fail('oczekiwano Ø5/11.5 przy Y=0')
    if (!hasPos16) fail('oczekiwano X=±16')
    if (allOk5 && hasPos16) console.log('  OK ✅')
  }

  // --- Test 3: pilot mergowany przy tej samej pozycji ----------------------
  console.log('\n=== Test 3: pilot w tej samej pozycji → pilotDiameter ===')
  const pilotContent = `[VBDMES01]
X=0
Y=0
DM=35
TI=13
GRP=1

[VBDMES01]
X=0
Y=0
DM=3
TI=5
GRP=1`
  const pilotResult = parseFMC(pilotContent)
  console.log(`  nawierty: ${pilotResult.length}, pilotDiameter=${pilotResult[0]?.pilotDiameter}`)
  if (!(pilotResult.length === 1 && pilotResult[0].diameter === 35 && pilotResult[0].pilotDiameter === 3))
    fail('pilot przy tej samej pozycji powinien być mergowany jako pilotDiameter')
  else console.log('  OK ✅')

  // --- Test 4: getFullCatalog = builtin + user nadpisuje po id --------------
  console.log('\n=== Test 4: getFullCatalog = builtin + user (override) ===')
  const builtin = getFullCatalog()
  const builtinCount = builtin.length
  console.log(`  wbudowane wpisy: ${builtinCount} (oczekiwano ≥1)`)
  if (builtinCount < 1) fail('oczekiwano co najmniej 1 wpisu wbudowanego')

  const override: HardwareEntry = {
    id: builtin[0].id,
    name: 'Nadpisany',
    manufacturer: 'Test',
    kind: 'hinge',
    drillPattern: [],
    meta: {},
  }
  saveUserCatalog([override])
  const after = getFullCatalog()
  const overrideName = after.find(e => e.id === override.id)?.name
  console.log(`  po nadpisaniu: ${after.length} wpisów, ${override.id}.name="${overrideName}"`)

  if (after.length !== builtinCount)
    fail(`liczba wpisów powinna być ${builtinCount}, jest ${after.length}`)
  if (overrideName !== 'Nadpisany')
    fail(`oczekiwano name="Nadpisany", jest "${overrideName}"`)

  // user dodaje NOWY wpis (nie nadpisuje)
  saveUserCatalog([override, { ...override, id: 'custom-new' }])
  const afterNew = getFullCatalog()
  if (afterNew.length !== builtinCount + 1)
    fail(`po dodaniu nowego: oczekiwano ${builtinCount + 1}, jest ${afterNew.length}`)
  else console.log('  OK ✅')

  // --- Test 5: pusta treść → 0 nawiertów -----------------------------------
  console.log('\n=== Test 5: brak bloków VBDMES01 → 0 nawiertów ===')
  const empty = parseFMC('brak bloków, żadnych sekcji')
  console.log(`  nawierty: ${empty.length}`)
  if (empty.length !== 0) fail('oczekiwano 0 nawiertów dla pustej treści')
  else console.log('  OK ✅')

  // --- Test 6: parseHardwareFile — nieznane rozszerzenie → error -----------
  console.log('\n=== Test 6: parseHardwareFile — nieznane rozszerzenie → error ===')
  const mockBadFile = { name: 'schema.xml', text: async () => '' } as unknown as File
  let ext6ok = false
  try {
    await parseHardwareFile(mockBadFile)
    fail('powinien był rzucić błąd dla .xml')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    ext6ok = msg.includes('.xml')
    console.log(`  error: "${msg}"`)
    if (!ext6ok) fail('komunikat błędu powinien zawierać rozszerzenie .xml')
    else console.log('  OK ✅')
  }

  // --- Test 7: parseHardwareFile — sourceFile na każdym nawiercie ----------
  console.log('\n=== Test 7: parseHardwareFile — sourceFile ===')
  const mockFmcFile = {
    name: 'puszka-zawiasu.fmc',
    text: async () => fixture('hinge-cup.fmc'),
  } as unknown as File
  const withSource = await parseHardwareFile(mockFmcFile)
  console.log(`  nawierty: ${withSource.length}, sourceFile: ${[...new Set(withSource.map(h => h.sourceFile))].join(', ')}`)
  if (!withSource.every((h) => h.sourceFile === 'puszka-zawiasu.fmc'))
    fail('każdy nawiert powinien mieć sourceFile="puszka-zawiasu.fmc"')
  else console.log('  OK ✅')

  // --- Test 8: sortowanie malejące po DM (parseFMC nie sortuje, dispatcher tak) ---
  console.log('\n=== Test 8: sort malejący po DM — sklejone dwa pliki ===')
  const cup8 = await parseHardwareFile({
    name: 'cup.fmc',
    text: async () => fixture('hinge-cup.fmc'),
  } as unknown as File)
  const plate8 = await parseHardwareFile({
    name: 'plate.fmc',
    text: async () => fixture('plate.fmc'),
  } as unknown as File)
  const merged8 = [...cup8, ...plate8].sort((a, b) => b.diameter - a.diameter)
  console.log(`  kolejność Ø: ${merged8.map(h => h.diameter).join(', ')}`)
  const sortOk = merged8[0].diameter >= merged8[merged8.length - 1].diameter &&
    merged8.every((h, i) => i === 0 || merged8[i - 1].diameter >= h.diameter)
  if (!sortOk) fail('kolejność powinna być malejąca po DM')
  // plik 1 (cup.fmc) → Ø35 na górze; plik 2 (plate.fmc) → Ø5 na dole
  if (merged8[0].sourceFile !== 'cup.fmc') fail('Ø35 powinien mieć sourceFile="cup.fmc"')
  if (!merged8.filter(h => h.sourceFile === 'plate.fmc').every(h => h.diameter === 5))
    fail('nawierty z plate.fmc powinny mieć Ø5')
  if (sortOk) console.log('  OK ✅')

  return allOk
}

main()
  .then((ok) => {
    console.log(`\n=== WERDYKT: ${ok ? 'OK ✅ — wszystkie testy FMC przechodzą' : 'BŁĄD ❌ — patrz wyżej'} ===`)
    process.exit(ok ? 0 : 1)
  })
  .catch((e) => {
    console.error('Wyjątek:', e)
    process.exit(1)
  })
