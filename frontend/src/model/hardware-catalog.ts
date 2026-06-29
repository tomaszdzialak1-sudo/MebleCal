/**
 * Katalog okuć — centrum typów + dane wbudowane.
 *
 * BUILTIN_CATALOG: wbudowane wpisy (dane z blum-catalog.ts)
 * getUserCatalog / saveUserCatalog: localStorage, rozszerzalny przez użytkownika
 * getFullCatalog: builtin + user; user nadpisuje builtin po id
 *
 * KONWENCJA WSPÓŁRZĘDNYCH DrillHole
 * ────────────────────────────────────
 * x/y są surowymi osiami z FMC. Dla roli 'plate' FMC używa innego układu
 * niż emiter (X=rozstaw ±16, Y=0), dlatego DrillHole ma dodatkowe pola
 * `inward` i `along` wypełniane przez UI przy imporcie:
 *
 *   role='cup':      x=0,y=0 = środek puszki; emiter używa x/y bezpośrednio.
 *   role='cupScrew': x = inward od środka puszki (np. 9.5), y = along (±22.5);
 *                    FMC i emiter zgodne — bez dodatkowych pól.
 *   role='plate':    emiter czyta `inward` (od przedniej krawędzi boku, np. 37)
 *                    i `along` (offset od anchora zawiasu, np. ±16); fallback na
 *                    x/y gdy brak (BUILTIN_CATALOG). NIE zapisuj y FMC jako
 *                    pozycji absolutnej — da złe otwory.
 *
 * Dowód: `npm run test:hinge` (kat=fallback + Y=683 przy h=799mm + ścieżka inward/along).
 */

import {
  CUP_DIAMETER,
  CUP_DEPTH_DEFAULT,
  CUP_FIXING_SPACING,
  CUP_FIXING_OFFSET_FROM_CUP_CENTER,
  CUP_SCREW_DIAMETER,
  SCREW_PILOT_DEPTH,
  PLATE_HOLE_DIAMETER,
  PLATE_FRONT_OFFSET,
  PLATE_HOLE_SPACING,
} from './blum-catalog'

export type HoleRole =
  | 'cup' | 'cupScrew' | 'plate'          // hinge
  | 'camHole' | 'boltHole' | 'crossHole'  // cam
  | 'bodyScrew' | 'frontScrew'            // drawer
  | 'armMount'                            // lift
  | 'hole'                                // dowel/confirmat / placeholder

export interface DrillHole {
  x: number            // surowy FMC X
  y: number            // surowy FMC Y
  /** [plate] inward od przedniej krawędzi boku (np. 37 = system 32); fallback: x */
  inward?: number
  /** [plate] along offset od anchora zawiasu (np. ±16 = system 32); fallback: y */
  along?: number
  diameter: number
  pilotDiameter?: number  // nawiert CNC z FMC (otwór pilotowy w tej samej pozycji)
  depth: number
  group: number           // GRP z FMC
  feedRate?: number       // F z FMC — zachowane pod Fazę 8
  role: HoleRole
  sourceFile?: string     // nazwa pliku źródłowego (File.name, bez ścieżki)
}

export interface HardwareEntry {
  id: string
  name: string
  manufacturer: string
  kind: 'hinge' | 'cam' | 'drawer' | 'confirmat' | 'dowel' | 'lift'
  drillPattern: DrillHole[]
  meta: Record<string, unknown>  // TB, FA, tabela szczelin — specyficzne per kind
}

export const ROLES_BY_KIND: Record<HardwareEntry['kind'], HoleRole[]> = {
  hinge:     ['cup', 'cupScrew', 'plate'],
  cam:       ['camHole', 'boltHole', 'crossHole'],
  drawer:    ['bodyScrew', 'frontScrew'],
  lift:      ['armMount'],
  confirmat: ['hole'],
  dowel:     ['hole'],
}

export const HOLE_ROLE_LABEL: Record<HoleRole, string> = {
  cup:        'Puszka zawiasu',
  cupScrew:   'Wkręt puszki',
  plate:      'Prowadnik',
  camHole:    'Puszka cam',
  boltHole:   'Trzpień cam',
  crossHole:  'Otwór dojściowy',
  bodyScrew:  'Wkręt korpusu',
  frontScrew: 'Wkręt frontu',
  armMount:   'Uchwyt ramienia',
  hole:       'Nawiert ogólny',
}

// ---------------------------------------------------------------------------
// BUILTIN_CATALOG — dane z blum-catalog.ts (stałe, nie kasować źródła).
// Jeden wpis = kompletne okucie: puszka + mocowanie + prowadnik.
// ---------------------------------------------------------------------------

const BUILTIN_CATALOG: HardwareEntry[] = [
  {
    id: 'blum-clip-top-blumotion-110',
    name: 'Blum CLIP top BLUMOTION 110° + prowadnik 0 mm',
    manufacturer: 'Blum',
    kind: 'hinge',
    drillPattern: [
      {
        x: 0,
        y: 0,
        diameter: CUP_DIAMETER,
        depth: CUP_DEPTH_DEFAULT,
        group: 1,
        role: 'cup',
      },
      {
        x: CUP_FIXING_OFFSET_FROM_CUP_CENTER,
        y: -CUP_FIXING_SPACING / 2,
        diameter: CUP_SCREW_DIAMETER,
        depth: SCREW_PILOT_DEPTH,
        group: 1,
        role: 'cupScrew',
      },
      {
        x: CUP_FIXING_OFFSET_FROM_CUP_CENTER,
        y: CUP_FIXING_SPACING / 2,
        diameter: CUP_SCREW_DIAMETER,
        depth: SCREW_PILOT_DEPTH,
        group: 1,
        role: 'cupScrew',
      },
      {
        x: PLATE_FRONT_OFFSET,
        y: -PLATE_HOLE_SPACING / 2,
        inward: PLATE_FRONT_OFFSET,
        along: -PLATE_HOLE_SPACING / 2,
        diameter: PLATE_HOLE_DIAMETER,
        depth: SCREW_PILOT_DEPTH,
        group: 2,
        role: 'plate',
      },
      {
        x: PLATE_FRONT_OFFSET,
        y: PLATE_HOLE_SPACING / 2,
        inward: PLATE_FRONT_OFFSET,
        along: PLATE_HOLE_SPACING / 2,
        diameter: PLATE_HOLE_DIAMETER,
        depth: SCREW_PILOT_DEPTH,
        group: 2,
        role: 'plate',
      },
    ],
    meta: {
      source: 'builtin',
      openingAngle: 110,
      overlayClass: 'full',
      TB_default: 5,
      plateDistance: 0,
      cupDiameter: CUP_DIAMETER,
      fixingSpacing: CUP_FIXING_SPACING,
      fixingOffset: CUP_FIXING_OFFSET_FROM_CUP_CENTER,
      plateInward: PLATE_FRONT_OFFSET,
      plateSpacing: PLATE_HOLE_SPACING,
      plateSystem: 32,
    },
  },
]

// ---------------------------------------------------------------------------
// localStorage API
// ---------------------------------------------------------------------------

const LS_KEY = 'meblecad-hardware-catalog'

export function getUserCatalog(): HardwareEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as HardwareEntry[]
  } catch {
    return []
  }
}

export function saveUserCatalog(entries: HardwareEntry[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(entries))
}

/** builtin + user; user nadpisuje builtin po id */
export function getFullCatalog(): HardwareEntry[] {
  const map = new Map<string, HardwareEntry>()
  for (const e of BUILTIN_CATALOG) map.set(e.id, e)
  for (const e of getUserCatalog()) map.set(e.id, e)
  return Array.from(map.values())
}
