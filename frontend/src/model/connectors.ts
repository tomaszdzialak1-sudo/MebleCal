/**
 * Łączniki korpusu — „przepis na otwory".
 *
 * Jedno postawienie (relacja panelA↔panelB + pozycja WZGLĘDNA do krawędzi
 * panelB) → Operation na OBU płytach, różne wg typu. Operacje:
 *   • mają source = { connector: id } → są regenerowane, nie ruszamy ręcznych,
 *   • mają DETERMINISTYCZNE id `${connectorId}:A|B:i` → przy regeneracji
 *     podmieniają się w miejscu (nie puchną, zaznaczenie stabilne).
 *
 * Konwencja: panelA = LICOWA (czoło B opiera się o lico A); panelB = DOCZOŁOWA.
 * Kotwicę w czole B liczymy WSPÓLNĄ edgeAnchorLocal (ta sama konwencja co ręczne
 * otwory na krawędzi, też przy cutAngle≠90 — y wzdłuż lica 'front'). Lico A oraz
 * (xA,yA) WYPROWADZAMY z geometrii 3D: anchorB(local) → świat → panelA(local).
 *
 * Średnice/głębokości to DEFAULTY do strojenia — `connector.params` nadpisuje.
 */
import type { Connector, ConnectorType, Operation, OperationFace, Panel, Vec2, Vec3 } from './types'
import { DXF_LAYERS } from './defaults'
import { edgeAnchorLocal, edgeFrame } from './geometry'
import { localToWorld, rotationMatrixXYZ, worldToLocal } from './transform'

const TOUCH_TOL = 1.5 // mm — tolerancja styku „lico A ↔ czoło B"

export interface ConnectorAnchor {
  faceA: 'front' | 'back' // które lico A jest dotykane czołem B
  xA: number
  yA: number
  zA: number // surowe z w układzie A (≈0 → front, ≈−grubość → back)
  onFaceA: boolean // punkt styku mieści się w obrysie lica A
  edgeB: number
  xB: number
  yB: number
  gap: number // odległość punktu od najbliższego lica A (0 = idealny styk)
  touching: boolean
}

function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    const hit = yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}

function closestPointOnContour(p: Vec2, poly: Vec2[]): Vec2 {
  let best: Vec2 = poly[0]
  let bestD = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2))
    const q: Vec2 = [a[0] + dx * t, a[1] + dy * t]
    const d = Math.hypot(p[0] - q[0], p[1] - q[1])
    if (d < bestD) {
      bestD = d
      best = q
    }
  }
  return best
}

/** Wyprowadź kotwicę łącznika z geometrii (jedno źródło: krawędź panelB). */
export function deriveConnectorAnchor(
  panelA: Panel,
  panelB: Panel,
  placement: Connector['placement'],
): ConnectorAnchor {
  const edgeB = placement.fromEdge
  // absolute (Vec2) = ręczne nadpisanie kotwicy w czole B: [x wzdłuż, y przez grubość].
  const xB = placement.absolute ? placement.absolute[0] : placement.offset
  const yB = placement.absolute ? placement.absolute[1] : panelB.thickness / 2

  const localB = edgeAnchorLocal(panelB.contour, edgeB, xB, yB)
  const world = localToWorld(panelB.transform, localB)
  const inA = worldToLocal(panelA.transform, world)

  // lico A: front (z≈0) lub back (z≈−thickness) — bierz najbliższe.
  const dFront = Math.abs(inA[2])
  const dBack = Math.abs(inA[2] + panelA.thickness)
  const faceA: 'front' | 'back' = dFront <= dBack ? 'front' : 'back'
  const gap = Math.min(dFront, dBack)
  const onFaceA = pointInPolygon([inA[0], inA[1]], panelA.contour)

  return {
    faceA,
    xA: inA[0],
    yA: inA[1],
    zA: inA[2],
    onFaceA,
    edgeB,
    xB,
    yB,
    gap,
    touching: gap <= TOUCH_TOL && onFaceA,
  }
}

/**
 * Diagnostyka jednego łącznika: rozbij krok B(local)→świat→A(local)→lico, żeby
 * zobaczyć, gdzie liczba „ucieka". `invRotA` = transpozycja macierzy obrotu A
 * (= część obrotowa odwrotności transformu A; pozycję podajemy osobno).
 */
export function debugConnectorAnchor(panelA: Panel, panelB: Panel, placement: Connector['placement']) {
  const edgeB = placement.fromEdge
  const xB = placement.absolute ? placement.absolute[0] : placement.offset
  const yB = placement.absolute ? placement.absolute[1] : panelB.thickness / 2
  const localB = edgeAnchorLocal(panelB.contour, edgeB, xB, yB)
  const world = localToWorld(panelB.transform, localB)
  const invRotA = rotationMatrixXYZ(panelA.transform.rotation) // R; odwrotny rzut = Rᵀ·(p−pos)
  const inA = worldToLocal(panelA.transform, world)
  const a = deriveConnectorAnchor(panelA, panelB, placement)
  return { edgeB, xB, yB, localB, world, posA: panelA.transform.position, invRotA, inA, faceA: a.faceA, gap: a.gap }
}

export interface ContactFit {
  fromEdge: number
  offset: number
  gap: number // szczelina krawędź `edgePanel` ↔ lico `facePanel` (0 = idealny styk)
}

/**
 * Najlepszy styk CZOŁO↔LICO: która krawędź `edgePanel` (oceniana w swoim środku)
 * najbliżej pada na lico `facePanel`. Zwraca krawędź, offset (środek) i szczelinę.
 */
export function bestEdgeContact(facePanel: Panel, edgePanel: Panel): ContactFit {
  let best: ContactFit = { fromEdge: 0, offset: 0, gap: Infinity }
  for (let e = 0; e < edgePanel.contour.length; e++) {
    const offset = edgeFrame(edgePanel.contour, e).length / 2
    const a = deriveConnectorAnchor(facePanel, edgePanel, { fromEdge: e, offset })
    if (a.gap < best.gap) best = { fromEdge: e, offset: Math.round(offset), gap: a.gap }
  }
  return best
}

/**
 * Dobierz krawędź panelu B najlepiej stykającą się z licem A (min. szczelina).
 * (panelA = lico, panelB = czoło — konwencja modelu.)
 */
export function pickContactEdge(panelA: Panel, panelB: Panel): { fromEdge: number; offset: number } {
  const { fromEdge, offset } = bestEdgeContact(panelA, panelB)
  return { fromEdge, offset }
}

export interface RoleResolution {
  facePanel: Panel // płyta z LICEM styku → trzpień mimośrodu
  edgePanel: Panel // dochodzi CZOŁEM → puszka + otwór dojściowy mimośrodu
  fit: ContactFit // styk: krawędź edgePanel ↔ lico facePanel
  ambiguous: boolean
  reason?: string
}

/**
 * Wykryj z geometrii 3D, która z dwóch płyt dochodzi CZOŁEM (krawędzią) do LICA
 * drugiej. Porównuje obie orientacje i wybiera tę z mniejszą szczeliną styku.
 * `ambiguous` = automat nie potrafi jednoznacznie ustalić lico/czoło:
 *   • brak wyraźnego styku czoło↔lico (najmniejsza szczelina > tolerancja), albo
 *   • obie orientacje równie dobre (np. styk krawędź↔krawędź).
 */
export function detectRoles(p1: Panel, p2: Panel): RoleResolution {
  const fit12 = bestEdgeContact(p1, p2) // p2 dochodzi krawędzią do lica p1
  const fit21 = bestEdgeContact(p2, p1) // p1 dochodzi krawędzią do lica p2
  const p2isEdge = fit12.gap <= fit21.gap
  const facePanel = p2isEdge ? p1 : p2
  const edgePanel = p2isEdge ? p2 : p1
  const fit = p2isEdge ? fit12 : fit21
  const other = p2isEdge ? fit21 : fit12

  const noContact = fit.gap > TOUCH_TOL
  // obie orientacje równie (nie)odróżnialne i obie blisko = brak wyraźnego lico↔czoło
  const symmetric = other.gap <= TOUCH_TOL && Math.abs(fit.gap - other.gap) < 0.5
  const ambiguous = noContact || symmetric
  const reason = noContact
    ? `brak wyraźnego styku czoło↔lico (min. szczelina ${fit.gap.toFixed(1)} mm)`
    : symmetric
      ? 'obie płyty stykają się symetrycznie — nie wiadomo, która dochodzi czołem'
      : undefined
  return { facePanel, edgePanel, fit, ambiguous, reason }
}

/**
 * Role przy tworzeniu łącznika. Gdy geometria jest symetryczna/niejednoznaczna,
 * dla mimośrodu przyjmujemy praktyczne UI: płyta, z której dodajesz łącznik, jest
 * tą dochodzącą czołem (puszka + dojście), a wybrana druga płyta dostaje trzpień.
 */
export function resolveConnectorRoles(type: ConnectorType, firstPanel: Panel, secondPanel: Panel): RoleResolution {
  const roles = detectRoles(firstPanel, secondPanel)
  if (type !== 'cam' || !roles.ambiguous) return roles

  return {
    facePanel: secondPanel,
    edgePanel: firstPanel,
    fit: bestEdgeContact(secondPanel, firstPanel),
    ambiguous: roles.ambiguous,
    reason: roles.reason,
  }
}

const P = (params: Connector['params'], key: string, dflt: number): number => params?.[key] ?? dflt

/**
 * JEDNO źródło prawdy dla parametrów mimośrodu (cam): klucz → etykieta + default
 * + który OTWÓR steruje. Emiter (emitConnectorOps) i UI (ConnectorEditor) czytają
 * tę samą tablicę — etykieta nie może się odkleić od otworu, którym steruje.
 *   • trzpień → A:0 (lico A)
 *   • puszka  → B:0 (lico B, odsunięta od czoła o camEdgeDistance)
 *   • dojście → B:1 (czoło B, otwór od krawędzi do puszki)
 */
export interface CamParam {
  key: string
  label: string
  dflt: number
  hole: 'puszka' | 'trzpień' | 'dojście'
}
export const CAM_PARAMS: CamParam[] = [
  { key: 'camDiameter', label: 'Ø puszki', dflt: 15, hole: 'puszka' },
  { key: 'camDepth', label: 'Głęb. puszki', dflt: 13, hole: 'puszka' },
  { key: 'camEdgeDistance', label: 'Odległość puszki od czoła', dflt: 34, hole: 'puszka' },
  { key: 'boltDiameter', label: 'Ø trzpienia', dflt: 8, hole: 'trzpień' },
  { key: 'depthB', label: 'Głęb. trzpienia', dflt: 12, hole: 'trzpień' },
  { key: 'crossDiameter', label: 'Ø dojścia', dflt: 8, hole: 'dojście' },
  { key: 'crossDepth', label: 'Głęb. dojścia', dflt: 34, hole: 'dojście' },
]
const CAM_DFLT: Record<string, number> = Object.fromEntries(CAM_PARAMS.map((f) => [f.key, f.dflt]))
/** Wartość parametru cam: nadpisanie z `params` albo default z CAM_PARAMS. */
const camP = (params: Connector['params'], key: string): number => params?.[key] ?? CAM_DFLT[key]

/** Punkt na licu płyty liczony od krawędzi: wzdłuż krawędzi + w głąb formatu. */
function pointFromEdge(contour: Panel['contour'], edge: number, along: number, inward: number): Vec2 {
  const ef = edgeFrame(contour, edge)
  return [
    ef.a[0] + ef.along[0] * along + ef.inward[0] * inward,
    ef.a[1] + ef.along[1] * along + ef.inward[1] * inward,
  ]
}

function contourCenter(contour: Panel['contour']): Vec2 {
  const xs = contour.map((p) => p[0])
  const ys = contour.map((p) => p[1])
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}

function distanceToContour(p: Vec2, poly: Vec2[]): number {
  const q = closestPointOnContour(p, poly)
  return Math.hypot(p[0] - q[0], p[1] - q[1])
}

function keepFacePointOnPanel(panel: Panel, p: Vec2, minInset = 0.5): Vec2 {
  if (pointInPolygon(p, panel.contour) && distanceToContour(p, panel.contour) >= minInset) return p
  const q = closestPointOnContour(p, panel.contour)
  const c = contourCenter(panel.contour)
  const dx = c[0] - q[0]
  const dy = c[1] - q[1]
  const len = Math.hypot(dx, dy) || 1
  return [q[0] + (dx / len) * minInset, q[1] + (dy / len) * minInset]
}

function keepFaceHoleOnPanel(panel: Panel, p: Vec2, diameter: number, preferredInset = 0.5): Vec2 {
  return keepFacePointOnPanel(panel, p, Math.max(diameter / 2 + 0.5, preferredInset))
}

function panelFaceCenterWorld(panel: Panel, face: 'front' | 'back'): Vec3 {
  const [x, y] = contourCenter(panel.contour)
  return localToWorld(panel.transform, [x, y, face === 'front' ? 0 : -panel.thickness])
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/** Automatycznie wybierz tę stronę puszki, która jest bliżej płyty z trzpieniem. */
export function autoCamFace(panelA: Panel, panelB: Panel): 'front' | 'back' {
  const aCenter = localToWorld(panelA.transform, [...contourCenter(panelA.contour), -panelA.thickness / 2])
  const front = panelFaceCenterWorld(panelB, 'front')
  const back = panelFaceCenterWorld(panelB, 'back')
  return dist(front, aCenter) <= dist(back, aCenter) ? 'front' : 'back'
}

function holeOp(
  id: string,
  connectorId: string,
  face: OperationFace,
  x: number,
  y: number,
  diameter: number,
  depth: number,
  through: boolean,
): Operation {
  return {
    id,
    type: 'hole',
    face,
    source: { connector: connectorId },
    dxfLayer: DXF_LAYERS.hole,
    hole: { x, y, diameter, depth, through },
  }
}

/**
 * Policz operacje łącznika na obu płytach. Liczba otworów per typ jest STAŁA →
 * deterministyczne id podmieniają się w miejscu przy regeneracji.
 */
export function emitConnectorOps(
  connector: Connector,
  panelA: Panel,
  panelB: Panel,
): { opsA: Operation[]; opsB: Operation[]; anchor: ConnectorAnchor } {
  const anchor = deriveConnectorAnchor(panelA, panelB, connector.placement)
  const { faceA, xA, yA, edgeB, xB, yB } = anchor
  const p = connector.params
  const cid = connector.id
  const edgeFace: OperationFace = { edge: edgeB }
  const oppositeA: 'front' | 'back' = faceA === 'front' ? 'back' : 'front'

  const opsA: Operation[] = []
  const opsB: Operation[] = []

  switch (connector.type) {
    case 'dowel': {
      // Kołek: Ø8 w licu A + Ø8 w czole B (symetrycznie).
      const dia = P(p, 'diameter', 8)
      const [safeXA, safeYA] = keepFaceHoleOnPanel(panelA, [xA, yA], dia, yB)
      opsA.push(holeOp(`${cid}:A:0`, cid, faceA, safeXA, safeYA, dia, P(p, 'depthA', 12), false))
      opsB.push(holeOp(`${cid}:B:0`, cid, edgeFace, xB, yB, P(p, 'diameter', 8), P(p, 'depthB', 30), false))
      break
    }
    case 'confirmat': {
      // Śruba przez lico A (Ø7 przelot) + pogłębienie łba Ø10 na licu zewnętrznym;
      // pilot Ø5 w czole B.
      const dia = P(p, 'diameter', 7)
      const headDia = P(p, 'headDiameter', 10)
      const [safeXA, safeYA] = keepFaceHoleOnPanel(panelA, [xA, yA], Math.max(dia, headDia), yB)
      opsA.push(holeOp(`${cid}:A:0`, cid, faceA, safeXA, safeYA, dia, panelA.thickness, true))
      opsA.push(holeOp(`${cid}:A:1`, cid, oppositeA, safeXA, safeYA, headDia, P(p, 'headDepth', 2), false))
      opsB.push(holeOp(`${cid}:B:0`, cid, edgeFace, xB, yB, P(p, 'pilotDiameter', 5), P(p, 'depthB', 50), false))
      break
    }
    case 'cam': {
      // Mimośród: trzpień siedzi w LICU płyty A, a puszka + otwór dojściowy
      // są w płycie B, która dochodzi CZOŁEM do A.
      //   (A:0) boltDiameter  → TRZPIEŃ w licu A,
      //   (B:0) camDiameter   → PUSZKA na licu B, odsunięta od czoła,
      //   (B:1) crossDiameter → DOJŚCIE w czole B, w osi trzpienia/puszki.
      const camFace = connector.camFace ?? autoCamFace(panelA, panelB)
      const boltDia = camP(p, 'boltDiameter')
      const cupDia = camP(p, 'camDiameter')
      const [safeXA, safeYA] = keepFaceHoleOnPanel(panelA, [xA, yA], boltDia, yB)
      const [cupX, cupY] = keepFaceHoleOnPanel(
        panelB,
        pointFromEdge(panelB.contour, edgeB, xB, camP(p, 'camEdgeDistance')),
        cupDia,
        camP(p, 'camEdgeDistance'),
      )

      // Trzpień: w licu A, w punkcie styku z czołem B.
      opsA.push(holeOp(`${cid}:A:0`, cid, faceA, safeXA, safeYA, boltDia, camP(p, 'depthB'), false))

      // Puszka mimośrodu: na szerokim licu płyty B, nie w jej czole.
      opsB.push(holeOp(`${cid}:B:0`, cid, camFace, cupX, cupY, cupDia, camP(p, 'camDepth'), false))

      // Otwór dojściowy: od czoła B do puszki, w tej samej osi wzdłuż krawędzi.
      opsB.push(holeOp(`${cid}:B:1`, cid, edgeFace, xB, yB, camP(p, 'crossDiameter'), camP(p, 'crossDepth'), false))
      break
    }
  }

  return { opsA, opsB, anchor }
}

/**
 * Sanity (DEV): klucz params mimośrodu → właściwy OTWÓR. Emit z różnymi Ø
 * (puszka 15 / trzpień 8 / dojście 30) i sprawdzenie, że trafiły do B:0 / A:0 /
 * B:1. Łapie ewentualne przesunięcie klucz→otwór (etykiety UI = CAM_PARAMS).
 */
export function sanityCamParamMapping(): { ok: boolean; detail: string } {
  const mk = (over: Partial<Panel>): Panel => ({
    id: 'x', name: 'x', materialId: 'm', roomId: '', thickness: 18,
    contour: [[0, 0], [600, 0], [600, 720], [0, 720]],
    transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
    edges: [{ cutAngle: 90 }, { cutAngle: 90 }, { cutAngle: 90 }, { cutAngle: 90 }],
    baseFace: 'front', operations: [], ...over,
  })
  const panelA = mk({ id: 'A', name: 'A' })
  const panelB = mk({ id: 'B', name: 'B', transform: { position: [0, 0, 0], rotation: [90, 0, 0] } })
  const connector: Connector = {
    id: 'C', type: 'cam', panelA: 'A', panelB: 'B',
    placement: { fromEdge: 0, offset: 300 },
    params: { camDiameter: 15, boltDiameter: 8, crossDiameter: 30 },
  }
  const { opsA, opsB } = emitConnectorOps(connector, panelA, panelB)
  const ops = [...opsA, ...opsB]
  const dia = (suffix: string) => ops.find((o) => o.id.endsWith(suffix))?.hole?.diameter
  const pus = dia(':B:0')
  const trz = dia(':A:0')
  const doj = dia(':B:1')
  // trzpień w licu A (opsA), puszka na licu B + dojście w czole B (opsB)
  const onA = new Set(opsA.map((o) => o.id))
  const onB = new Set(opsB.map((o) => o.id))
  const placement = onA.has('C:A:0') && onB.has('C:B:0') && onB.has('C:B:1')
  const cupFace = ops.find((o) => o.id === 'C:B:0')?.face
  const cupOnFace = cupFace === 'front' || cupFace === 'back'
  const accessOnEdge = typeof ops.find((o) => o.id === 'C:B:1')?.face !== 'string'
  const ok = pus === 15 && trz === 8 && doj === 30 && placement && cupOnFace && accessOnEdge
  return {
    ok,
    detail: `puszka(B:0)=${pus}·15 face=${JSON.stringify(cupFace)}  trzpień(A:0)=${trz}·8  dojście(B:1)=${doj}·30  | trzpień w licu A, puszka na licu B, dojście w czole B: ${placement}`,
  }
}

/**
 * Sanity (DEV): otwór z łącznika w czole panelu B na UKOSOWEJ krawędzi musi
 * trafić w ten sam punkt, co ręczny otwór z identycznymi (x,y) — bo obie ścieżki
 * używają edgeAnchorLocal. Pilnuje, że emitery nie wprowadzą drugiej konwencji.
 */
export function sanityEdgeAnchorParity(): { ok: boolean; detail: string } {
  const contour: Panel['contour'] = [
    [0, 0],
    [600, 0],
    [600, 720],
    [0, 720],
  ]
  const panelB: Panel = {
    id: 'B',
    name: 'B',
    materialId: 'm',
    roomId: '',
    thickness: 18,
    contour,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
    edges: [{ cutAngle: 90 }, { cutAngle: 45 }, { cutAngle: 90 }, { cutAngle: 90 }],
    baseFace: 'front',
    operations: [],
  }
  const panelA: Panel = { ...panelB, id: 'A', name: 'A' }
  const connector: Connector = {
    id: 't',
    type: 'dowel',
    panelA: 'A',
    panelB: 'B',
    placement: { fromEdge: 1, offset: 100 }, // ukosowa krawędź 1, cutAngle 45
  }

  const { opsB } = emitConnectorOps(connector, panelA, panelB)
  const b = opsB[0].hole!
  const fromConnector = edgeAnchorLocal(contour, 1, b.x, b.y)
  const manual = edgeAnchorLocal(contour, 1, 100, panelB.thickness / 2) // ręczny otwór
  const d = Math.hypot(
    fromConnector[0] - manual[0],
    fromConnector[1] - manual[1],
    fromConnector[2] - manual[2],
  )
  return { ok: d < 1e-9, detail: `krawędź 1 (cutAngle 45): Δ=${d.toExponential(2)} mm` }
}

/**
 * Sanity (DEV): styk czoła B z licem **'back'** panelu A przy OBROCIE A — czy
 * derive zwraca to samo (xA,yA), które ma ręczny otwór na tym licu, oraz gap≈0.
 * Buduje realny styk: ustawia pozycję B tak, by świat kotwicy B pokrył docelowy
 * punkt na licu back A. Łapie ewentualny błąd odwrotności/lustra po stronie back.
 */
export function sanityBackFaceAnchor(): { ok: boolean; detail: string } {
  const mk = (over: Partial<Panel>): Panel => ({
    id: 'x',
    name: 'x',
    materialId: 'm',
    roomId: '',
    thickness: 18,
    contour: [
      [0, 0],
      [720, 0],
      [720, 720],
      [0, 720],
    ],
    transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
    edges: [{ cutAngle: 90 }, { cutAngle: 90 }, { cutAngle: 90 }, { cutAngle: 90 }],
    baseFace: 'front',
    operations: [],
    ...over,
  })

  const mx = 250
  const my = 333
  const panelA = mk({ id: 'A', baseFace: 'back', transform: { position: [0, 0, 0], rotation: [0, 0, 90] } })
  const targetWorld = localToWorld(panelA.transform, [mx, my, -panelA.thickness])

  const panelB = mk({
    id: 'B',
    contour: [
      [0, 0],
      [600, 0],
      [600, 300],
      [0, 300],
    ],
    transform: { position: [0, 0, 0], rotation: [-90, 0, 0] },
  })
  const offsetB = 150
  // ustaw pozycję B tak, by kotwica B (świat) pokryła targetWorld
  const rotOnly = localToWorld({ position: [0, 0, 0], rotation: panelB.transform.rotation }, edgeAnchorLocal(panelB.contour, 0, offsetB, panelB.thickness / 2))
  panelB.transform.position = [
    targetWorld[0] - rotOnly[0],
    targetWorld[1] - rotOnly[1],
    targetWorld[2] - rotOnly[2],
  ]

  const a = deriveConnectorAnchor(panelA, panelB, { fromEdge: 0, offset: offsetB })
  const errXY = Math.max(Math.abs(a.xA - mx), Math.abs(a.yA - my))
  const ok = a.faceA === 'back' && errXY < 1e-6 && a.gap < 1e-6
  return {
    ok,
    detail: `back+obrót90°: faceA=${a.faceA} xA=${a.xA.toFixed(2)} yA=${a.yA.toFixed(2)} gap=${a.gap.toFixed(2)} (errXY=${errXY.toExponential(2)})`,
  }
}
