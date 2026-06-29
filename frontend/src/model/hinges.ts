/**
 * Zawiasy Blum (CLIP top BLUMOTION) — emisja operacji na DWÓCH płytach.
 *
 * Wzorem łączników (connectors.ts): zawias = „przepis" → puszka + wkręty na
 * FRONCIE, prowadnik (system 32) na BOKU. Operacje mają source:{hardware:id} i
 * deterministyczne id (`${id}:cup|cupscrew|plate:k[:i]`) → podmiana w miejscu.
 *
 * Geometria boku WYPROWADZANA z 3D (jak deriveConnectorAnchor): liczymy świat
 * krawędzi zawiasowej frontu i rzutujemy na bok — bez pola sideEdge.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  OŚ OBROTU ZAWIASU (udokumentowana pod Fazę 7 — kolizje/łuk otwarcia/animacja)
 * ─────────────────────────────────────────────────────────────────────────────
 *  Oś obrotu frontu to PIONOWA LINIA wzdłuż ZAWIASOWEJ KRAWĘDZI frontu
 *  (`front.contour[fromEdge] → contour[fromEdge+1]`), w świecie zwracana jako
 *  `anchor.axisWorld` (dwa końce na licu 'front', Z=0). Rzeczywisty czop CLIP top
 *  leży blisko PRZEDNIEJ krawędzi boku, przesunięty do wnętrza korpusu o wielkość
 *  wynikającą z geometrii zawiasu (pochodna TB / nałożenia FA). W v1 NIE liczymy
 *  dokładnego offsetu czopa — Faza 7 doprecyzuje go z TB/FA; tutaj zapisujemy
 *  linię krawędzi zawiasowej, żeby nie trzeba jej było rekonstruować.
 */
import type { Hardware, Operation, OperationFace, Panel, Vec2, Vec3 } from './types'
import { getFullCatalog, type DrillHole } from './hardware-catalog'
import { DXF_LAYERS } from './defaults'
import { edgeFrame } from './geometry'
import { localToWorld, worldToLocal } from './transform'
import {
  CUP_DIAMETER,
  cupCenterDistance,
  cupMountHoles,
  gapF,
  overlay,
  plateHoles,
  SCREW_PILOT_DEPTH,
  type AuxHole,
} from './blum-catalog'

const TOUCH_TOL = 2.0 // mm — tolerancja „puszka na licu boku"

/** Punkt 2D na licu: a + along·(wzdłuż krawędzi) + inward·(w głąb lica). */
function onEdge2D(contour: Vec2[], edge: number, along: number, inward: number): Vec2 {
  const ef = edgeFrame(contour, edge)
  return [
    ef.a[0] + ef.along[0] * along + ef.inward[0] * inward,
    ef.a[1] + ef.along[1] * along + ef.inward[1] * inward,
  ]
}

/** Rzut punktu 2D na krawędź: odległość wzdłuż (od a) + odległość prostopadła. */
function projectOntoEdge(contour: Vec2[], edge: number, p: Vec2): { along: number; dist: number } {
  const ef = edgeFrame(contour, edge)
  const dx = p[0] - ef.a[0]
  const dy = p[1] - ef.a[1]
  const along = dx * ef.along[0] + dy * ef.along[1]
  const perp = dx * ef.inward[0] + dy * ef.inward[1]
  return { along, dist: Math.abs(perp) }
}

export interface HingeAnchor {
  cup: Vec2 // środek puszki w licu frontu (face 'back')
  sideEdge: number // wyprowadzona przednia krawędź boku
  height: number // wysokość zawiasu wzdłuż krawędzi boku
  plateFace: 'front' | 'back' // wewnętrzne lico boku, na którym siedzi prowadnik
  gap: number // odległość krawędzi zawiasowej frontu od lica boku (0 = styk)
  touching: boolean
  axisWorld: [Vec3, Vec3] // oś obrotu (krawędź zawiasowa frontu) w świecie
}

/** Wyprowadź geometrię jednego zawiasu (front: puszka, bok: prowadnik) z 3D. */
export function deriveHingeAnchor(
  front: Panel,
  side: Panel,
  fromEdge: number,
  offset: number,
  tb: number,
  cupDiameter = CUP_DIAMETER,
): HingeAnchor {
  // TB/B z katalogu = od krawędzi drzwi do KRAWĘDZI puszki Ø35, więc środek C
  // leży o promień puszki dalej: C = TB + Ø/2.
  const cup = onEdge2D(front.contour, fromEdge, offset, cupCenterDistance(tb, cupDiameter))
  const hingeEdge = onEdge2D(front.contour, fromEdge, offset, 0)
  const hingeEdgeWorld = localToWorld(front.transform, [hingeEdge[0], hingeEdge[1], -front.thickness])

  // Rzutujemy krawędź zawiasową, bo środek puszki jest w drzwiach, a nie na boku.
  const inS = worldToLocal(side.transform, hingeEdgeWorld)
  const p2d: Vec2 = [inS[0], inS[1]]

  // przednia krawędź boku = krawędź najbliższa rzutowi puszki
  let sideEdge = 0
  let best = Infinity
  let height = 0
  for (let e = 0; e < side.contour.length; e++) {
    const pr = projectOntoEdge(side.contour, e, p2d)
    if (pr.dist < best) {
      best = pr.dist
      sideEdge = e
      height = pr.along
    }
  }

  const dFront = Math.abs(inS[2])
  const dBack = Math.abs(inS[2] + side.thickness)
  const nearFace: 'front' | 'back' = dFront <= dBack ? 'front' : 'back'
  const plateFace: 'front' | 'back' = nearFace === 'front' ? 'back' : 'front'
  const gap = Math.min(dFront, dBack)

  const ef = edgeFrame(front.contour, fromEdge)
  const axisWorld: [Vec3, Vec3] = [
    localToWorld(front.transform, [ef.a[0], ef.a[1], 0]),
    localToWorld(front.transform, [ef.b[0], ef.b[1], 0]),
  ]

  return { cup, sideEdge, height, plateFace, gap, touching: gap <= TOUCH_TOL, axisWorld }
}

/**
 * Zwraca hole z katalogu pogrupowane wg roli, lub null gdy brak wpisu / brak hingeId.
 * Emiter wywołuje per-rola fallback gdy brakuje danej roli w katalogu.
 */
function resolveCatalog(hingeId: string | undefined): {
  cup: DrillHole | null
  cupScrews: DrillHole[]
  plate: DrillHole[]
} | null {
  if (!hingeId) return null
  const entry = getFullCatalog().find((e) => e.id === hingeId && e.kind === 'hinge')
  if (!entry) return null
  return {
    cup: entry.drillPattern.find((h) => h.role === 'cup') ?? null,
    cupScrews: entry.drillPattern.filter((h) => h.role === 'cupScrew'),
    plate: entry.drillPattern.filter((h) => h.role === 'plate'),
  }
}

function holeOp(
  id: string,
  hardwareId: string,
  face: OperationFace,
  x: number,
  y: number,
  diameter: number,
  depth: number,
): Operation {
  return {
    id,
    type: 'hole',
    face,
    source: { hardware: hardwareId },
    dxfLayer: DXF_LAYERS.hole,
    hole: { x, y, diameter, depth, through: false },
  }
}

/**
 * Operacje zawiasu na obu płytach. Per pozycja w `hinge.placement` (rozkład):
 *  FRONT (lico 'back'): puszka Ø35 + wkręty/kołki montażowe,
 *  BOK (lico wewn.):   2 otwory prowadnika (system 32).
 */
export function emitHingeOps(
  hardware: Hardware,
  front: Panel,
  side: Panel,
): { opsFront: Operation[]; opsSide: Operation[] } {
  const opsFront: Operation[] = []
  const opsSide: Operation[] = []
  const hinge = hardware.hinge
  if (!hinge) return { opsFront, opsSide }

  const hid = hardware.id
  const tb = hinge.cup.distanceTB
  const cat = resolveCatalog(hinge.hingeId)

  // Ø i głębokość puszki: z katalogu gdy hingeId ustawiony, else z modelu.
  const cupDiameter = cat?.cup?.diameter ?? hinge.cup.diameter
  const cupDepth = cat?.cup?.depth ?? hinge.cup.depth

  hinge.placement.forEach((place, k) => {
    const a = deriveHingeAnchor(front, side, place.fromEdge, place.offset, tb, cupDiameter)

    // puszka na froncie (lico 'back')
    opsFront.push(holeOp(`${hid}:cup:${k}`, hid, 'back', a.cup[0], a.cup[1], cupDiameter, cupDepth))

    // wkręty/kołki puszki
    const ef = edgeFrame(front.contour, place.fromEdge)
    if (cat?.cupScrews.length) {
      // katalog: DrillHole.x = inward od środka puszki, DrillHole.y = along krawędzi od środka puszki
      // — offsety dodawane bezpośrednio, bez przeliczania
      cat.cupScrews.forEach((h, i) => {
        const x = a.cup[0] + ef.along[0] * h.y + ef.inward[0] * h.x
        const y = a.cup[1] + ef.along[1] * h.y + ef.inward[1] * h.x
        opsFront.push(holeOp(`${hid}:cupscrew:${k}:${i}`, hid, 'back', x, y, h.diameter, h.depth))
      })
    } else {
      // fallback: stałe z blum-catalog.ts
      cupMountHoles(hinge.cup.mounting).forEach((h: AuxHole, i) => {
        const x = a.cup[0] + ef.along[0] * h.along + ef.inward[0] * h.inward
        const y = a.cup[1] + ef.along[1] * h.along + ef.inward[1] * h.inward
        opsFront.push(holeOp(`${hid}:cupscrew:${k}:${i}`, hid, 'back', x, y, h.diameter, SCREW_PILOT_DEPTH))
      })
    }

    // prowadnik na boku
    if (cat?.plate.length) {
      // role='plate': preferuj h.inward/h.along (ustawiane przez importer UI),
      // fallback na h.x/h.y dla wpisów bez tych pól (BUILTIN_CATALOG).
      cat.plate.forEach((h, i) => {
        const inwardFromFrontEdge = h.inward ?? h.x
        const alongOffsetFromAnchor = h.along ?? h.y
        const [x, y] = onEdge2D(side.contour, a.sideEdge, a.height + alongOffsetFromAnchor, inwardFromFrontEdge)
        opsSide.push(holeOp(`${hid}:plate:${k}:${i}`, hid, a.plateFace, x, y, h.diameter, h.depth))
      })
    } else {
      // fallback: stałe z blum-catalog.ts
      plateHoles().forEach((h: AuxHole, i) => {
        const [x, y] = onEdge2D(side.contour, a.sideEdge, a.height + h.along, h.inward)
        opsSide.push(holeOp(`${hid}:plate:${k}:${i}`, hid, a.plateFace, x, y, h.diameter, SCREW_PILOT_DEPTH))
      })
    }
  })

  return { opsFront, opsSide }
}

/** Domyślna krawędź zawiasowa frontu = krawędź najbliższa bokowi (środek boku). */
export function pickHingeEdge(front: Panel, side: Panel): number {
  const sc = side.contour
  const cx = sc.reduce((s, p) => s + p[0], 0) / sc.length
  const cy = sc.reduce((s, p) => s + p[1], 0) / sc.length
  const sideCenterWorld = localToWorld(side.transform, [cx, cy, -side.thickness / 2])

  let bestEdge = 0
  let best = Infinity
  for (let e = 0; e < front.contour.length; e++) {
    const ef = edgeFrame(front.contour, e)
    const mid: Vec3 = [(ef.a[0] + ef.b[0]) / 2, (ef.a[1] + ef.b[1]) / 2, 0]
    const w = localToWorld(front.transform, mid)
    const d = Math.hypot(w[0] - sideCenterWorld[0], w[1] - sideCenterWorld[1], w[2] - sideCenterWorld[2])
    if (d < best) {
      best = d
      bestEdge = e
    }
  }
  return bestEdge
}

export interface FrontSizeResult {
  width: number
  height: number
  overlay: number
  gap: number | null
  gapNote?: string
}

/**
 * Sugerowany wymiar frontu z wnęki (full overlay): front = wnęka + 2·nałożenie
 * na każdej osi. Szczelina F z tabeli (informacyjnie). Tylko PODPOWIEDŹ.
 */
export function computeFrontSize(
  opening: { w: number; h: number },
  tb: number,
  plateDistance: number,
  frontThickness: number,
): FrontSizeResult {
  const fa = overlay(tb, plateDistance)
  const g = gapF(tb, frontThickness)
  return {
    width: opening.w + 2 * fa,
    height: opening.h + 2 * fa,
    overlay: fa,
    gap: g.value,
    gapNote: g.note,
  }
}

/** Sanity (DEV): zawias emituje puszkę Ø35 (lico back) + 2 wkręty na froncie i 2 otwory na boku. */
export function sanityHingeEmit(): { ok: boolean; detail: string } {
  const mk = (o: Partial<Panel>): Panel => ({
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
    ...o,
  })
  const front = mk({ id: 'F' })
  const side = mk({ id: 'S', transform: { position: [0, 0, 0], rotation: [0, -90, 0] } })
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
  const { opsFront, opsSide } = emitHingeOps(hardware, front, side)
  const cup = opsFront.find((o) => o.id === 'h:cup:0')
  const cupH = cup?.hole
  const screwHoles = opsFront.filter((o) => o.id.startsWith('h:cupscrew'))
  const plateOps = opsSide.filter((o) => o.id.startsWith('h:plate'))
  const ok =
    !!cup &&
    cupH?.diameter === 35 &&
    cupH.x === 22.5 &&
    cup.face === 'back' &&
    screwHoles.length === 2 &&
    screwHoles.every((o) => o.hole?.x === 32) &&
    plateOps.every((o) => o.hole?.diameter === 5) &&
    plateOps.every((o) => o.face === 'back') &&
    opsSide.length === 2
  return {
    ok,
    detail: `front: ${opsFront.length} ops (puszka Ø${cupH?.diameter} C=${cupH?.x} ${cup?.face}), bok: ${opsSide.length} ops`,
  }
}
