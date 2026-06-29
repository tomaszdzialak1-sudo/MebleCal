import type { Hinge, OperationType, ProjectSettings } from './types'

// Domyślna warstwa DXF per typ operacji (eksport w Fazie 8 czyta to stąd).
export const DXF_LAYERS: Record<OperationType, string> = {
  hole: 'DRILL',
  groove: 'GROOVE',
  cutout: 'CUTOUT',
  pocket: 'POCKET',
}

// Domyślne ustawienia projektu. kerf/bandingAllowance to wartości startowe —
// dokładne standardy do potwierdzenia w Fazie 2.
export const DEFAULT_SETTINGS: ProjectSettings = {
  kerf: 3,
  bandingAllowance: 1,
  defaultBaseFace: 'front',
  bandingThickness: 1,
}

// Materiał korpusu: 18 mm (przyjęte). Arkusz standardowy 2800 x 2070.
export const DEFAULT_MATERIAL_THICKNESS = 18
export const DEFAULT_SHEET = { w: 2800, h: 2070 }

// Domyślny zawias na start (najpopularniejszy) — CLIP top BLUMOTION.
// Liczby z katalogu w `blum-catalog.ts` (TB, puszka 35, 45/9.5, system 32, wzór F).
// screwPattern poniżej = zapis poglądowy [wzdłuż, w głąb]; emisja liczy otwory
// z `blum-catalog` (jedno źródło prawdy), nie z tych pól.
export const DEFAULT_HINGE: Hinge = {
  family: 'CLIP top BLUMOTION',
  openingAngle: 110,
  overlayClass: 'full',
  cup: {
    diameter: 35,
    distanceTB: 5,
    depth: 13,
    mounting: 'screw',
    screwPattern: [
      [-22.5, 9.5],
      [22.5, 9.5],
    ],
  },
  plate: {
    distance: 0,
    type: 'CLIP',
    screwPattern: [
      [-16, 37],
      [16, 37],
    ],
  },
  options: { blumotion: true, tipOn: false, servoDrive: false },
  doorPanel: '',
  sidePanel: '',
  placement: [],
}

// Kolory startowe pomieszczenia.
export const ROOM_COLORS = {
  walls: '#dcd7c9',
  floor: '#b9b0a1',
  ceiling: '#f3f1ea',
}

// Grubości czysto wizualne pomieszczenia (Room nie ma rozkroju/wierceń).
export const ROOM_WALL_THICKNESS = 80
export const ROOM_SLAB_THICKNESS = 40
