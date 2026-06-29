import { useProjectStore } from '../store/projectStore'
import type { Connector, ConnectorType } from '../model/types'
import { CAM_PARAMS, autoCamFace, debugConnectorAnchor, deriveConnectorAnchor, detectRoles, pickContactEdge } from '../model/connectors'
import { isMiterEdge } from '../model/snapping'
import { Field, SectionTitle } from './widgets/Field'
import { NumberInput } from './widgets/NumberInput'
import { CONNECTOR_TYPE_LABEL, edgeLabel } from './labels'

const selectCls = 'rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-sm'

const TYPES: ConnectorType[] = ['dowel', 'confirmat', 'cam']

// Parametry strojenia widoczne w UI (klucz w params → etykieta + default).
// Cam (mimośród) ma JEDNO źródło prawdy w connectors.ts (CAM_PARAMS) — dzieli je
// z emiterem, więc etykieta nie odklei się od otworu, którym steruje.
const PARAM_FIELDS: Record<'dowel' | 'confirmat', { key: string; label: string; dflt: number }[]> = {
  dowel: [
    { key: 'diameter', label: 'Ø kołka', dflt: 8 },
    { key: 'depthA', label: 'Głęb. w licu A', dflt: 12 },
    { key: 'depthB', label: 'Głęb. w czole B', dflt: 30 },
  ],
  confirmat: [
    { key: 'diameter', label: 'Ø przelot A', dflt: 7 },
    { key: 'headDiameter', label: 'Ø łba', dflt: 10 },
    { key: 'pilotDiameter', label: 'Ø pilot B', dflt: 5 },
    { key: 'depthB', label: 'Głęb. pilota B', dflt: 50 },
  ],
}

export function ConnectorEditor({ connector }: { connector: Connector }) {
  const project = useProjectStore((s) => s.project)
  const update = useProjectStore((s) => s.updateConnector)
  const swapSides = useProjectStore((s) => s.swapConnectorSides)

  const panelA = project.panels.find((p) => p.id === connector.panelA)
  const panelB = project.panels.find((p) => p.id === connector.panelB)
  const nEdgesB = panelB?.contour.length ?? 4
  const paramFields = connector.type === 'cam' ? CAM_PARAMS : PARAM_FIELDS[connector.type]
  // Czy automat wykrywa role inaczej niż zapisana kolejność A=lico/B=czoło?
  const roles = panelA && panelB ? detectRoles(panelA, panelB) : null
  const rolesReversed = !!roles && !roles.ambiguous && roles.facePanel.id !== connector.panelA

  const setPlacement = (patch: Partial<Connector['placement']>) =>
    update(connector.id, { placement: { ...connector.placement, ...patch } })
  const setParam = (key: string, value: number) =>
    update(connector.id, { params: { ...connector.params, [key]: value } })

  const anchor = panelA && panelB ? deriveConnectorAnchor(panelA, panelB, connector.placement) : null
  const autoFace = panelA && panelB ? autoCamFace(panelA, panelB) : 'front'
  const usingAbsolute = !!connector.placement.absolute
  const miter = !!panelB && isMiterEdge(panelB, connector.placement.fromEdge)

  return (
    <div>
      <Field label="Typ">
        <select
          className={selectCls}
          value={connector.type}
          onChange={(e) => update(connector.id, { type: e.target.value as ConnectorType })}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {CONNECTOR_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>

      {/* Role lico/czoło wykrywa program z 3D. Dla mimośrodu: lico dostaje trzpień,
          a płyta dochodząca czołem dostaje puszkę + otwór dojściowy. */}
      <Field label="Lico (trzpień)">
        <span className="text-sm text-neutral-200">{panelA?.name ?? '—'}</span>
      </Field>
      <Field label="Czoło (puszka+dojście)">
        <span className="text-sm text-neutral-200">{panelB?.name ?? '—'}</span>
      </Field>
      <button
        className="mb-1 rounded border border-neutral-700 px-1.5 py-0.5 text-xs hover:bg-neutral-800"
        title="Odwrotny montaż: zamień rolę lico↔czoło (trzpień i puszka zamienią płyty)"
        onClick={() => swapSides(connector.id)}
      >
        ⇄ Zamień strony
      </button>
      {rolesReversed && (
        <div className="mb-1 text-xs text-amber-400">
          ⚠ automat wykrywa odwrotny styk — rozważ „Zamień strony"
        </div>
      )}

      {connector.type === 'cam' && (
        <Field label="Strona puszki">
          <select
            className={selectCls}
            value={connector.camFace ?? 'auto'}
            onChange={(e) =>
              update(connector.id, {
                camFace: e.target.value === 'auto' ? undefined : (e.target.value as 'front' | 'back'),
              })
            }
          >
            <option value="auto">auto (= {autoFace})</option>
            <option value="front">front</option>
            <option value="back">back</option>
          </select>
        </Field>
      )}

      <SectionTitle>Pozycja (na krawędzi B)</SectionTitle>
      <Field label="Krawędź B">
        <select
          className={selectCls}
          value={connector.placement.fromEdge}
          onChange={(e) => setPlacement({ fromEdge: Number(e.target.value) })}
        >
          {Array.from({ length: nEdgesB }, (_, i) => (
            <option key={i} value={i}>
              {edgeLabel(i, nEdgesB)}
            </option>
          ))}
        </select>
      </Field>
      {panelA && panelB && (
        <button
          className="mb-1 rounded border border-neutral-700 px-1.5 py-0.5 text-xs hover:bg-neutral-800"
          title="Wybierz krawędź B najlepiej stykającą się z licem A (min. szczelina)"
          onClick={() => setPlacement(pickContactEdge(panelA, panelB))}
        >
          🎯 Dobierz krawędź styku
        </button>
      )}
      <Field label="Offset (wzdłuż)">
        <NumberInput
          value={connector.placement.offset}
          onChange={(offset) => setPlacement({ offset })}
        />
      </Field>

      <Field label="Nadpisz ręcznie">
        <input
          type="checkbox"
          checked={usingAbsolute}
          onChange={(e) =>
            setPlacement({
              absolute: e.target.checked
                ? [connector.placement.offset, (panelB?.thickness ?? 18) / 2]
                : undefined,
            })
          }
        />
      </Field>
      {usingAbsolute && connector.placement.absolute && (
        <>
          <Field label="abs. wzdłuż">
            <NumberInput
              value={connector.placement.absolute[0]}
              onChange={(v) => setPlacement({ absolute: [v, connector.placement.absolute![1]] })}
            />
          </Field>
          <Field label="abs. przez grubość">
            <NumberInput
              value={connector.placement.absolute[1]}
              onChange={(v) => setPlacement({ absolute: [connector.placement.absolute![0], v] })}
            />
          </Field>
        </>
      )}

      <SectionTitle>Parametry (Ø/głęb. — strojenie)</SectionTitle>
      {paramFields.map((f) => (
        <Field key={f.key} label={f.label}>
          <NumberInput
            value={connector.params?.[f.key] ?? f.dflt}
            min={f.key === 'camEdgeDistance' ? 0 : 0.1}
            onChange={(v) => setParam(f.key, v)}
          />
        </Field>
      ))}

      <SectionTitle>Wyliczenia</SectionTitle>
      {!anchor ? (
        <p className="text-xs text-amber-400">Brak którejś z płyt.</p>
      ) : (
        <div className="text-xs text-neutral-400">
          <div>
            lico A: <span className="text-neutral-200">{anchor.faceA}</span> · xA{' '}
            {anchor.xA.toFixed(1)} · yA {anchor.yA.toFixed(1)} · zA {anchor.zA.toFixed(1)}
          </div>
          <div>
            czoło B: x {anchor.xB.toFixed(1)} · y {anchor.yB.toFixed(1)}
          </div>
          {panelA && panelB && (
            <button
              className="my-1 rounded border border-neutral-700 px-1.5 py-0.5 text-[11px] hover:bg-neutral-800"
              title="Wypisz w konsoli: worldPoint z B, macierz odwrotną A, surowy (xA,yA,zA), lico"
              onClick={() => console.log('[connector debug]', debugConnectorAnchor(panelA, panelB, connector.placement))}
            >
              🐞 Log do konsoli
            </button>
          )}
          {anchor.touching ? (
            <div className="text-emerald-400">płyty stykają się ✓</div>
          ) : (
            <div className="text-amber-400">
              ⚠ płyty się nie stykają (szczelina {anchor.gap.toFixed(1)} mm)
            </div>
          )}
          {miter && (
            <div className="text-amber-400">
              ⚠ krawędź gerunkowa (cutAngle≠90) — złącze gerunkowe nieobsługiwane w v1
            </div>
          )}
        </div>
      )}
    </div>
  )
}
