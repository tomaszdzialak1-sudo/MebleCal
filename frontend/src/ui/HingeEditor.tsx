import { useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import type { Hardware, Hinge } from '../model/types'
import { computeFrontSize } from '../model/hinges'
import { cupCenterDistance, overlay, gapF, hingeCount, hingePositions, TB_MIN, TB_MAX } from '../model/blum-catalog'
import { getFullCatalog } from '../model/hardware-catalog'
import { edgeFrame } from '../model/geometry'
import { Field, SectionTitle } from './widgets/Field'
import { NumberInput } from './widgets/NumberInput'
import { Checkbox } from './widgets/Checkbox'
import { CUP_MOUNTING_LABEL, OVERLAY_CLASS_LABEL } from './labels'

const selectCls = 'rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-sm'

export function HingeEditor({ hardware }: { hardware: Hardware }) {
  const project = useProjectStore((s) => s.project)
  const update = useProjectStore((s) => s.updateHardware)
  const setDims = useProjectStore((s) => s.updatePanelDimensions)
  const hinge = hardware.hinge
  const [cavity, setCavity] = useState<{ w: number; h: number }>({ w: 564, h: 720 })

  if (!hinge) return <p className="text-sm text-neutral-500">Brak danych zawiasu.</p>

  const front = project.panels.find((p) => p.id === hinge.doorPanel)
  const side = project.panels.find((p) => p.id === hinge.sidePanel)
  const frontThickness = front?.thickness ?? 18

  // patch hinge (zachowuje resztę pól)
  const patch = (h: Partial<Hinge>) => update(hardware.id, { hinge: { ...hinge, ...h } })
  const patchCup = (c: Partial<Hinge['cup']>) => patch({ cup: { ...hinge.cup, ...c } })
  const patchPlate = (pl: Partial<Hinge['plate']>) => patch({ plate: { ...hinge.plate, ...pl } })
  const patchOptions = (o: Partial<Hinge['options']>) => patch({ options: { ...hinge.options, ...o } })

  const catalogHinges = getFullCatalog().filter((e) => e.kind === 'hinge')
  const applyCatalog = (hingeId: string) => {
    if (!hingeId) {
      patch({ hingeId: undefined })
      return
    }
    const entry = catalogHinges.find((e) => e.id === hingeId)
    const cup = entry?.drillPattern.find((h) => h.role === 'cup')
    const meta = entry?.meta ?? {}
    const tb = typeof meta.TB_default === 'number' ? meta.TB_default : hinge.cup.distanceTB
    const openingAngle = typeof meta.openingAngle === 'number' ? meta.openingAngle : hinge.openingAngle
    const overlayClass =
      meta.overlayClass === 'full' || meta.overlayClass === 'half' || meta.overlayClass === 'inset'
        ? meta.overlayClass
        : hinge.overlayClass
    const plateDistance =
      meta.plateDistance === 0 || meta.plateDistance === 3 || meta.plateDistance === 6 || meta.plateDistance === 9
        ? meta.plateDistance
        : hinge.plate.distance
    patch({
      hingeId,
      openingAngle,
      overlayClass,
      cup: {
        ...hinge.cup,
        distanceTB: tb,
        diameter: cup?.diameter ?? hinge.cup.diameter,
        depth: cup?.depth ?? hinge.cup.depth,
      },
      plate: { ...hinge.plate, distance: plateDistance },
    })
  }
  const fromEdge = hinge.placement[0]?.fromEdge ?? 0
  const setCount = (count: number) => {
    if (!front) return
    const height = edgeFrame(front.contour, fromEdge).length
    patch({ placement: hingePositions(height, Math.max(1, count)).map((offset) => ({ fromEdge, offset })) })
  }
  const setOffset = (i: number, offset: number) =>
    patch({ placement: hinge.placement.map((pl, k) => (k === i ? { ...pl, offset } : pl)) })

  const fa = overlay(hinge.cup.distanceTB, hinge.plate.distance)
  const g = gapF(hinge.cup.distanceTB, frontThickness)
  const tbOutOfRange = hinge.cup.distanceTB < TB_MIN || hinge.cup.distanceTB > TB_MAX
  const front2 = computeFrontSize(cavity, hinge.cup.distanceTB, hinge.plate.distance, frontThickness)
  const suggestedCount = front ? hingeCount(edgeFrame(front.contour, fromEdge).length) : 0
  const cupCenter = cupCenterDistance(hinge.cup.distanceTB, hinge.cup.diameter)

  const panelOpt = (idSel: string, onPick: (id: string) => void) => (
    <select className={`w-36 ${selectCls}`} value={idSel} onChange={(e) => onPick(e.target.value)}>
      {project.panels.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} · {p.id.slice(0, 4)}
        </option>
      ))}
    </select>
  )

  return (
    <div>
      <p className="mb-1 text-sm text-neutral-300">
        {hinge.family} {hinge.openingAngle}° · {OVERLAY_CLASS_LABEL[hinge.overlayClass]} · {CUP_MOUNTING_LABEL[hinge.cup.mounting]}
      </p>

      <Field label="Model zawiasu">
        <select
          className={selectCls}
          value={hinge.hingeId ?? ''}
          onChange={(e) => applyCatalog(e.target.value)}
        >
          <option value="">domyślny (wbudowany)</option>
          {catalogHinges.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>
      {hinge.hingeId && (
        <p className="mb-1 text-xs text-neutral-500">Ø puszki i głęb. z katalogu · TB/B z pola poniżej</p>
      )}

      <Field label="Front (drzwi)">{panelOpt(hinge.doorPanel, (doorPanel) => patch({ doorPanel }))}</Field>
      <Field label="Bok">{panelOpt(hinge.sidePanel, (sidePanel) => patch({ sidePanel }))}</Field>

      <Field label="Kąt otwarcia">
        <NumberInput value={hinge.openingAngle} min={0} unit="°" onChange={(openingAngle) => patch({ openingAngle })} />
      </Field>
      <Field label="Nałożenie">
        <select
          className={selectCls}
          value={hinge.overlayClass}
          onChange={(e) => patch({ overlayClass: e.target.value as Hinge['overlayClass'] })}
        >
          {(['full', 'half', 'inset'] as const).map((o) => (
            <option key={o} value={o}>
              {OVERLAY_CLASS_LABEL[o]}
            </option>
          ))}
        </select>
      </Field>

      <SectionTitle>Puszka (front)</SectionTitle>
      <Field label={`TB/B (${TB_MIN}–${TB_MAX})`}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={TB_MIN}
            max={TB_MAX}
            step={1}
            value={hinge.cup.distanceTB}
            onChange={(e) => patchCup({ distanceTB: Number(e.target.value) })}
            className="w-24 accent-amber-500"
          />
          <span className="w-6 text-right text-sm">{hinge.cup.distanceTB}</span>
        </div>
      </Field>
      <Field label="Głęb. puszki">
        <NumberInput value={hinge.cup.depth} min={1} onChange={(depth) => patchCup({ depth })} />
      </Field>
      <Field label="Ø puszki">
        <NumberInput value={hinge.cup.diameter} min={1} onChange={(diameter) => patchCup({ diameter })} />
      </Field>
      <Field label="Montaż">
        <select
          className={selectCls}
          value={hinge.cup.mounting}
          onChange={(e) => patchCup({ mounting: e.target.value as Hinge['cup']['mounting'] })}
        >
          {(['screw', 'inserta', 'expando'] as const).map((m) => (
            <option key={m} value={m}>
              {CUP_MOUNTING_LABEL[m]}
            </option>
          ))}
        </select>
      </Field>

      <SectionTitle>Prowadnik (bok)</SectionTitle>
      <Field label="Podstawa MD">
        <select
          className={selectCls}
          value={hinge.plate.distance}
          onChange={(e) => patchPlate({ distance: Number(e.target.value) as Hinge['plate']['distance'] })}
        >
          {[0, 3, 6, 9].map((d) => (
            <option key={d} value={d}>
              {d} mm
            </option>
          ))}
        </select>
      </Field>

      <SectionTitle>Opcje</SectionTitle>
      <Field label="BLUMOTION"><Checkbox checked={hinge.options.blumotion} onChange={(blumotion) => patchOptions({ blumotion })} /></Field>
      <Field label="TIP-ON"><Checkbox checked={hinge.options.tipOn} onChange={(tipOn) => patchOptions({ tipOn })} /></Field>
      <Field label="SERVO"><Checkbox checked={hinge.options.servoDrive} onChange={(servoDrive) => patchOptions({ servoDrive })} /></Field>

      <SectionTitle>Rozkład zawiasów</SectionTitle>
      <Field label="Liczba">
        <NumberInput value={hinge.placement.length} min={1} max={8} onChange={setCount} />
      </Field>
      <p className="mb-1 text-[11px] text-neutral-500">sugerowane (orientacyjne): {suggestedCount}</p>
      {hinge.placement.map((pl, i) => (
        <Field key={i} label={`offset #${i + 1}`}>
          <NumberInput value={pl.offset} onChange={(offset) => setOffset(i, offset)} />
        </Field>
      ))}

      <SectionTitle>Wyliczenia</SectionTitle>
      <div className="text-xs text-neutral-400">
        <div>
          środek puszki C = {hinge.cup.distanceTB} + Ø{hinge.cup.diameter}/2 ={' '}
          <span className="text-neutral-200">{cupCenter} mm</span>
        </div>
        <div>
          nałożenie FA = 11 − {hinge.plate.distance} + {hinge.cup.distanceTB} ={' '}
          <span className="text-neutral-200">{fa} mm</span>
        </div>
        <div>
          szczelina F (front {frontThickness} mm):{' '}
          {g.value !== null ? <span className="text-neutral-200">{g.value} mm</span> : <span className="text-amber-400">—</span>}
        </div>
        {g.note && <div className="text-amber-400">⚠ {g.note}</div>}
        {tbOutOfRange && <div className="text-amber-400">⚠ TB poza zakresem {TB_MIN}–{TB_MAX}</div>}
        {!front && <div className="text-amber-400">⚠ brak płyty frontu</div>}
        {!side && <div className="text-amber-400">⚠ brak płyty boku</div>}
      </div>

      <SectionTitle>Dobór frontu (podpowiedź)</SectionTitle>
      <Field label="Wnęka szer.">
        <NumberInput value={cavity.w} min={1} onChange={(w) => setCavity((c) => ({ ...c, w }))} />
      </Field>
      <Field label="Wnęka wys.">
        <NumberInput value={cavity.h} min={1} onChange={(h) => setCavity((c) => ({ ...c, h }))} />
      </Field>
      <div className="mb-1 text-xs text-neutral-300">
        sugerowany front: <span className="text-emerald-300">{front2.width} × {front2.height} mm</span>{' '}
        <span className="text-neutral-500">(FA {front2.overlay}{front2.gap !== null ? `, F ${front2.gap}` : ''})</span>
      </div>
      <button
        className="rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800 disabled:opacity-40"
        disabled={!front}
        title="Ustaw kontur płyty frontu na sugerowany wymiar (jawnie, bez cichego nadpisania)"
        onClick={() => front && setDims(front.id, front2.width, front2.height)}
      >
        Zastosuj do frontu
      </button>
    </div>
  )
}
