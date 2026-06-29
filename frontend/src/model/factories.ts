import { nanoid } from 'nanoid'
import type {
  Cabinet,
  CabinetType,
  Connector,
  ConnectorType,
  Edge,
  Hardware,
  Material,
  Operation,
  OperationType,
  Panel,
  Project,
  Room,
  Vec2,
  Vec3,
} from './types'
import {
  DEFAULT_HINGE,
  DEFAULT_MATERIAL_THICKNESS,
  DEFAULT_SETTINGS,
  DEFAULT_SHEET,
  DXF_LAYERS,
  ROOM_COLORS,
} from './defaults'

export const newId = () => nanoid(8)

/** Prostokątny kontur W×H, CCW, (0,0) w lewym-dolnym rogu. */
export function rectContour(w: number, h: number): Vec2[] {
  return [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ]
}

/** Wymiary gabarytowe konturu (bounding box). */
export function contourSize(contour: Vec2[]): { w: number; h: number } {
  const xs = contour.map((p) => p[0])
  const ys = contour.map((p) => p[1])
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}

/** Geometryczny środek bryły płyty w układzie lokalnym: środek bbox konturu + połowa grubości. */
export function panelLocalCenter(panel: Panel): Vec3 {
  const xs = panel.contour.map((p) => p[0])
  const ys = panel.contour.map((p) => p[1])
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
    -panel.thickness / 2,
  ]
}

// --- Trapez: dolna i górna krawędź poziome; górę można zwęzić i przesunąć ----
export interface TrapezoidParams {
  bottomWidth: number // długość dolnej krawędzi (edge 0)
  topWidth: number // długość górnej krawędzi (edge 2)
  topOffset: number // przesunięcie X lewego górnego rogu względem lewego dolnego
  height: number // wysokość (Y)
}

/** Kontur trapezu, CCW, (0,0) w lewym-dolnym rogu. Prostokąt = przypadek szczególny. */
export function trapezoidContour(p: TrapezoidParams): Vec2[] {
  return [
    [0, 0],
    [p.bottomWidth, 0],
    [p.topOffset + p.topWidth, p.height],
    [p.topOffset, p.height],
  ]
}

/** Odczyt parametrów trapezu z 4-punktowego konturu (względem contour[0]). */
export function contourToTrapezoid(contour: Vec2[]): TrapezoidParams {
  const [ox, oy] = contour[0]
  return {
    bottomWidth: contour[1][0] - ox,
    height: contour[3][1] - oy,
    topOffset: contour[3][0] - ox,
    topWidth: contour[2][0] - contour[3][0],
  }
}

/** Czy 4-punktowy kontur jest prostokątem (góra niezwężona i niezsunięta). */
export function isRectangleContour(contour: Vec2[], eps = 0.01): boolean {
  if (contour.length !== 4) return false
  const t = contourToTrapezoid(contour)
  return Math.abs(t.topOffset) < eps && Math.abs(t.topWidth - t.bottomWidth) < eps
}

/** Dosztukuj/utnij tablicę krawędzi tak, by edges.length === n (zachowaj istniejące). */
export function syncEdges(edges: Edge[], n: number): Edge[] {
  if (edges.length === n) return edges
  const out = edges.slice(0, n)
  while (out.length < n) out.push({ cutAngle: 90 })
  return out
}

// --- Operacje (Faza 3) ------------------------------------------------------

/** Środek bounding-boxa konturu (do domyślnych pozycji operacji). */
export function contourCenter(contour: Vec2[]): Vec2 {
  const xs = contour.map((p) => p[0])
  const ys = contour.map((p) => p[1])
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}

/** Prostokątna ścieżka (CCW) — helper dla cutout/pocket. */
export function rectPath(x: number, y: number, w: number, h: number): Vec2[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
}

/** Prosty odcinek z parametrów (start, długość, oś) — helper dla frezu LED. */
export function segmentPath(start: Vec2, length: number, axis: 'x' | 'y'): Vec2[] {
  return axis === 'x'
    ? [start, [start[0] + length, start[1]]]
    : [start, [start[0], start[1] + length]]
}

/** Nowa operacja `manual` danego typu z sensownymi wartościami startowymi. */
export function createOperation(type: OperationType, contour: Vec2[]): Operation {
  const [cx, cy] = contourCenter(contour)
  const { w, h } = contourSize(contour)
  const minX = Math.min(...contour.map((p) => p[0]))
  const minY = Math.min(...contour.map((p) => p[1]))
  const inset = Math.min(50, w / 4, h / 4)

  const base = {
    id: newId(),
    type,
    face: 'front' as const,
    source: 'manual' as const,
    dxfLayer: DXF_LAYERS[type],
  }

  switch (type) {
    case 'hole':
      return { ...base, hole: { x: cx, y: cy, diameter: 8, depth: 12, through: false } }
    case 'groove':
      return {
        ...base,
        groove: { path: segmentPath([cx - w / 4, cy], w / 2, 'x'), width: 8, depth: 10 },
      }
    case 'cutout':
      return {
        ...base,
        cutout: { path: rectPath(minX + inset, minY + inset, w - 2 * inset, h - 2 * inset), depth: 18, through: true },
      }
    case 'pocket':
      return {
        ...base,
        pocket: { path: rectPath(cx - 100, cy - 50, 200, 100), depth: 10 },
      }
  }
}

/** Unikalna nazwa: jeśli `base` już jest w `existing`, dokłada sufiks „ (2)", „ (3)"… */
export function uniqueName(existing: string[], base: string): string {
  if (!existing.includes(base)) return base
  let k = 2
  while (existing.includes(`${base} (${k})`)) k++
  return `${base} (${k})`
}

// --- Łącznik (Faza 4) -------------------------------------------------------

/** Nowy łącznik. placement domyślnie do nadpisania (np. środek krawędzi B). */
export function createConnector(
  type: ConnectorType,
  panelA: string,
  panelB: string,
  placement: Partial<Connector['placement']> = {},
): Connector {
  return {
    id: newId(),
    type,
    panelA,
    panelB,
    placement: { fromEdge: 0, offset: 0, ...placement },
  }
}

// --- Okucie / zawias (Faza 5) -----------------------------------------------

/** Nowy zawias Blum (kopia DEFAULT_HINGE); placement uzupełnia store z geometrii. */
export function createHardware(doorPanel: string, sidePanel: string): Hardware {
  return {
    id: newId(),
    kind: 'hinge',
    hinge: {
      ...DEFAULT_HINGE,
      cup: { ...DEFAULT_HINGE.cup, screwPattern: DEFAULT_HINGE.cup.screwPattern.map((p) => [...p] as Vec2) },
      plate: { ...DEFAULT_HINGE.plate, screwPattern: DEFAULT_HINGE.plate.screwPattern.map((p) => [...p] as Vec2) },
      options: { ...DEFAULT_HINGE.options },
      doorPanel,
      sidePanel,
      placement: [],
    },
  }
}

/** Nowa szafka parametryczna z rozsądnymi domyślnymi. */
export function createCabinet(
  type: CabinetType,
  materialId: string,
  roomId: string,
  patch: Partial<Cabinet['params']> = {},
): Cabinet {
  return {
    id: newId(),
    name: type === 'base' ? 'szafka dolna' : type === 'wall' ? 'szafka wisząca' : 'szafka stojąca',
    type,
    params: {
      W: 600, H: type === 'base' ? 820 : 720, D: type === 'wall' ? 320 : 560,
      T: 18, backT: 4, doors: 1, shelves: 0,
      ...(type === 'base' ? { plinth: 100 } : {}),
      ...patch,
    },
    materialId,
    roomId,
    position: [0, 0, 0],
  }
}

export function createMaterial(patch: Partial<Material> = {}): Material {
  return {
    id: newId(),
    name: 'Płyta 18 mm',
    thickness: DEFAULT_MATERIAL_THICKNESS,
    hasGrain: true,
    sheet: { ...DEFAULT_SHEET },
    defaultBanding: 'ABS 1 mm',
    ...patch,
  }
}

export interface CreatePanelOpts {
  name?: string
  materialId: string
  roomId?: string
  width?: number
  height?: number
  thickness?: number
  position?: Vec3
  rotation?: Vec3
  baseFace?: 'front' | 'back'
}

export function createPanel(opts: CreatePanelOpts): Panel {
  const w = opts.width ?? 600
  const h = opts.height ?? 720
  const edge: Edge = { cutAngle: 90 }
  return {
    id: newId(),
    name: opts.name ?? 'nowa płyta',
    materialId: opts.materialId,
    roomId: opts.roomId ?? '',
    thickness: opts.thickness ?? DEFAULT_MATERIAL_THICKNESS,
    contour: rectContour(w, h),
    transform: {
      position: opts.position ?? [0, 0, 0],
      rotation: opts.rotation ?? [0, 0, 0],
    },
    edges: [{ ...edge }, { ...edge }, { ...edge }, { ...edge }],
    grain: { direction: 0 },
    baseFace: opts.baseFace ?? DEFAULT_SETTINGS.defaultBaseFace,
    operations: [],
  }
}

export interface BuildRoomOpts {
  w?: number
  d?: number
  h?: number
  id?: string
  name?: string
  colors?: { walls?: string; floor?: string; ceiling?: string }
}

/** Prostokątne pomieszczenie wyśrodkowane w (0,0); podłoga na z=0, sufit na z=h. */
export function buildRoom(opts: BuildRoomOpts = {}): Room {
  const w = opts.w ?? 4000
  const d = opts.d ?? 3000
  const h = opts.h ?? 2600
  const wc = opts.colors?.walls ?? ROOM_COLORS.walls
  return {
    id: opts.id ?? newId(),
    name: opts.name ?? 'Pomieszczenie',
    walls: [
      { id: newId(), size: [w, h] as Vec2, transform: { position: [0, d / 2, h / 2] as Vec3, rotation: [0, 0, 0] as Vec3 }, color: wc },
      { id: newId(), size: [w, h] as Vec2, transform: { position: [0, -d / 2, h / 2] as Vec3, rotation: [0, 0, 0] as Vec3 }, color: wc },
      { id: newId(), size: [d, h] as Vec2, transform: { position: [-w / 2, 0, h / 2] as Vec3, rotation: [0, 0, 90] as Vec3 }, color: wc },
      { id: newId(), size: [d, h] as Vec2, transform: { position: [w / 2, 0, h / 2] as Vec3, rotation: [0, 0, 90] as Vec3 }, color: wc },
    ],
    floor: { size: [w, d] as Vec2, color: opts.colors?.floor ?? ROOM_COLORS.floor },
    ceiling: { size: [w, d] as Vec2, color: opts.colors?.ceiling ?? ROOM_COLORS.ceiling },
  }
}

export function createRoom(): Room {
  return buildRoom()
}

/** Świeży projekt z materiałem 18 mm, pomieszczeniem i jedną startową płytą. */
export function createDefaultProject(): Project {
  const material = createMaterial()
  const room = createRoom()
  const panel = createPanel({
    name: 'bok lewy',
    materialId: material.id,
    roomId: room.id,
    width: 600,
    height: 720,
    thickness: 18,
    position: [-300, 0, 0],
    rotation: [90, 0, 0], // postaw pionowo (lico patrzy na −Y)
  })
  return {
    id: newId(),
    name: 'Nowy projekt',
    units: 'mm',
    settings: { ...DEFAULT_SETTINGS },
    materials: [material],
    panels: [panel],
    connectors: [],
    hardware: [],
    rooms: [room],
    cabinets: [],
  }
}
