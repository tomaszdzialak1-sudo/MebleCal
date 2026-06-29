import { useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useViewStore } from '../store/viewStore'
import type { CabinetParams, CabinetTemplateType } from '../model/cabinet-templates'
import { generateCabinet } from '../model/cabinet-templates'
import { NumberInput } from './widgets/NumberInput'
import { Field, SectionTitle } from './widgets/Field'

const TEMPLATES: { type: CabinetTemplateType; label: string; description: string; emoji: string }[] = [
  { type: 'standing', label: 'Szafka stojąca', description: 'Z drzwiami, wieniec górny i dolny', emoji: '🪵' },
  { type: 'wall',     label: 'Szafka wisząca',  description: 'Jak stojąca, bez cokołu',          emoji: '🪟' },
  { type: 'base',     label: 'Szafka dolna',    description: 'Pod blat, z listewkami i cokołem',  emoji: '🍳' },
]

const btn =
  'rounded border border-neutral-700 bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700 active:bg-neutral-600'
const btnPrimary =
  'rounded border border-amber-600 bg-amber-600/20 px-3 py-1 text-sm text-amber-200 hover:bg-amber-600/30 disabled:opacity-40'

function dimensionPreview(params: Omit<CabinetParams, 'materialId' | 'roomId'>) {
  const { W, H, D, T, backT, type, doors, shelves, plinth = 100 } = params
  const FA = 16
  const lines: string[] = []
  if (type === 'base') {
    const boxH = H - plinth
    lines.push(`bok lewy/prawy: ${D} × ${boxH}`)
    lines.push(`dół: ${W - 2 * T} × ${D}`)
    lines.push(`plecy: ${W - 2 * T} × ${boxH - T}`)
    lines.push(`listewki ×2: ${W - 2 * T} × 80`)
    lines.push(`cokół: ${W} × ${plinth}`)
    const openingH = boxH - 2 * T
    const doorW = doors === 1 ? W - 2 * T + 2 * FA : Math.round((W - 2 * T + 2 * FA) / 2)
    lines.push(`front${doors > 1 ? ' ×2' : ''}: ${doorW} × ${openingH + 2 * FA}`)
    if (shelves > 0) lines.push(`półki ×${shelves}: ${W - 2 * T} × ${D}`)
  } else {
    lines.push(`bok lewy/prawy: ${D} × ${H}`)
    lines.push(`wieniec górny: ${W - 2 * T} × ${D}`)
    lines.push(`dół: ${W - 2 * T} × ${D}`)
    lines.push(`plecy: ${W - 2 * T} × ${H - T}`)
    const openingH = H - 2 * T
    const doorW = doors === 1 ? W - 2 * T + 2 * FA : Math.round((W - 2 * T + 2 * FA) / 2)
    lines.push(`front${doors > 1 ? ' ×2' : ''}: ${doorW} × ${openingH + 2 * FA}`)
    if (shelves > 0) lines.push(`półki ×${shelves}: ${W - 2 * T} × ${D}`)
  }
  return lines
}

export function CabinetWizard() {
  const setShow = useViewStore((s) => s.setShowCabinetWizard)
  const insertCabinet = useProjectStore((s) => s.insertCabinet)
  const project = useProjectStore((s) => s.project)

  const defaultMat = project.materials[0]?.id ?? ''
  const defaultRoom = project.rooms[0]?.id ?? ''
  const defaultT = project.materials[0]?.thickness ?? 18

  const [type, setType] = useState<CabinetTemplateType>('standing')
  const [W, setW] = useState(600)
  const [H, setH] = useState(720)
  const [D, setD] = useState(560)
  const [T, setT] = useState(defaultT)
  const [backT, setBackT] = useState(4)
  const [materialId, setMaterialId] = useState(defaultMat)
  const [roomId, setRoomId] = useState(defaultRoom)
  const [doors, setDoors] = useState<1 | 2>(1)
  const [shelves, setShelves] = useState(0)
  const [plinth, setPlinth] = useState(100)

  const preview = dimensionPreview({ type, W, H, D, T, backT, doors, shelves, plinth })

  const handleGenerate = () => {
    const params: CabinetParams = {
      type, W, H, D, T, backT, materialId, roomId, doors, shelves,
      plinth: type === 'base' ? plinth : undefined,
    }
    insertCabinet(generateCabinet(params))
    setShow(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-16"
      onClick={() => setShow(false)}
    >
      <div
        className="relative mx-2 max-h-[82vh] w-[560px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-200">Kreator szafki</h2>
          <button className="text-neutral-500 hover:text-neutral-200" onClick={() => setShow(false)}>✕</button>
        </div>

        {/* Template tiles */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.type}
              onClick={() => setType(t.type)}
              className={`flex flex-col items-center rounded border p-3 text-center transition-colors ${
                type === t.type
                  ? 'border-amber-500 bg-amber-500/10 text-amber-200'
                  : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              <span className="mb-1 text-2xl">{t.emoji}</span>
              <span className="text-xs font-semibold">{t.label}</span>
              <span className="mt-0.5 text-[10px] text-neutral-500">{t.description}</span>
            </button>
          ))}
        </div>

        {/* Params */}
        <SectionTitle>Wymiary</SectionTitle>
        <Field label="Szerokość W">
          <NumberInput value={W} onChange={setW} min={100} max={3000} step={10} />
        </Field>
        <Field label="Wysokość H">
          <NumberInput value={H} onChange={setH} min={100} max={3000} step={10} />
        </Field>
        <Field label="Głębokość D">
          <NumberInput value={D} onChange={setD} min={100} max={1200} step={10} />
        </Field>

        <SectionTitle>Materiał</SectionTitle>
        <Field label="Grubość płyty T">
          <NumberInput value={T} onChange={setT} min={6} max={40} step={1} />
        </Field>
        <Field label="Grubość pleców">
          <NumberInput value={backT} onChange={setBackT} min={2} max={18} step={1} />
        </Field>
        <Field label="Materiał">
          <select
            className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-sm"
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
          >
            {project.materials.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Pomieszczenie">
          <select
            className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-sm"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          >
            {project.rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </Field>

        <SectionTitle>Drzwi i półki</SectionTitle>
        <Field label="Drzwi">
          <select
            className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-sm"
            value={doors}
            onChange={(e) => setDoors(Number(e.target.value) as 1 | 2)}
          >
            <option value={1}>1 skrzydło</option>
            <option value={2}>2 skrzydła</option>
          </select>
        </Field>
        <Field label="Półki">
          <NumberInput value={shelves} onChange={(v) => setShelves(Math.round(v))} min={0} max={8} step={1} unit="" />
        </Field>

        {type === 'base' && (
          <>
            <SectionTitle>Cokół</SectionTitle>
            <Field label="Wysokość cokołu">
              <NumberInput value={plinth} onChange={setPlinth} min={0} max={300} step={5} />
            </Field>
          </>
        )}

        {/* Preview */}
        <SectionTitle>Formatki (podgląd)</SectionTitle>
        <div className="rounded border border-neutral-800 bg-neutral-950 p-2 text-xs text-neutral-400">
          {preview.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className={btn} onClick={() => setShow(false)}>Anuluj</button>
          <button
            className={btnPrimary}
            disabled={!materialId || !roomId}
            onClick={handleGenerate}
          >
            Generuj szafkę
          </button>
        </div>
      </div>
    </div>
  )
}
