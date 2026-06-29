import { create } from 'zustand'
import type {
  Cabinet,
  Connector,
  ConnectorType,
  Edge,
  Hardware,
  Material,
  Operation,
  OperationFace,
  OperationType,
  Panel,
  Project,
  ProjectSettings,
  Selection,
  Vec2,
  Vec3,
} from '../model/types'
import {
  buildRoom,
  createConnector,
  createDefaultProject,
  createHardware,
  createMaterial,
  createOperation,
  createPanel,
  createRoom,
  rectContour,
  syncEdges,
  trapezoidContour,
  uniqueName,
  type TrapezoidParams,
} from '../model/factories'
import { detectRoles, emitConnectorOps, pickContactEdge, resolveConnectorRoles, sanityBackFaceAnchor, sanityCamParamMapping, sanityEdgeAnchorParity } from '../model/connectors'
import type { CabinetResult } from '../model/cabinet-templates'
import { generateCabinetFromObj, sanityCabinetGenerate } from '../model/cabinet-templates'
import { createCabinet } from '../model/factories'
import { emitHingeOps, pickHingeEdge, sanityHingeEmit } from '../model/hinges'
import { hingeCount, hingePositions } from '../model/blum-catalog'
import { edgeFrame } from '../model/geometry'

// Parametry zależne od typu operacji (klucz w Operation = nazwa typu).
type OpParams = NonNullable<Operation['hole' | 'groove' | 'cutout' | 'pocket']>

/** Patch parametrów operacji do właściwego pola wg jej typu. */
function patchOperationParams(op: Operation, patch: Partial<OpParams>): Operation {
  const current = op[op.type] as OpParams | undefined
  return { ...op, [op.type]: { ...(current ?? {}), ...patch } }
}

const isEdgeFace = (f: OperationFace) => typeof f !== 'string'

/**
 * Przy zmianie lica zmienia się znaczenie współrzędnych otworu:
 * na froncie/back (x,y) = pozycja na licu; na krawędzi x = wzdłuż krawędzi,
 * y = przez grubość. Bez przeliczenia stara wartość (np. y=360) trafia poza
 * płytę. Remapujemy na środek nowego kontekstu, gdy zmienia się typ lica.
 */
function remapHoleOnFaceChange(panel: Panel, op: Operation, newFace: OperationFace): Operation {
  if (op.type !== 'hole' || !op.hole) return { ...op, face: newFace }
  const wasEdge = isEdgeFace(op.face)
  const nowEdge = isEdgeFace(newFace)
  if (wasEdge === nowEdge) return { ...op, face: newFace }

  let x: number
  let y: number
  if (nowEdge) {
    // płaszczyzna → krawędź: środek krawędzi i środek grubości
    const n = panel.contour.length
    const edge = (newFace as { edge: number }).edge
    const a = panel.contour[edge % n]
    const b = panel.contour[(edge + 1) % n]
    x = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2
    y = panel.thickness / 2
  } else {
    // krawędź → płaszczyzna: środek konturu
    const xs = panel.contour.map((p) => p[0])
    const ys = panel.contour.map((p) => p[1])
    x = (Math.min(...xs) + Math.max(...xs)) / 2
    y = (Math.min(...ys) + Math.max(...ys)) / 2
  }
  return { ...op, face: newFace, hole: { ...op.hole, x, y } }
}
import { loadFromLocalStorage, saveToLocalStorage } from '../model/serialization'

type PanelRecipe = (p: Panel) => Panel

interface ProjectStore {
  project: Project
  selection: Selection

  // pochodne szafek (nie serializowane, regenerowane przy każdej zmianie Cabinet)
  cabinetDerived: Record<string, CabinetResult>

  // selektory łączące standalone + cabinet-generated
  allPanels: () => Panel[]
  allConnectors: () => Connector[]
  allHardware: () => Hardware[]

  // selekcja
  select: (sel: Selection) => void

  // płyty
  addPanel: () => void
  removePanel: (id: string) => void
  updatePanelFields: (id: string, patch: Partial<Panel>) => void
  updatePanelTransform: (
    id: string,
    patch: Partial<Panel['transform']>,
  ) => void
  updatePanelDimensions: (id: string, w: number, h: number) => void
  updatePanelGrain: (id: string, direction: 0 | 90 | null) => void

  // kształt / krawędzie (Faza 2)
  setContour: (id: string, contour: Vec2[]) => void
  setTrapezoid: (id: string, params: TrapezoidParams) => void
  updateEdge: (id: string, index: number, patch: Partial<Edge>) => void
  setAllBanding: (id: string, bandingType: string | null) => void

  // operacje (Faza 3)
  addOperation: (panelId: string, type: OperationType) => string
  removeOperation: (panelId: string, opId: string) => void
  updateOperation: (
    panelId: string,
    opId: string,
    patch: Partial<{ face: OperationFace; dxfLayer: string }>,
  ) => void
  updateOperationParams: (panelId: string, opId: string, patch: Partial<OpParams>) => void

  // łączniki (Faza 4)
  addConnector: (type: ConnectorType, panelA: string, panelB: string) => string
  updateConnector: (id: string, patch: Partial<Omit<Connector, 'id'>>) => void
  swapConnectorSides: (id: string) => void
  removeConnector: (id: string) => void

  // okucia / zawiasy (Faza 5)
  addHardware: (doorPanel: string, sidePanel: string) => string
  updateHardware: (id: string, patch: Partial<Omit<Hardware, 'id'>>) => void
  removeHardware: (id: string) => void

  // pomieszczenia
  addRoom: () => void
  removeRoom: (id: string) => void
  setRoomDimensions: (id: string, w: number, d: number, h: number) => void
  setRoomColor: (
    id: string,
    part: 'floor' | 'ceiling' | 'walls',
    color: string,
  ) => void

  // szablony szafek (Faza 7.3 — legacy: wstawia jako luźne płyty)
  insertCabinet: (result: CabinetResult) => void

  // szafki parametryczne (Faza 7.3b)
  addCabinet: (type: Cabinet['type']) => string
  updateCabinet: (id: string, patch: Partial<Omit<Cabinet, 'id'>>) => void
  moveCabinet: (id: string, position: Vec3) => void
  removeCabinet: (id: string) => void

  // materiały
  addMaterial: () => void
  updateMaterial: (id: string, patch: Partial<Material>) => void

  // ustawienia + projekt
  updateSettings: (patch: Partial<ProjectSettings>) => void
  setProjectName: (name: string) => void
  loadProject: (project: Project) => void
  newProject: () => void
}

function patchPanel(project: Project, id: string, recipe: PanelRecipe): Project {
  return { ...project, panels: project.panels.map((p) => (p.id === id ? recipe(p) : p)) }
}

// --- Regeneracja operacji z łączników (Faza 4) ------------------------------

/** Czy operacja pochodzi z danego łącznika. */
const isFromConnector = (op: Operation, connectorId: string): boolean =>
  typeof op.source === 'object' && 'connector' in op.source && op.source.connector === connectorId

/** Operacje płyty bez tych pochodzących z danego łącznika (ręczne nietknięte). */
const stripConnectorOps = (panel: Panel, connectorId: string): Operation[] =>
  panel.operations.filter((o) => !isFromConnector(o, connectorId))

/**
 * Przelicz operacje JEDNEGO łącznika i wstaw je na obu płytach (podmiana w
 * miejscu — najpierw zdejmij stare tego łącznika, potem dołóż świeże).
 */
function applyConnectorOps(project: Project, connector: Connector): Project {
  const panelA = project.panels.find((p) => p.id === connector.panelA)
  const panelB = project.panels.find((p) => p.id === connector.panelB)
  if (!panelA || !panelB) {
    // brak którejś płyty → tylko zdejmij stare operacje tego łącznika
    return {
      ...project,
      panels: project.panels.map((p) => ({ ...p, operations: stripConnectorOps(p, connector.id) })),
    }
  }
  const { opsA, opsB } = emitConnectorOps(connector, panelA, panelB)
  return {
    ...project,
    panels: project.panels.map((p) => {
      const base = stripConnectorOps(p, connector.id)
      // ta sama płyta po obu stronach (degenerat) — dołóż oba zestawy
      if (p.id === panelA.id && p.id === panelB.id) return { ...p, operations: [...base, ...opsA, ...opsB] }
      if (p.id === panelA.id) return { ...p, operations: [...base, ...opsA] }
      if (p.id === panelB.id) return { ...p, operations: [...base, ...opsB] }
      return p
    }),
  }
}

/** Regeneruj wszystkie łączniki dotykające danej płyty (po zmianie jej geometrii). */
function regenerateConnectorsTouching(project: Project, panelId: string): Project {
  let next = project
  for (const c of project.connectors) {
    if (c.panelA === panelId || c.panelB === panelId) next = applyConnectorOps(next, c)
  }
  return next
}

// --- Regeneracja operacji z okuć / zawiasów (Faza 5) ------------------------

const isFromHardware = (op: Operation, hardwareId: string): boolean =>
  typeof op.source === 'object' && 'hardware' in op.source && op.source.hardware === hardwareId

const stripHardwareOps = (panel: Panel, hardwareId: string): Operation[] =>
  panel.operations.filter((o) => !isFromHardware(o, hardwareId))

const hwPanels = (h: Hardware): { door: string; side: string } => ({
  door: h.hinge?.doorPanel ?? '',
  side: h.hinge?.sidePanel ?? '',
})

/** Przelicz operacje JEDNEGO okucia i wstaw na froncie + boku (podmiana w miejscu). */
function applyHingeOps(project: Project, hardware: Hardware): Project {
  const { door, side } = hwPanels(hardware)
  const front = project.panels.find((p) => p.id === door)
  const sidePanel = project.panels.find((p) => p.id === side)
  if (!front || !sidePanel) {
    return {
      ...project,
      panels: project.panels.map((p) => ({ ...p, operations: stripHardwareOps(p, hardware.id) })),
    }
  }
  const { opsFront, opsSide } = emitHingeOps(hardware, front, sidePanel)
  return {
    ...project,
    panels: project.panels.map((p) => {
      const base = stripHardwareOps(p, hardware.id)
      if (p.id === front.id && p.id === sidePanel.id) return { ...p, operations: [...base, ...opsFront, ...opsSide] }
      if (p.id === front.id) return { ...p, operations: [...base, ...opsFront] }
      if (p.id === sidePanel.id) return { ...p, operations: [...base, ...opsSide] }
      return p
    }),
  }
}

/** Regeneruj okucia dotykające danej płyty (front lub bok). */
function regenerateHardwareTouching(project: Project, panelId: string): Project {
  let next = project
  for (const h of project.hardware) {
    const { door, side } = hwPanels(h)
    if (door === panelId || side === panelId) next = applyHingeOps(next, h)
  }
  return next
}

/** Regeneruj WSZYSTKO (łączniki + okucia) dotykające płyty. */
function regenerateForPanel(project: Project, panelId: string): Project {
  return regenerateHardwareTouching(regenerateConnectorsTouching(project, panelId), panelId)
}

/** Po zmianie emitera/parametrów katalogowych stare autosave/importy dostają świeże operacje. */
function regenerateGeneratedOps(project: Project): Project {
  let next = project
  for (const c of project.connectors) next = applyConnectorOps(next, c)
  for (const h of project.hardware) next = applyHingeOps(next, h)
  return next
}

/** Generuje cabinetDerived dla wszystkich szafek w projekcie. */
function buildCabinetDerived(project: Project): Record<string, CabinetResult> {
  const result: Record<string, CabinetResult> = {}
  for (const cab of project.cabinets ?? []) {
    result[cab.id] = generateCabinetFromObj(cab)
  }
  return result
}

const _initialProject = regenerateGeneratedOps(loadFromLocalStorage() ?? createDefaultProject())
const _initialDerived = buildCabinetDerived(_initialProject)

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: _initialProject,
  selection: null,
  cabinetDerived: _initialDerived,

  allPanels: () => {
    const { project, cabinetDerived } = get()
    return [
      ...project.panels,
      ...Object.values(cabinetDerived).flatMap((r) => r.panels),
    ]
  },
  allConnectors: () => {
    const { project, cabinetDerived } = get()
    return [
      ...project.connectors,
      ...Object.values(cabinetDerived).flatMap((r) => r.connectors),
    ]
  },
  allHardware: () => {
    const { project, cabinetDerived } = get()
    return [
      ...project.hardware,
      ...Object.values(cabinetDerived).flatMap((r) => r.hardware),
    ]
  },

  select: (sel) => set({ selection: sel }),

  addPanel: () => {
    const { project } = get()
    const materialId = project.materials[0]?.id ?? createMaterial().id
    const name = uniqueName(
      project.panels.map((p) => p.name),
      `płyta ${project.panels.length + 1}`,
    )
    const panel = createPanel({ name, materialId, roomId: project.rooms[0]?.id ?? '', position: [0, 0, 0] })
    set({
      project: { ...project, panels: [...project.panels, panel] },
      selection: { type: 'panel', id: panel.id },
    })
  },

  removePanel: (id) =>
    set((s) => {
      // łączniki/okucia dotykające usuwanej płyty znikają; ich operacje trzeba
      // zdjąć też z drugiej (ocalałej) płyty.
      const droppedC = s.project.connectors.filter((c) => c.panelA === id || c.panelB === id)
      const droppedH = s.project.hardware.filter((h) => {
        const { door, side } = hwPanels(h)
        return door === id || side === id
      })
      const panels = s.project.panels
        .filter((p) => p.id !== id)
        .map((p) => {
          let np = droppedC.reduce((acc, c) => ({ ...acc, operations: stripConnectorOps(acc, c.id) }), p)
          np = droppedH.reduce((acc, h) => ({ ...acc, operations: stripHardwareOps(acc, h.id) }), np)
          return np
        })
      return {
        project: {
          ...s.project,
          panels,
          connectors: s.project.connectors.filter((c) => c.panelA !== id && c.panelB !== id),
          hardware: s.project.hardware.filter((h) => {
            const { door, side } = hwPanels(h)
            return door !== id && side !== id
          }),
        },
        selection: s.selection?.type === 'panel' && s.selection.id === id ? null : s.selection,
      }
    }),

  updatePanelFields: (id, patch) =>
    set((s) => {
      const project = patchPanel(s.project, id, (p) => ({ ...p, ...patch }))
      // grubość zmienia kotwice łączników/okuć → regeneruj
      return { project: 'thickness' in patch ? regenerateForPanel(project, id) : project }
    }),

  updatePanelTransform: (id, patch) =>
    set((s) => {
      const project = patchPanel(s.project, id, (p) => ({
        ...p,
        transform: { ...p.transform, ...patch },
      }))
      // Ruch bryły nie zmienia lokalnego położenia nawiertów. Operacje z łączników
      // i okuć zostają w swoich płytach; walidacja ostrzega, jeśli relacja po ruchu
      // nie jest już geometrycznie poprawna.
      return { project }
    }),

  updatePanelDimensions: (id, w, h) =>
    set((s) => {
      const project = patchPanel(s.project, id, (p) => ({ ...p, contour: rectContour(w, h) }))
      return { project: regenerateForPanel(project, id) }
    }),

  updatePanelGrain: (id, direction) =>
    set((s) => ({
      project: patchPanel(s.project, id, (p) => ({
        ...p,
        grain: direction === null ? undefined : { ...(p.grain ?? {}), direction },
      })),
    })),

  setContour: (id, contour) =>
    set((s) => {
      const project = patchPanel(s.project, id, (p) => ({
        ...p,
        contour,
        edges: syncEdges(p.edges, contour.length),
      }))
      return { project: regenerateForPanel(project, id) }
    }),

  setTrapezoid: (id, params) =>
    set((s) => {
      const project = patchPanel(s.project, id, (p) => {
        const contour = trapezoidContour(params)
        return { ...p, contour, edges: syncEdges(p.edges, contour.length) }
      })
      return { project: regenerateForPanel(project, id) }
    }),

  updateEdge: (id, index, patch) =>
    set((s) => ({
      project: patchPanel(s.project, id, (p) => ({
        ...p,
        edges: p.edges.map((e, i) => (i === index ? { ...e, ...patch } : e)),
      })),
    })),

  setAllBanding: (id, bandingType) =>
    set((s) => ({
      project: patchPanel(s.project, id, (p) => ({
        ...p,
        edges: p.edges.map((e) => ({ ...e, bandingType: bandingType ?? undefined })),
      })),
    })),

  addOperation: (panelId, type) => {
    const panel = get().project.panels.find((p) => p.id === panelId)
    const op = createOperation(type, panel?.contour ?? rectContour(600, 720))
    set((s) => ({
      project: patchPanel(s.project, panelId, (p) => ({ ...p, operations: [...p.operations, op] })),
    }))
    return op.id
  },

  removeOperation: (panelId, opId) =>
    set((s) => ({
      project: patchPanel(s.project, panelId, (p) => ({
        ...p,
        operations: p.operations.filter((o) => o.id !== opId),
      })),
    })),

  updateOperation: (panelId, opId, patch) =>
    set((s) => ({
      project: patchPanel(s.project, panelId, (p) => ({
        ...p,
        operations: p.operations.map((o) => {
          if (o.id !== opId) return o
          // zmiana lica → przelicz pozycję otworu na nowy kontekst
          if (patch.face !== undefined && patch.face !== o.face) {
            return { ...remapHoleOnFaceChange(p, o, patch.face), ...patch }
          }
          return { ...o, ...patch }
        }),
      })),
    })),

  updateOperationParams: (panelId, opId, patch) =>
    set((s) => ({
      project: patchPanel(s.project, panelId, (p) => ({
        ...p,
        operations: p.operations.map((o) => (o.id === opId ? patchOperationParams(o, patch) : o)),
      })),
    })),

  addConnector: (type, panelA, panelB) => {
    const proj = get().project
    const pa = proj.panels.find((p) => p.id === panelA)
    const pb = proj.panels.find((p) => p.id === panelB)
    // AUTO z geometrii 3D: która płyta ma LICO styku (→ panelA = trzpień) a która
    // dochodzi CZOŁEM (→ panelB = puszka + dojście), + krawędź styku. Brak płyt → 0.
    let aId = panelA
    let bId = panelB
    let placement: Connector['placement'] = { fromEdge: 0, offset: 0 }
    if (pa && pb) {
      const roles = resolveConnectorRoles(type, pa, pb)
      aId = roles.facePanel.id
      bId = roles.edgePanel.id
      placement = { fromEdge: roles.fit.fromEdge, offset: roles.fit.offset }
    }
    const connector = createConnector(type, aId, bId, placement)
    set((s) => ({
      project: applyConnectorOps(
        { ...s.project, connectors: [...s.project.connectors, connector] },
        connector,
      ),
      selection: { type: 'connector', id: connector.id },
    }))
    return connector.id
  },

  updateConnector: (id, patch) =>
    set((s) => {
      const connectors = s.project.connectors.map((c) => (c.id === id ? { ...c, ...patch } : c))
      const updated = connectors.find((c) => c.id === id)
      const project = { ...s.project, connectors }
      return { project: updated ? applyConnectorOps(project, updated) : project }
    }),

  // „Zamień strony" (odwrotny montaż): zamień rolę lico↔czoło (panelA↔panelB) i
  // dobierz na nowo krawędź styku dla nowego panelB; kasuje ręczne nadpisanie.
  swapConnectorSides: (id) =>
    set((s) => {
      const connectors = s.project.connectors.map((c) => {
        if (c.id !== id) return c
        const newA = s.project.panels.find((p) => p.id === c.panelB)
        const newB = s.project.panels.find((p) => p.id === c.panelA)
        const placement =
          newA && newB
            ? pickContactEdge(newA, newB)
            : { fromEdge: c.placement.fromEdge, offset: c.placement.offset }
        return { ...c, panelA: c.panelB, panelB: c.panelA, placement }
      })
      const updated = connectors.find((c) => c.id === id)
      const project = { ...s.project, connectors }
      return { project: updated ? applyConnectorOps(project, updated) : project }
    }),

  removeConnector: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        connectors: s.project.connectors.filter((c) => c.id !== id),
        panels: s.project.panels.map((p) => ({ ...p, operations: stripConnectorOps(p, id) })),
      },
      selection: s.selection?.type === 'connector' && s.selection.id === id ? null : s.selection,
    })),

  addHardware: (doorPanel, sidePanel) => {
    const proj = get().project
    const front = proj.panels.find((p) => p.id === doorPanel)
    const side = proj.panels.find((p) => p.id === sidePanel)
    const hardware = createHardware(doorPanel, sidePanel)
    if (front && side && hardware.hinge) {
      // krawędź zawiasowa frontu (z geometrii) + rozkład zawiasów wg wysokości
      const fromEdge = pickHingeEdge(front, side)
      const height = edgeFrame(front.contour, fromEdge).length
      const count = hingeCount(height)
      hardware.hinge.placement = hingePositions(height, count).map((offset) => ({ fromEdge, offset }))
    }
    set((s) => ({
      project: applyHingeOps({ ...s.project, hardware: [...s.project.hardware, hardware] }, hardware),
      selection: { type: 'hardware', id: hardware.id },
    }))
    return hardware.id
  },

  updateHardware: (id, patch) =>
    set((s) => {
      const hardware = s.project.hardware.map((h) => (h.id === id ? { ...h, ...patch } : h))
      const updated = hardware.find((h) => h.id === id)
      const project = { ...s.project, hardware }
      return { project: updated ? applyHingeOps(project, updated) : project }
    }),

  removeHardware: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        hardware: s.project.hardware.filter((h) => h.id !== id),
        panels: s.project.panels.map((p) => ({ ...p, operations: stripHardwareOps(p, id) })),
      },
      selection: s.selection?.type === 'hardware' && s.selection.id === id ? null : s.selection,
    })),

  addRoom: () =>
    set((s) => ({ project: { ...s.project, rooms: [...s.project.rooms, createRoom()] } })),

  removeRoom: (id) =>
    set((s) => ({
      project: { ...s.project, rooms: s.project.rooms.filter((r) => r.id !== id) },
      selection: s.selection?.type === 'room' && s.selection.id === id ? null : s.selection,
    })),

  setRoomDimensions: (id, w, d, h) =>
    set((s) => ({
      project: {
        ...s.project,
        rooms: s.project.rooms.map((r) =>
          r.id === id
            ? buildRoom({
                w,
                d,
                h,
                id: r.id,
                name: r.name,
                colors: {
                  walls: r.walls[0]?.color,
                  floor: r.floor.color,
                  ceiling: r.ceiling.color,
                },
              })
            : r,
        ),
      },
    })),

  setRoomColor: (id, part, color) =>
    set((s) => ({
      project: {
        ...s.project,
        rooms: s.project.rooms.map((r) => {
          if (r.id !== id) return r
          if (part === 'floor') return { ...r, floor: { ...r.floor, color } }
          if (part === 'ceiling') return { ...r, ceiling: { ...r.ceiling, color } }
          return { ...r, walls: r.walls.map((w) => ({ ...w, color })) }
        }),
      },
    })),

  insertCabinet: (result) =>
    set((s) => {
      let project = {
        ...s.project,
        panels:     [...s.project.panels,     ...result.panels],
        connectors: [...s.project.connectors, ...result.connectors],
        hardware:   [...s.project.hardware,   ...result.hardware],
      }
      for (const c of result.connectors) project = applyConnectorOps(project, c)
      for (const h of result.hardware)   project = applyHingeOps(project, h)
      return {
        project,
        selection: result.panels[0] ? { type: 'panel', id: result.panels[0].id } : s.selection,
      }
    }),

  addCabinet: (type) => {
    const { project } = get()
    const materialId = project.materials[0]?.id ?? ''
    const roomId = project.rooms[0]?.id ?? ''
    const existingNames = project.cabinets.map((c) => c.name)
    const baseName = type === 'base' ? 'szafka dolna' : type === 'wall' ? 'szafka wisząca' : 'szafka stojąca'
    const cabinet = createCabinet(type, materialId, roomId)
    cabinet.name = uniqueName(existingNames, baseName)
    const derived = generateCabinetFromObj(cabinet)
    set((s) => ({
      project: { ...s.project, cabinets: [...s.project.cabinets, cabinet] },
      cabinetDerived: { ...s.cabinetDerived, [cabinet.id]: derived },
      selection: { type: 'cabinet', id: cabinet.id },
    }))
    return cabinet.id
  },

  updateCabinet: (id, patch) =>
    set((s) => {
      const cabinets = s.project.cabinets.map((c) => c.id === id ? { ...c, ...patch } : c)
      const updated = cabinets.find((c) => c.id === id)
      const derived = updated ? generateCabinetFromObj(updated) : s.cabinetDerived[id]
      return {
        project: { ...s.project, cabinets },
        cabinetDerived: { ...s.cabinetDerived, [id]: derived },
      }
    }),

  moveCabinet: (id, position) =>
    set((s) => {
      const cabinets = s.project.cabinets.map((c) => c.id === id ? { ...c, position } : c)
      const updated = cabinets.find((c) => c.id === id)
      const derived = updated ? generateCabinetFromObj(updated) : s.cabinetDerived[id]
      return {
        project: { ...s.project, cabinets },
        cabinetDerived: { ...s.cabinetDerived, [id]: derived },
      }
    }),

  removeCabinet: (id) =>
    set((s) => {
      const cabinetDerived = { ...s.cabinetDerived }
      delete cabinetDerived[id]
      return {
        project: { ...s.project, cabinets: s.project.cabinets.filter((c) => c.id !== id) },
        cabinetDerived,
        selection: s.selection?.type === 'cabinet' && s.selection.id === id ? null : s.selection,
      }
    }),

  addMaterial: () =>
    set((s) => ({
      project: {
        ...s.project,
        materials: [
          ...s.project.materials,
          createMaterial({ name: `Materiał ${s.project.materials.length + 1}` }),
        ],
      },
    })),

  updateMaterial: (id, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        materials: s.project.materials.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      },
    })),

  updateSettings: (patch) =>
    set((s) => ({ project: { ...s.project, settings: { ...s.project.settings, ...patch } } })),

  setProjectName: (name) => set((s) => ({ project: { ...s.project, name } })),

  loadProject: (project) => {
    const migrated = regenerateGeneratedOps(project)
    set({ project: migrated, cabinetDerived: buildCabinetDerived(migrated), selection: null })
  },

  newProject: () => {
    const fresh = createDefaultProject()
    set({ project: fresh, cabinetDerived: {}, selection: null })
  },
}))

// --- Autosave: debounce zapisu Project do localStorage przy każdej zmianie ---
let saveTimer: ReturnType<typeof setTimeout> | undefined
useProjectStore.subscribe((state) => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveToLocalStorage(state.project), 400)
})

// --- Sanity (tylko DEV) ------------------------------------------------------
if (import.meta.env.DEV) {
  const r1 = sanityEdgeAnchorParity()
  console[r1.ok ? 'info' : 'error'](`[sanity] anchor łącznika = ręczny otwór (czoło) — ${r1.detail}`)
  const r2 = sanityBackFaceAnchor()
  console[r2.ok ? 'info' : 'error'](`[sanity] anchor na licu 'back' z obrotem — ${r2.detail}`)
  const r3 = sanityHingeEmit()
  console[r3.ok ? 'info' : 'error'](`[sanity] zawias emituje puszkę+prowadnik — ${r3.detail}`)
  const r4 = sanityCamParamMapping()
  console[r4.ok ? 'info' : 'error'](`[sanity] cam klucz→otwór (puszka/trzpień/dojście) — ${r4.detail}`)
  const r5 = sanityCabinetGenerate()
  console[r5.ok ? 'info' : 'error'](`[sanity] cabinet-templates generate — ${r5.detail}`)
}
