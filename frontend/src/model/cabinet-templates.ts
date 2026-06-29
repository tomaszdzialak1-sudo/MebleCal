/**
 * Faza 7.3 — generatory szafek (pure, zero zależności od store/UI).
 *
 * generateCabinet(params) → { panels, connectors, hardware }
 * Zwrócone elementy to zwykłe płyty/łączniki/okucia — wstawiamy je
 * store.insertCabinet(), które regeneruje operacje jak przy normalnym dodaniu.
 *
 * Transformy paneli (układ Z-up, rotacja Euler XYZ w stopniach):
 *   bok lewy:   rot [0, 90, 90]  → world = (lz, lx, ly) + pos, lico faces +X
 *                 pos = [px+T, py, pz], outer face X=px, inner face X=px+T
 *   bok prawy:  rot [0, 90, 90]  → world = (lz, lx, ly) + pos, lico faces +X (outward)
 *                 pos = [px+W, py, pz], inner face X=px+W-T, outer face X=px+W
 *   poziome:    rot [0, 0, 0]    → world = local + pos, lico faces +Z (góra)
 *   plecy/drzwi:rot [90, 0, 0]  → world = (lx, -lz, ly) + pos, lico faces -Y
 *
 * UWAGA: [0,-90,90] daje wz=-ly (panel odwrócony Z:-H→0) — NIE używać dla boku prawego.
 */
import type { Cabinet, Connector, Hardware, Panel, Vec3 } from './types'
import { contourSize, createConnector, createHardware, newId, rectContour } from './factories'
import { bestEdgeContact } from './connectors'
import { edgeFrame } from './geometry'
import { pickHingeEdge } from './hinges'
import { hingeCount, hingePositions, overlay, TB_DEFAULT } from './blum-catalog'
import { DEFAULT_SETTINGS } from './defaults'

const DOOR_GAP   = 1   // mm — lico drzwi przed licem boków
const RAIL_DEPTH = 80  // mm — głębokość listewki w szafce dolnej
const PLINTH_SETBACK = 50 // mm — odsunięcie cokołu od frontu

// ─── typy publiczne ──────────────────────────────────────────────────────────

export type CabinetTemplateType = 'standing' | 'wall' | 'base'

export interface CabinetParams {
  type:       CabinetTemplateType
  W:          number   // szerokość zewnętrzna
  H:          number   // wysokość zewnętrzna
  D:          number   // głębokość zewnętrzna
  T:          number   // grubość płyty (domyślnie z materiału)
  backT:      number   // grubość pleców HDF (domyślnie 4)
  materialId: string
  roomId:     string
  doors:      0 | 1 | 2
  shelves:    number
  plinth?:    number   // szafka dolna: wysokość cokołu (domyślnie 100)
  pos?:       Vec3     // pozycja w świecie (domyślnie [0,0,0])
  cabinetId?: string   // jeśli podane → ID paneli: `${cabinetId}:panel:${slot}`
}

export interface CabinetResult {
  panels:     Panel[]
  connectors: Connector[]
  hardware:   Hardware[]
}

// ─── helpery wewnętrzne ──────────────────────────────────────────────────────

/**
 * Pozycje kołków wzdłuż złącza. Margines od końców = 80mm;
 * maksymalne rozstawienie ~192mm. Minimum: 1 kołek na środku.
 */
function dowelOffsets(len: number, margin = 80, maxSpacing = 192): number[] {
  if (len <= 2 * margin) return [Math.round(len / 2)]
  const usable = len - 2 * margin
  const n = Math.max(2, Math.round(usable / maxSpacing) + 1)
  const step = usable / (n - 1)
  return Array.from({ length: n }, (_, i) => Math.round(margin + i * step))
}

function mkPanel(
  name: string,
  materialId: string,
  roomId: string,
  thickness: number,
  cw: number,
  ch: number,
  rotation: Vec3,
  position: Vec3,
  groupId: string,
  fixedId?: string,
  cabinetId?: string,
): Panel {
  return {
    id: fixedId ?? newId(),
    name,
    materialId,
    roomId,
    thickness,
    contour: rectContour(cw, ch),
    transform: { position, rotation },
    edges: [{ cutAngle: 90 }, { cutAngle: 90 }, { cutAngle: 90 }, { cutAngle: 90 }],
    grain: { direction: 0 },
    baseFace: DEFAULT_SETTINGS.defaultBaseFace,
    operations: [],
    groupId,
    cabinetId,
  }
}

/**
 * Łączniki kołkowe dla jednego złącza (facePanel = lico, edgePanel = czoło).
 * Używa bestEdgeContact zamiast detectRoles — role są znane z geometrii szablonu.
 */
function makeJoint(facePanel: Panel, edgePanel: Panel, groupId: string): Connector[] {
  const fit = bestEdgeContact(facePanel, edgePanel)
  const edgeLen = edgeFrame(edgePanel.contour, fit.fromEdge).length
  return dowelOffsets(edgeLen).map((offset) => ({
    ...createConnector('dowel', facePanel.id, edgePanel.id, {
      fromEdge: fit.fromEdge,
      offset,
    }),
    groupId,
  }))
}

function makeHinge(door: Panel, side: Panel, groupId: string): Hardware {
  const hw = createHardware(door.id, side.id)
  if (hw.hinge) {
    const fromEdge = pickHingeEdge(door, side)
    const height   = edgeFrame(door.contour, fromEdge).length
    const count    = hingeCount(height)
    hw.hinge.placement = hingePositions(height, count).map((offset) => ({ fromEdge, offset }))
  }
  return { ...hw, groupId }
}

/**
 * Front(y) — nakładane, full overlay.
 * openingPos = [wewnętrzny_lewy_x, front_y, wewnętrzny_dolny_z]
 */
function makeDoors(
  mat: { materialId: string; roomId: string; T: number },
  doors: 0 | 1 | 2,
  openingW: number,
  openingH: number,
  openingPos: Vec3,
  groupId: string,
  cabinetId?: string,
): Panel[] {
  if (doors === 0) return []
  const [ox, oy, oz] = openingPos
  const FA    = overlay(TB_DEFAULT, 0)
  const doorH = openingH + 2 * FA
  const dx    = ox - FA
  // rot [90,0,0]: wy = -lz + py; tylna ściana drzwi (lz=-T) wypada na Y = py+T.
  // Chcemy ty = py+T = -(DOOR_GAP), więc py = -(T + DOOR_GAP).
  const dy    = oy - DOOR_GAP - mat.T
  const dz    = oz - FA

  if (doors === 1) {
    return [
      mkPanel('front', mat.materialId, mat.roomId, mat.T,
        openingW + 2 * FA, doorH,
        [90, 0, 0],
        [dx, dy, dz],
        groupId,
        cabinetId ? `${cabinetId}:panel:front` : undefined,
        cabinetId),
    ]
  }

  const dw = Math.round((openingW + 2 * FA) / 2)
  return [
    mkPanel('front lewy', mat.materialId, mat.roomId, mat.T,
      dw, doorH, [90, 0, 0], [dx, dy, dz], groupId,
      cabinetId ? `${cabinetId}:panel:front-lewy` : undefined, cabinetId),
    mkPanel('front prawy', mat.materialId, mat.roomId, mat.T,
      dw, doorH, [90, 0, 0], [dx + dw, dy, dz], groupId,
      cabinetId ? `${cabinetId}:panel:front-prawy` : undefined, cabinetId),
  ]
}

// ─── szablony ────────────────────────────────────────────────────────────────

function standingOrWallCabinet(p: Required<CabinetParams>): CabinetResult {
  const { W, H, D, T, backT, materialId, roomId, doors, shelves, cabinetId } = p
  const [px, py, pz] = p.pos
  const gid    = newId()
  const cid    = cabinetId
  // Poziome płyty zatrzymują się przed plekami — brak nakładania.
  const innerD = D - backT

  const pid = (slot: string) => cid ? `${cid}:panel:${slot}` : undefined

  const bokLewy  = mkPanel('bok lewy',       materialId, roomId, T,
    D, H, [0, 90, 90], [px + T, py, pz], gid, pid('bok-lewy'), cid)
  const bokPrawy = mkPanel('bok prawy',      materialId, roomId, T,
    D, H, [0, 90, 90], [px + W, py, pz], gid, pid('bok-prawy'), cid)
  const gora     = mkPanel('wieniec górny',  materialId, roomId, T,
    W - 2 * T, innerD, [0, 0, 0], [px + T, py, pz + H],     gid, pid('wieniec'), cid)
  const dol      = mkPanel('dół',            materialId, roomId, T,
    W - 2 * T, innerD, [0, 0, 0], [px + T, py, pz + T],     gid, pid('dno'), cid)
  const plecy    = mkPanel('plecy',          materialId, roomId, backT,
    W - 2 * T, H - T, [90, 0, 0], [px + T, py + D - backT, pz], gid, pid('plecy'), cid)

  const panels: Panel[] = [bokLewy, bokPrawy, gora, dol, plecy]

  const shelfPanels: Panel[] = []
  for (let k = 1; k <= shelves; k++) {
    const z = pz + T + (k * (H - 2 * T)) / (shelves + 1)
    shelfPanels.push(mkPanel(`półka ${k}`, materialId, roomId, T,
      W - 2 * T, innerD, [0, 0, 0], [px + T, py, z], gid, pid(`polka-${k}`), cid))
  }
  panels.push(...shelfPanels)

  const frontPanels = makeDoors(
    { materialId, roomId, T }, doors,
    W - 2 * T, H - 2 * T,
    [px + T, py, pz + T],
    gid, cid,
  )
  panels.push(...frontPanels)

  const connectors: Connector[] = []
  for (const h of [gora, dol, ...shelfPanels]) {
    connectors.push(...makeJoint(bokLewy,  h, gid))
    connectors.push(...makeJoint(bokPrawy, h, gid))
  }

  const hardware: Hardware[] = []
  if (doors === 1 && frontPanels[0]) {
    hardware.push(makeHinge(frontPanels[0], bokLewy, gid))
  } else if (doors === 2) {
    if (frontPanels[0]) hardware.push(makeHinge(frontPanels[0], bokLewy,  gid))
    if (frontPanels[1]) hardware.push(makeHinge(frontPanels[1], bokPrawy, gid))
  }

  return { panels, connectors, hardware }
}

function baseCabinet(p: Required<CabinetParams>): CabinetResult {
  const { W, H, D, T, backT, materialId, roomId, doors, shelves, plinth, cabinetId } = p
  const [px, py, pz] = p.pos
  const plinthH = plinth
  const boxH    = H - plinthH
  const gid     = newId()
  const cid     = cabinetId
  const innerD  = D - backT

  const pid = (slot: string) => cid ? `${cid}:panel:${slot}` : undefined

  const bokLewy  = mkPanel('bok lewy',  materialId, roomId, T,
    D, boxH, [0, 90, 90], [px + T, py, pz + plinthH], gid, pid('bok-lewy'), cid)
  const bokPrawy = mkPanel('bok prawy', materialId, roomId, T,
    D, boxH, [0, 90, 90], [px + W, py, pz + plinthH], gid, pid('bok-prawy'), cid)
  const dol      = mkPanel('dół',       materialId, roomId, T,
    W - 2 * T, innerD, [0, 0, 0], [px + T, py, pz + plinthH + T], gid, pid('dno'), cid)
  const plecy    = mkPanel('plecy',     materialId, roomId, backT,
    W - 2 * T, boxH - T, [90, 0, 0],
    [px + T, py + D - backT, pz + plinthH], gid, pid('plecy'), cid)

  const listewkaPrzednia = mkPanel('listewka przednia', materialId, roomId, T,
    W - 2 * T, RAIL_DEPTH, [0, 0, 0], [px + T, py, pz + H], gid, pid('listewka-przednia'), cid)
  const listewkaTylna    = mkPanel('listewka tylna',    materialId, roomId, T,
    W - 2 * T, RAIL_DEPTH, [0, 0, 0], [px + T, py + innerD - RAIL_DEPTH, pz + H], gid, pid('listewka-tylna'), cid)

  const cokol = mkPanel('cokół', materialId, roomId, T,
    W, plinthH, [90, 0, 0], [px, py + PLINTH_SETBACK, pz], gid, pid('cokol'), cid)

  const panels: Panel[] = [bokLewy, bokPrawy, dol, plecy,
    listewkaPrzednia, listewkaTylna, cokol]

  const shelfPanels: Panel[] = []
  for (let k = 1; k <= shelves; k++) {
    const z = pz + plinthH + T + (k * (boxH - 2 * T)) / (shelves + 1)
    shelfPanels.push(mkPanel(`półka ${k}`, materialId, roomId, T,
      W - 2 * T, innerD, [0, 0, 0], [px + T, py, z], gid, pid(`polka-${k}`), cid))
  }
  panels.push(...shelfPanels)

  const frontPanels = makeDoors(
    { materialId, roomId, T }, doors,
    W - 2 * T, boxH - 2 * T,
    [px + T, py, pz + plinthH + T],
    gid, cid,
  )
  panels.push(...frontPanels)

  const connectors: Connector[] = []
  for (const h of [dol, listewkaPrzednia, listewkaTylna, ...shelfPanels]) {
    connectors.push(...makeJoint(bokLewy,  h, gid))
    connectors.push(...makeJoint(bokPrawy, h, gid))
  }

  const hardware: Hardware[] = []
  if (doors === 1 && frontPanels[0]) {
    hardware.push(makeHinge(frontPanels[0], bokLewy, gid))
  } else if (doors === 2) {
    if (frontPanels[0]) hardware.push(makeHinge(frontPanels[0], bokLewy,  gid))
    if (frontPanels[1]) hardware.push(makeHinge(frontPanels[1], bokPrawy, gid))
  }

  return { panels, connectors, hardware }
}

// ─── API publiczne ────────────────────────────────────────────────────────────

export function generateCabinet(params: CabinetParams): CabinetResult {
  const full: Required<CabinetParams> = {
    plinth: 100,
    pos:    [0, 0, 0],
    cabinetId: '',
    ...params,
  }
  switch (full.type) {
    case 'standing': return standingOrWallCabinet(full)
    case 'wall':     return standingOrWallCabinet(full)
    case 'base':     return baseCabinet(full)
  }
}

/** Generuje szafkę z obiektu Cabinet (Faza 7.3b). Deterministic IDs gdy Cabinet.id podane. */
export function generateCabinetFromObj(cabinet: Cabinet): CabinetResult {
  return generateCabinet({
    type:       cabinet.type,
    ...cabinet.params,
    materialId: cabinet.materialId,
    roomId:     cabinet.roomId,
    pos:        cabinet.position,
    cabinetId:  cabinet.id,
  })
}

// ─── sanity (DEV) ─────────────────────────────────────────────────────────────

export function sanityCabinetGenerate(): { ok: boolean; detail: string } {
  const { panels, connectors, hardware } = generateCabinet({
    type: 'standing', W: 600, H: 720, D: 560, T: 18, backT: 4,
    materialId: 'm1', roomId: 'r1', doors: 1, shelves: 0,
  })

  const sz = (p: Panel) => contourSize(p.contour)
  const find = (name: string) => panels.find((p) => p.name === name)

  const bokLewy = find('bok lewy')
  const gora    = find('wieniec górny')
  const plecy   = find('plecy')
  const front   = find('front')

  const bokLewyOk = bokLewy && sz(bokLewy).w === 560 && sz(bokLewy).h === 720
  // innerD = D - backT = 560 - 4 = 556
  const goraOk    = gora    && sz(gora).w   === 564 && sz(gora).h   === 556
  const plecyOk   = plecy   && sz(plecy).w  === 564 && sz(plecy).h  === 702
  const frontOk   = front   && sz(front).w  === 596 && sz(front).h  === 716
  const countOk   = panels.length === 6 && connectors.length >= 8 && hardware.length === 1

  const hw = hardware[0]?.hinge
  const hingeOk =
    hw?.doorPanel === front?.id &&
    hw?.sidePanel === bokLewy?.id &&
    hw?.placement[0]?.offset === 100

  const ok = !!(bokLewyOk && goraOk && plecyOk && frontOk && countOk && hingeOk)

  return {
    ok,
    detail: [
      `panels=${panels.length} connectors=${connectors.length} hardware=${hardware.length}`,
      `bok=${bokLewy ? `${sz(bokLewy).w}×${sz(bokLewy).h}` : 'MISSING'}`,
      `gora=${gora  ? `${sz(gora).w}×${sz(gora).h}`        : 'MISSING'}`,
      `plecy=${plecy ? `${sz(plecy).w}×${sz(plecy).h}`     : 'MISSING'}`,
      `front=${front ? `${sz(front).w}×${sz(front).h}`     : 'MISSING'}`,
      `hinge door=${hw?.doorPanel?.slice(0, 4)}≡front.id_${front?.id?.slice(0, 4)}`,
      `hinge side=${hw?.sidePanel?.slice(0, 4)}≡bok.id_${bokLewy?.id?.slice(0, 4)}`,
      `placement[0].offset=${hw?.placement[0]?.offset}`,
    ].join(' | '),
  }
}
