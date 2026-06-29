import { useProjectStore } from '../store/projectStore'
import { contourCenter, rectPath, segmentPath } from '../model/factories'
import type { Operation, OperationFace, Vec2 } from '../model/types'
import { edgeLabel } from './labels'
import { Field } from './widgets/Field'
import { NumberInput } from './widgets/NumberInput'
import { Checkbox } from './widgets/Checkbox'
import { PathEditor } from './widgets/PathEditor'

const selectCls = 'rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-sm'
const miniBtn = 'rounded border border-neutral-700 px-1.5 py-0.5 text-xs hover:bg-neutral-800'

const faceToValue = (f: OperationFace) => (typeof f === 'string' ? f : `edge:${f.edge}`)
const valueToFace = (v: string): OperationFace =>
  v === 'front' || v === 'back' ? v : { edge: Number(v.split(':')[1]) }

/** Odczyt parametrów odcinka z 2-punktowej ścieżki (dla helpera frezu LED). */
function deriveSegment(path: Vec2[]): { start: Vec2; length: number; axis: 'x' | 'y' } {
  const a = path[0] ?? [0, 0]
  const b = path[1] ?? a
  const axis: 'x' | 'y' = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 'x' : 'y'
  return { start: a, length: axis === 'x' ? b[0] - a[0] : b[1] - a[1], axis }
}

interface Props {
  panelId: string
  op: Operation
  nEdges: number
  contour: Vec2[]
}

export function OperationEditor({ panelId, op, nEdges, contour }: Props) {
  const updateOperation = useProjectStore((s) => s.updateOperation)
  const updateParams = useProjectStore((s) => s.updateOperationParams)

  const onEdge = typeof op.face !== 'string'

  return (
    <div className="mt-1 border-t border-neutral-800 pt-2">
      <Field label={op.type === 'hole' ? 'Lico / krawędź' : 'Lico'}>
        <select
          className={selectCls}
          value={faceToValue(op.face)}
          onChange={(e) => updateOperation(panelId, op.id, { face: valueToFace(e.target.value) })}
        >
          <option value="front">front</option>
          <option value="back">back</option>
          {/* Krawędź (czoło) dozwolona tylko dla otworu — frez/wycięcie/kieszeń bez sensu na czole. */}
          {op.type === 'hole' &&
            Array.from({ length: nEdges }, (_, i) => (
              <option key={i} value={`edge:${i}`}>
                {edgeLabel(i, nEdges)} (czoło)
              </option>
            ))}
        </select>
      </Field>
      <Field label="Warstwa DXF">
        <input
          className="w-24 rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-right text-sm"
          value={op.dxfLayer}
          onChange={(e) => updateOperation(panelId, op.id, { dxfLayer: e.target.value })}
        />
      </Field>

      {op.type === 'hole' && op.hole && (
        <>
          <Field label={onEdge ? 'wzdłuż krawędzi' : 'X'}>
            <NumberInput value={op.hole.x} onChange={(x) => updateParams(panelId, op.id, { x })} />
          </Field>
          <Field label={onEdge ? 'przez grubość' : 'Y'}>
            <NumberInput value={op.hole.y} onChange={(y) => updateParams(panelId, op.id, { y })} />
          </Field>
          <Field label="Średnica">
            <NumberInput value={op.hole.diameter} min={0.1} onChange={(diameter) => updateParams(panelId, op.id, { diameter })} />
          </Field>
          <Field label="Przelot">
            <Checkbox checked={!!op.hole.through} onChange={(through) => updateParams(panelId, op.id, { through })} />
          </Field>
          {!op.hole.through && (
            <Field label="Głębokość">
              <NumberInput value={op.hole.depth} min={0} onChange={(depth) => updateParams(panelId, op.id, { depth })} />
            </Field>
          )}
        </>
      )}

      {op.type === 'groove' && op.groove && (
        <GrooveFields panelId={panelId} op={op} update={updateParams} />
      )}

      {op.type === 'cutout' && op.cutout && (
        <>
          <Field label="Przelot">
            <Checkbox checked={!!op.cutout.through} onChange={(through) => updateParams(panelId, op.id, { through })} />
          </Field>
          {!op.cutout.through && (
            <Field label="Głębokość">
              <NumberInput value={op.cutout.depth} min={0} onChange={(depth) => updateParams(panelId, op.id, { depth })} />
            </Field>
          )}
          <button className={miniBtn} onClick={() => updateParams(panelId, op.id, rectHelper(contour))}>
            wstaw prostokąt
          </button>
          <PathEditor value={op.cutout.path} onChange={(path) => updateParams(panelId, op.id, { path })} />
        </>
      )}

      {op.type === 'pocket' && op.pocket && (
        <>
          <Field label="Głębokość">
            <NumberInput value={op.pocket.depth} min={0} onChange={(depth) => updateParams(panelId, op.id, { depth })} />
          </Field>
          <button className={miniBtn} onClick={() => updateParams(panelId, op.id, rectHelper(contour))}>
            wstaw prostokąt
          </button>
          <PathEditor value={op.pocket.path} onChange={(path) => updateParams(panelId, op.id, { path })} />
        </>
      )}
    </div>
  )
}

/** Prostokąt 200×100 wokół środka konturu (helper cutout/pocket). */
function rectHelper(contour: Vec2[]): { path: Vec2[] } {
  const [cx, cy] = contourCenter(contour)
  return { path: rectPath(cx - 100, cy - 50, 200, 100) }
}

function GrooveFields({
  panelId,
  op,
  update,
}: {
  panelId: string
  op: Operation
  update: ReturnType<typeof useProjectStore.getState>['updateOperationParams']
}) {
  if (!op.groove) return null
  const seg = deriveSegment(op.groove.path)
  const setSeg = (patch: Partial<{ start: Vec2; length: number; axis: 'x' | 'y' }>) => {
    const next = { ...seg, ...patch }
    update(panelId, op.id, { path: segmentPath(next.start, next.length, next.axis) })
  }

  return (
    <>
      <Field label="Szerokość">
        <NumberInput value={op.groove.width} min={0.1} onChange={(width) => update(panelId, op.id, { width })} />
      </Field>
      <Field label="Głębokość">
        <NumberInput value={op.groove.depth} min={0} onChange={(depth) => update(panelId, op.id, { depth })} />
      </Field>

      <div className="mt-1 text-xs text-neutral-500">Prosty odcinek (frez LED)</div>
      <Field label="Start X">
        <NumberInput value={seg.start[0]} onChange={(v) => setSeg({ start: [v, seg.start[1]] })} />
      </Field>
      <Field label="Start Y">
        <NumberInput value={seg.start[1]} onChange={(v) => setSeg({ start: [seg.start[0], v] })} />
      </Field>
      <Field label="Długość">
        <NumberInput value={seg.length} onChange={(length) => setSeg({ length })} />
      </Field>
      <Field label="Oś">
        <select className={selectCls} value={seg.axis} onChange={(e) => setSeg({ axis: e.target.value as 'x' | 'y' })}>
          <option value="x">X (pozioma)</option>
          <option value="y">Y (pionowa)</option>
        </select>
      </Field>

      <PathEditor value={op.groove.path} onChange={(path) => update(panelId, op.id, { path })} />
    </>
  )
}
