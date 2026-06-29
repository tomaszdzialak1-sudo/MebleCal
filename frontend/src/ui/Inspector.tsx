import { useState, useRef, useEffect } from 'react'
import { useProjectStore } from '../store/projectStore'
import {
  contourSize,
  contourToTrapezoid,
  isRectangleContour,
  panelLocalCenter,
  type TrapezoidParams,
} from '../model/factories'
import type { ConnectorType, OperationType, Panel, Room, Vec3 } from '../model/types'
import { wouldCollide } from '../model/obb'
import { wouldLeaveRoom } from '../model/collisions'
import { localToWorld, rotateDir } from '../model/transform'
import { worldToRoomCoords, roomCoordsToWorld } from '../model/roomCoords'
import { Field, SectionTitle } from './widgets/Field'
import { NumberInput } from './widgets/NumberInput'
import { ColorInput } from './widgets/ColorInput'
import { TextInput } from './widgets/TextInput'
import { OperationEditor } from './OperationEditor'
import { ConnectorEditor } from './ConnectorEditor'
import { HingeEditor } from './HingeEditor'
import { CabinetEditor } from './CabinetEditor'
import { CONNECTOR_TYPE_LABEL, edgeLabel, faceLabel, OP_TYPE_LABEL } from './labels'

const selectCls =
  'rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-sm'

export function Inspector() {
  const selection = useProjectStore((s) => s.selection)
  const project = useProjectStore((s) => s.project)

  let body = (
    <p className="text-sm text-neutral-500">
      Zaznacz płytę lub pomieszczenie (klik w scenie albo w drzewie).
    </p>
  )
  if (selection?.type === 'panel') {
    const panel = project.panels.find((p) => p.id === selection.id)
    if (panel) body = <PanelInspector key={panel.id} panel={panel} />
  } else if (selection?.type === 'room') {
    const room = project.rooms.find((r) => r.id === selection.id)
    if (room) body = <RoomInspector room={room} />
  } else if (selection?.type === 'connector') {
    const connector = project.connectors.find((c) => c.id === selection.id)
    if (connector) body = <ConnectorEditor key={connector.id} connector={connector} />
  } else if (selection?.type === 'hardware') {
    const hardware = project.hardware.find((h) => h.id === selection.id)
    if (hardware) body = <HingeEditor key={hardware.id} hardware={hardware} />
  } else if (selection?.type === 'cabinet') {
    const cabinet = project.cabinets.find((c) => c.id === selection.id)
    if (cabinet) body = <CabinetEditor key={cabinet.id} cabinet={cabinet} />
  }

  return (
    <aside className="w-72 flex-shrink-0 overflow-y-auto border-l border-neutral-800 bg-neutral-900 p-3">
      <SectionTitle>Inspektor</SectionTitle>
      {body}
    </aside>
  )
}

function PanelInspector({ panel }: { panel: Panel }) {
  const project = useProjectStore((s) => s.project)
  const updateFields = useProjectStore((s) => s.updatePanelFields)
  const updateTransform = useProjectStore((s) => s.updatePanelTransform)
  const updateDimensions = useProjectStore((s) => s.updatePanelDimensions)
  const updateGrain = useProjectStore((s) => s.updatePanelGrain)
  const setTrapezoid = useProjectStore((s) => s.setTrapezoid)
  const updateEdge = useProjectStore((s) => s.updateEdge)
  const setAllBanding = useProjectStore((s) => s.setAllBanding)

  // Tryb kształtu — lokalny stan UI (model trzyma tylko kontur). Reseed per płyta
  // dzięki key={panel.id} w rodzicu.
  const [shape, setShape] = useState<'rect' | 'trapez'>(
    isRectangleContour(panel.contour) ? 'rect' : 'trapez',
  )

  const { w, h } = contourSize(panel.contour)
  const trap = contourToTrapezoid(panel.contour)
  const setTrap = (patch: Partial<TrapezoidParams>) => setTrapezoid(panel.id, { ...trap, ...patch })

  const pos = panel.transform.position
  const rot = panel.transform.rotation

  // Collision stop dla Inspektora: Alt bypass (ten sam jak w SceneCanvas).
  const altRef = useRef(false)
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Alt') altRef.current = true }
    const up = (e: KeyboardEvent) => { if (e.key === 'Alt') altRef.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])
  const [warnMsg, setWarnMsg] = useState<string | null>(null)

  const trySetTransform = (newTransform: { position: Vec3; rotation: Vec3 }) => {
    if (!altRef.current) {
      const others = project.panels.filter((p) => p.id !== panel.id)
      if (wouldCollide(panel, newTransform, others)) {
        setWarnMsg('Pozycja/obrót powoduje kolizję')
        return
      }
      if (wouldLeaveRoom(panel, newTransform, project.rooms)) {
        setWarnMsg('Poza pomieszczeniem')
        return
      }
    }
    setWarnMsg(null)
    updateTransform(panel.id, newTransform)
  }

  const setRot = (i: number, v: number) => {
    const next = [...rot] as Vec3
    next[i] = v
    // Obrót wokół geometrycznego środka bryły: zachowaj worldCenter, przelicz pivot.
    // Środek liczymy z bieżącego transform płyty (nie z refa gizma).
    const lc = panelLocalCenter(panel)
    const worldCenter = localToWorld({ position: pos, rotation: rot }, lc)
    const rotated = rotateDir(next, lc)
    const newPos: Vec3 = [
      worldCenter[0] - rotated[0],
      worldCenter[1] - rotated[1],
      worldCenter[2] - rotated[2],
    ]
    trySetTransform({ position: newPos, rotation: next })
  }
  // +90/−90 z zawinięciem do (−180, 180].
  const wrap180 = (v: number) => ((((v + 180) % 360) + 360) % 360) - 180
  const bumpRot = (i: number, d: number) => setRot(i, wrap180(rot[i] + d))

  const material = project.materials.find((m) => m.id === panel.materialId)
  const bandingType = material?.defaultBanding ?? 'obrzeże'

  const switchShape = (next: 'rect' | 'trapez') => {
    setShape(next)
    if (next === 'rect') updateDimensions(panel.id, w, h) // znormalizuj do prostokąta
  }

  return (
    <div>
      <Field label="Nazwa">
        <TextInput value={panel.name} onChange={(name) => updateFields(panel.id, { name })} className="w-36" />
      </Field>
      <Field label="Materiał">
        <select
          className={`w-36 ${selectCls}`}
          value={panel.materialId}
          onChange={(e) => updateFields(panel.id, { materialId: e.target.value })}
        >
          {project.materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Grubość">
        <NumberInput value={panel.thickness} min={1} onChange={(thickness) => updateFields(panel.id, { thickness })} />
      </Field>

      <SectionTitle>Kształt</SectionTitle>
      <Field label="Typ">
        <select
          className={selectCls}
          value={shape}
          onChange={(e) => switchShape(e.target.value as 'rect' | 'trapez')}
        >
          <option value="rect">prostokąt</option>
          <option value="trapez">trapez</option>
        </select>
      </Field>

      {shape === 'rect' ? (
        <>
          <Field label="Szerokość">
            <NumberInput value={w} min={1} onChange={(nw) => updateDimensions(panel.id, nw, h)} />
          </Field>
          <Field label="Wysokość">
            <NumberInput value={h} min={1} onChange={(nh) => updateDimensions(panel.id, w, nh)} />
          </Field>
        </>
      ) : (
        <>
          <Field label="Szer. dolna">
            <NumberInput value={trap.bottomWidth} min={1} onChange={(v) => setTrap({ bottomWidth: v })} />
          </Field>
          <Field label="Szer. górna">
            <NumberInput value={trap.topWidth} min={1} onChange={(v) => setTrap({ topWidth: v })} />
          </Field>
          <Field label="Przesun. góry">
            <NumberInput value={trap.topOffset} onChange={(v) => setTrap({ topOffset: v })} />
          </Field>
          <Field label="Wysokość">
            <NumberInput value={trap.height} min={1} onChange={(v) => setTrap({ height: v })} />
          </Field>
        </>
      )}

      <SectionTitle>Krawędzie (ukos + obrzeże)</SectionTitle>
      <div className="mb-1 flex gap-1">
        <button
          className="rounded border border-neutral-700 px-1.5 py-0.5 text-xs hover:bg-neutral-800"
          onClick={() => setAllBanding(panel.id, bandingType)}
        >
          Obrzeże: wszystkie
        </button>
        <button
          className="rounded border border-neutral-700 px-1.5 py-0.5 text-xs hover:bg-neutral-800"
          onClick={() => setAllBanding(panel.id, null)}
        >
          Zdejmij
        </button>
      </div>
      {panel.edges.map((edge, i) => (
        <div key={i} className="mb-1 rounded border border-neutral-800 px-1.5 py-1">
          <div className="mb-0.5 text-xs text-neutral-400">{edgeLabel(i, panel.edges.length)}</div>
          <Field label="cutAngle">
            <NumberInput
              value={edge.cutAngle}
              min={30}
              max={150}
              unit="°"
              onChange={(cutAngle) => updateEdge(panel.id, i, { cutAngle })}
            />
          </Field>
          <Field label="Obrzeże">
            <select
              className={selectCls}
              value={edge.bandingType ? 'on' : 'off'}
              onChange={(e) =>
                updateEdge(panel.id, i, {
                  bandingType: e.target.value === 'on' ? bandingType : undefined,
                })
              }
            >
              <option value="off">brak</option>
              <option value="on">{bandingType}</option>
            </select>
          </Field>
        </div>
      ))}

      <OperationsSection panel={panel} />
      <ConnectorsSection panel={panel} />
      <HardwareSection panel={panel} />

      {warnMsg && (
        <p className="mb-1 text-xs text-red-400">{warnMsg}</p>
      )}
      <SectionTitle>Pozycja w pokoju (mm)</SectionTitle>
      <Field label="Pokój">
        <select
          className={`w-36 ${selectCls}`}
          value={panel.roomId}
          onChange={(e) => updateFields(panel.id, { roomId: e.target.value })}
        >
          {project.rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </Field>
      {(() => {
        const room = project.rooms.find((r) => r.id === panel.roomId)
        if (!room) return <p className="px-1 text-xs text-neutral-500">brak pokoju</p>
        const rc = worldToRoomCoords(panel, room)
        const r1 = (v: number) => Math.round(v * 10) / 10
        const setRoomCoord = (axis: 'x' | 'y' | 'z', v: number) => {
          const next = { ...rc, [axis]: v }
          const newPos = roomCoordsToWorld(next, panel, room)
          trySetTransform({ position: newPos, rotation: rot })
        }
        return (
          <>
            <Field label="X od lewej"><NumberInput value={r1(rc.x)} onChange={(v) => setRoomCoord('x', v)} /></Field>
            <Field label="Y od podłogi"><NumberInput value={r1(rc.y)} onChange={(v) => setRoomCoord('y', v)} /></Field>
            <Field label="Z od przodu"><NumberInput value={r1(rc.z)} onChange={(v) => setRoomCoord('z', v)} /></Field>
          </>
        )
      })()}

      <SectionTitle>Obrót (°)</SectionTitle>
      {(['X', 'Y', 'Z'] as const).map((axis, i) => (
        <Field key={axis} label={axis}>
          <div className="flex items-center gap-1">
            <NumberInput value={rot[i]} unit="°" onChange={(v) => setRot(i, v)} />
            <button
              className="rounded border border-neutral-700 px-1 text-xs hover:bg-neutral-800"
              title={`${axis} −90°`}
              onClick={() => bumpRot(i, -90)}
            >
              −90
            </button>
            <button
              className="rounded border border-neutral-700 px-1 text-xs hover:bg-neutral-800"
              title={`${axis} +90°`}
              onClick={() => bumpRot(i, 90)}
            >
              +90
            </button>
          </div>
        </Field>
      ))}

      <SectionTitle>Obróbka</SectionTitle>
      <Field label="Lico bazowe">
        <select
          className={selectCls}
          value={panel.baseFace}
          onChange={(e) => updateFields(panel.id, { baseFace: e.target.value as 'front' | 'back' })}
        >
          <option value="front">front</option>
          <option value="back">back</option>
        </select>
      </Field>
      <Field label="Usłojenie">
        <select
          className={selectCls}
          value={panel.grain ? String(panel.grain.direction) : 'none'}
          onChange={(e) =>
            updateGrain(panel.id, e.target.value === 'none' ? null : (Number(e.target.value) as 0 | 90))
          }
        >
          <option value="none">brak</option>
          <option value="0">wzdłuż (0°)</option>
          <option value="90">wszerz (90°)</option>
        </select>
      </Field>
    </div>
  )
}

const OP_BUTTONS: { type: OperationType; label: string }[] = [
  { type: 'hole', label: '+ Otwór' },
  { type: 'groove', label: '+ Frez' },
  { type: 'cutout', label: '+ Wycięcie' },
  { type: 'pocket', label: '+ Kieszeń' },
]

function OperationsSection({ panel }: { panel: Panel }) {
  const addOperation = useProjectStore((s) => s.addOperation)
  const removeOperation = useProjectStore((s) => s.removeOperation)
  const [expanded, setExpanded] = useState<string | null>(null)
  const nEdges = panel.edges.length
  const add = (type: OperationType) => setExpanded(addOperation(panel.id, type))

  return (
    <>
      <SectionTitle>Operacje ({panel.operations.length})</SectionTitle>
      <div className="mb-1 grid grid-cols-2 gap-1">
        {OP_BUTTONS.map((b) => (
          <button
            key={b.type}
            className="rounded border border-neutral-700 px-1.5 py-0.5 text-xs hover:bg-neutral-800"
            onClick={() => add(b.type)}
          >
            {b.label}
          </button>
        ))}
      </div>
      {panel.operations.length === 0 && (
        <div className="px-1 py-0.5 text-xs text-neutral-600">brak operacji</div>
      )}
      {panel.operations.map((op) => (
        <div key={op.id} className="mb-1 rounded border border-neutral-800">
          <div className="flex items-center">
            <button
              className="flex-1 px-1.5 py-1 text-left text-sm hover:bg-neutral-800"
              onClick={() => setExpanded(expanded === op.id ? null : op.id)}
            >
              {OP_TYPE_LABEL[op.type]} · {faceLabel(op.face, nEdges)}
            </button>
            <button
              className="px-1.5 text-neutral-500 hover:text-red-400"
              title="Usuń operację"
              onClick={() => {
                removeOperation(panel.id, op.id)
                if (expanded === op.id) setExpanded(null)
              }}
            >
              ✕
            </button>
          </div>
          {expanded === op.id && (
            <div className="px-1.5 pb-1.5">
              <OperationEditor panelId={panel.id} op={op} nEdges={nEdges} contour={panel.contour} />
            </div>
          )}
        </div>
      ))}
    </>
  )
}

const CONNECTOR_TYPES: ConnectorType[] = ['dowel', 'confirmat', 'cam']

/** Tworzenie łącznika: ta płyta + wybrana. Role lico/czoło dobiera AUTOMAT z 3D. */
function ConnectorsSection({ panel }: { panel: Panel }) {
  const project = useProjectStore((s) => s.project)
  const addConnector = useProjectStore((s) => s.addConnector)
  const select = useProjectStore((s) => s.select)
  const [type, setType] = useState<ConnectorType>('dowel')
  const others = project.panels.filter((p) => p.id !== panel.id)
  const [target, setTarget] = useState<string>(others[0]?.id ?? '')

  const linked = project.connectors.filter((c) => c.panelA === panel.id || c.panelB === panel.id)
  const targetValid = others.some((p) => p.id === target)

  return (
    <>
      <SectionTitle>Łączniki ({linked.length})</SectionTitle>
      {others.length === 0 ? (
        <div className="px-1 py-0.5 text-xs text-neutral-600">dodaj drugą płytę, by łączyć</div>
      ) : (
        <div className="mb-1 flex flex-wrap items-center gap-1">
          <select
            className={selectCls}
            value={type}
            onChange={(e) => setType(e.target.value as ConnectorType)}
          >
            {CONNECTOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONNECTOR_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">do</span>
          <select className={selectCls} value={target} onChange={(e) => setTarget(e.target.value)}>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            className="rounded border border-neutral-700 px-1.5 py-0.5 text-xs hover:bg-neutral-800 disabled:opacity-40"
            disabled={!targetValid}
            onClick={() => select({ type: 'connector', id: addConnector(type, panel.id, target) })}
          >
            + Dodaj
          </button>
        </div>
      )}
      {linked.map((c) => {
        const other = c.panelA === panel.id ? c.panelB : c.panelA
        const otherName = project.panels.find((p) => p.id === other)?.name ?? '?'
        const role = c.panelA === panel.id ? 'lico' : 'czoło'
        return (
          <button
            key={c.id}
            className="mb-0.5 block w-full truncate rounded border border-neutral-800 px-1.5 py-0.5 text-left text-xs hover:bg-neutral-800"
            onClick={() => select({ type: 'connector', id: c.id })}
          >
            {CONNECTOR_TYPE_LABEL[c.type]} · {role} ↔ {otherName}
          </button>
        )
      })}
    </>
  )
}

/** Tworzenie zawiasu: ta płyta = front (drzwi), wybrana = bok. */
const HINGE_PRESETS = [
  { id: 'clip-top-blumotion-110', label: 'CLIP top BLUMOTION 110°' },
] as const

function HardwareSection({ panel }: { panel: Panel }) {
  const project = useProjectStore((s) => s.project)
  const addHardware = useProjectStore((s) => s.addHardware)
  const select = useProjectStore((s) => s.select)
  const others = project.panels.filter((p) => p.id !== panel.id)
  const [target, setTarget] = useState<string>(others[0]?.id ?? '')
  const [preset, setPreset] = useState<(typeof HINGE_PRESETS)[number]['id']>(HINGE_PRESETS[0].id)

  const linked = project.hardware.filter(
    (h) => h.hinge?.doorPanel === panel.id || h.hinge?.sidePanel === panel.id,
  )
  const targetValid = others.some((p) => p.id === target)

  return (
    <>
      <SectionTitle>Zawiasy ({linked.length})</SectionTitle>
      {others.length === 0 ? (
        <div className="px-1 py-0.5 text-xs text-neutral-600">dodaj bok, by zawiesić front</div>
      ) : (
        <div className="mb-1 flex flex-wrap items-center gap-1">
          <select
            className={selectCls}
            value={preset}
            onChange={(e) => setPreset(e.target.value as (typeof HINGE_PRESETS)[number]['id'])}
          >
            {HINGE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">front → bok</span>
          <select className={selectCls} value={target} onChange={(e) => setTarget(e.target.value)}>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            className="rounded border border-neutral-700 px-1.5 py-0.5 text-xs hover:bg-neutral-800 disabled:opacity-40"
            disabled={!targetValid}
            onClick={() => select({ type: 'hardware', id: addHardware(panel.id, target) })}
          >
            + Zawias
          </button>
        </div>
      )}
      {linked.map((h) => {
        const isFront = h.hinge?.doorPanel === panel.id
        const otherId = isFront ? h.hinge?.sidePanel : h.hinge?.doorPanel
        const otherName = project.panels.find((p) => p.id === otherId)?.name ?? '?'
        return (
          <button
            key={h.id}
            className="mb-0.5 block w-full truncate rounded border border-neutral-800 px-1.5 py-0.5 text-left text-xs hover:bg-neutral-800"
            onClick={() => select({ type: 'hardware', id: h.id })}
          >
            Zawias · {isFront ? 'front' : 'bok'} ↔ {otherName} (×{h.hinge?.placement.length ?? 0})
          </button>
        )
      })}
    </>
  )
}

function RoomInspector({ room }: { room: Room }) {
  const setDimensions = useProjectStore((s) => s.setRoomDimensions)
  const setColor = useProjectStore((s) => s.setRoomColor)

  const w = room.floor.size[0]
  const d = room.floor.size[1]
  const h = room.walls.reduce((m, x) => Math.max(m, x.size[1]), 0) || 2600

  return (
    <div>
      <p className="mb-1 text-sm text-neutral-300">{room.name}</p>

      <SectionTitle>Wymiary (mm)</SectionTitle>
      <Field label="Szerokość (X)"><NumberInput value={w} min={1} onChange={(v) => setDimensions(room.id, v, d, h)} /></Field>
      <Field label="Głębokość (Y)"><NumberInput value={d} min={1} onChange={(v) => setDimensions(room.id, w, v, h)} /></Field>
      <Field label="Wysokość (Z)"><NumberInput value={h} min={1} onChange={(v) => setDimensions(room.id, w, d, v)} /></Field>

      <SectionTitle>Kolory</SectionTitle>
      <Field label="Ściany"><ColorInput value={room.walls[0]?.color ?? '#dcd7c9'} onChange={(c) => setColor(room.id, 'walls', c)} /></Field>
      <Field label="Podłoga"><ColorInput value={room.floor.color} onChange={(c) => setColor(room.id, 'floor', c)} /></Field>
      <Field label="Sufit"><ColorInput value={room.ceiling.color} onChange={(c) => setColor(room.id, 'ceiling', c)} /></Field>
    </div>
  )
}
