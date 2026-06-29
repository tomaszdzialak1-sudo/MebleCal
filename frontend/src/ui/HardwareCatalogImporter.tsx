import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import { getUserCatalog, saveUserCatalog } from '../model/hardware-catalog'
import type { HingeOverlayClass, HingeTemplateDraft } from '../model/hardware-template'
import { buildHingeTemplateEntry, validateHingeTemplateDraft } from '../model/hardware-template'
import { HingeTechnicalPreview } from './HingeTechnicalPreview'
import { Field, SectionTitle } from './widgets/Field'

interface Props {
  onClose: () => void
}

type Step = 1 | 2 | 3 | 4

interface FormState {
  name: string
  manufacturer: string
  openingAngle: string
  overlayClass: HingeOverlayClass | ''
  tbDefault: string
  plateDistance: '' | '0' | '3' | '6' | '9'
  cupDiameter: string
  cupDepth: string
  cupScrewDiameter: string
  cupScrewDepth: string
  cupScrewInward: string
  cupScrewSpacing: string
  plateDiameter: string
  plateDepth: string
  plateInward: string
  plateSpacing: string
}

const EMPTY_FORM: FormState = {
  name: '',
  manufacturer: '',
  openingAngle: '',
  overlayClass: '',
  tbDefault: '',
  plateDistance: '',
  cupDiameter: '',
  cupDepth: '',
  cupScrewDiameter: '',
  cupScrewDepth: '',
  cupScrewInward: '',
  cupScrewSpacing: '',
  plateDiameter: '',
  plateDepth: '',
  plateInward: '',
  plateSpacing: '',
}

const cls = {
  btn: 'rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800 disabled:opacity-40',
  btnPrimary: 'rounded border border-amber-600 bg-amber-600/20 px-3 py-1 text-sm text-amber-200 hover:bg-amber-600/30 disabled:opacity-40',
  input: 'w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-sm',
  select: 'rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-sm',
}

const numberOrUndefined = (value: string): number | undefined => {
  const trimmed = value.trim().replace(',', '.')
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

const positive = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const fmt = (value: number | undefined, digits = 1) => {
  if (!positive(value)) return '-'
  return Number.isInteger(value) ? String(value) : value.toFixed(digits).replace(/\.0$/, '')
}

function formToDraft(form: FormState): HingeTemplateDraft {
  const plateDistance = form.plateDistance === '' ? undefined : (Number(form.plateDistance) as 0 | 3 | 6 | 9)
  return {
    name: form.name,
    manufacturer: form.manufacturer,
    openingAngle: numberOrUndefined(form.openingAngle),
    overlayClass: form.overlayClass || undefined,
    tbDefault: numberOrUndefined(form.tbDefault),
    plateDistance,
    cupDiameter: numberOrUndefined(form.cupDiameter),
    cupDepth: numberOrUndefined(form.cupDepth),
    cupScrewDiameter: numberOrUndefined(form.cupScrewDiameter),
    cupScrewDepth: numberOrUndefined(form.cupScrewDepth),
    cupScrewInward: numberOrUndefined(form.cupScrewInward),
    cupScrewSpacing: numberOrUndefined(form.cupScrewSpacing),
    plateDiameter: numberOrUndefined(form.plateDiameter),
    plateDepth: numberOrUndefined(form.plateDepth),
    plateInward: numberOrUndefined(form.plateInward),
    plateSpacing: numberOrUndefined(form.plateSpacing),
  }
}

function NumberField({
  label,
  value,
  onChange,
  unit = 'mm',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  unit?: string
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-1">
        <input
          className={`${cls.input} text-right`}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="w-8 text-xs text-neutral-500">{unit}</span>
      </div>
    </Field>
  )
}

function DimLine({
  x1,
  y1,
  x2,
  y2,
  label,
  labelX,
  labelY,
  dashed = false,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  label: string
  labelX: number
  labelY: number
  dashed?: boolean
}) {
  return (
    <g className="pointer-events-none">
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#d4d4d4"
        strokeWidth="1.2"
        strokeDasharray={dashed ? '5 5' : undefined}
        markerStart="url(#dimArrow)"
        markerEnd="url(#dimArrow)"
      />
      <text x={labelX} y={labelY} textAnchor="middle" fill="#f5f5f5" fontSize="12" fontWeight="600">
        {label}
      </text>
    </g>
  )
}

function HingePreview({ draft }: { draft: HingeTemplateDraft }) {
  const cupDiameter = draft.cupDiameter
  const cupDepth = draft.cupDepth
  const tb = draft.tbDefault
  const screwInward = draft.cupScrewInward
  const screwSpacing = draft.cupScrewSpacing
  const screwDiameter = draft.cupScrewDiameter
  const plateInward = draft.plateInward
  const plateSpacing = draft.plateSpacing
  const plateDiameter = draft.plateDiameter

  const s = 3
  const midY = 205
  const frontX = 34
  const frontY = 54
  const frontW = 304
  const frontH = 302
  const frontEdgeX = frontX + frontW
  const sideEdgeX = 438
  const sideW = 284
  const previewTb = positive(tb) ? tb : 5
  const previewCupDiameter = positive(cupDiameter) ? cupDiameter : 35
  const cupCenterX = frontEdgeX - (previewTb + previewCupDiameter / 2) * s
  const cupR = positive(cupDiameter) ? Math.max(5, (cupDiameter / 2) * s) : 42
  const cupX = cupCenterX
  const screwBaseX = cupCenterX
  const screwX = positive(screwInward) ? screwBaseX - screwInward * s : undefined
  const screwHalf = positive(screwSpacing) ? (screwSpacing / 2) * s : undefined
  const screwR = positive(screwDiameter) ? Math.max(2.2, (screwDiameter / 2) * s) : 5
  const plateX = positive(plateInward) ? sideEdgeX + plateInward * s : undefined
  const plateHalf = positive(plateSpacing) ? (plateSpacing / 2) * s : undefined
  const plateR = positive(plateDiameter) ? Math.max(2.4, (plateDiameter / 2) * s) : 7
  const plateCenterX = plateX ?? sideEdgeX + 112
  const cupComplete = positive(cupDiameter) && positive(cupDepth)
  const screwReady = screwX !== undefined || screwHalf !== undefined || positive(screwDiameter)
  const screwComplete = screwX !== undefined && screwHalf !== undefined && positive(screwDiameter)
  const plateComplete = plateX !== undefined && plateHalf !== undefined && positive(plateDiameter)
  const plateReady = plateX !== undefined || plateHalf !== undefined || positive(plateDiameter)
  const previewScrewX = screwX ?? cupX - 32
  const previewScrewHalf = screwHalf ?? 58
  const previewPlateX = plateX ?? plateCenterX
  const previewPlateHalf = plateHalf ?? 48
  const plateBodyHalf = Math.max(52, previewPlateHalf + 30)
  const plateBodyWidth = Math.max(54, plateR * 2 + 42)

  return (
    <div className="rounded border border-neutral-800 bg-neutral-950 p-2">
      <svg viewBox="0 0 760 410" className="h-[360px] w-full">
        <defs>
          <marker id="dimArrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M 0 4 L 8 0 L 8 8 Z" fill="#d4d4d4" />
          </marker>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity="0.35" />
          </filter>
        </defs>

        <rect x="0" y="0" width="760" height="410" rx="8" fill="#0a0a0a" />
        <rect x={frontX} y={frontY} width={frontW} height={frontH} rx="2" fill="#293241" stroke="#64748b" strokeWidth="1.4" filter="url(#softShadow)" />
        <rect x={sideEdgeX} y={frontY} width={sideW} height={frontH} rx="2" fill="#263241" stroke="#64748b" strokeWidth="1.4" filter="url(#softShadow)" />
        <rect x={frontEdgeX - 5} y={frontY} width="5" height={frontH} fill="#f59e0b" />
        <rect x={sideEdgeX} y={frontY} width="5" height={frontH} fill="#f59e0b" />

        <text x={frontX + 16} y={frontY + 24} fill="#e5e5e5" fontSize="13" fontWeight="700">
          Front
        </text>
        <text x={sideEdgeX + sideW - 16} y={frontY + 24} textAnchor="end" fill="#e5e5e5" fontSize="13" fontWeight="700">
          Bok
        </text>
        <text x={frontEdgeX - 10} y={frontY - 12} textAnchor="end" fill="#fbbf24" fontSize="12">
          krawędź zawiasowa
        </text>
        <text x={sideEdgeX + 10} y={frontY - 12} fill="#fbbf24" fontSize="12">
          przednia krawędź boku
        </text>

        <path
          d={`M ${cupX + 26} ${midY - 28} C ${frontEdgeX + 30} ${midY - 34}, ${sideEdgeX - 18} ${midY - 36}, ${previewPlateX - 20} ${midY - 24}
              L ${previewPlateX + 12} ${midY + 18} C ${sideEdgeX - 18} ${midY + 30}, ${frontEdgeX + 24} ${midY + 32}, ${cupX + 20} ${midY + 28} Z`}
          fill="#6b7280"
          opacity="0.45"
          stroke="#a3a3a3"
          strokeWidth="1.2"
        />

        <circle
          cx={cupX}
          cy={midY}
          r={cupR}
          fill={cupComplete ? '#7f1d1d' : 'none'}
          opacity={cupComplete ? 0.92 : 1}
          stroke={cupComplete ? '#fca5a5' : '#737373'}
          strokeWidth="2"
          strokeDasharray={cupComplete ? undefined : '7 6'}
        />
        <text x={cupX} y={midY + 4} textAnchor="middle" fill="#fef2f2" fontSize="12" fontWeight="700">
          {positive(cupDiameter) ? `Ø${fmt(cupDiameter)}` : 'puszka'}
        </text>
        <text x={cupX} y={midY + cupR + 20} textAnchor="middle" fill="#d4d4d4" fontSize="11">
          {positive(cupDepth) ? `głęb. ${fmt(cupDepth)} mm` : 'głębokość'}
        </text>

        {screwReady ? (
          <>
            <circle
              cx={previewScrewX}
              cy={midY - previewScrewHalf}
              r={screwR}
              fill={positive(screwDiameter) ? '#ef4444' : 'none'}
              stroke="#fecaca"
              strokeWidth="1.5"
              strokeDasharray={screwComplete ? undefined : '4 4'}
            />
            <circle
              cx={previewScrewX}
              cy={midY + previewScrewHalf}
              r={screwR}
              fill={positive(screwDiameter) ? '#ef4444' : 'none'}
              stroke="#fecaca"
              strokeWidth="1.5"
              strokeDasharray={screwComplete ? undefined : '4 4'}
            />
            <line x1={previewScrewX} y1={midY - previewScrewHalf} x2={previewScrewX - 42} y2={midY - previewScrewHalf} stroke="#737373" strokeWidth="1" />
            <line x1={previewScrewX} y1={midY + previewScrewHalf} x2={previewScrewX - 42} y2={midY + previewScrewHalf} stroke="#737373" strokeWidth="1" />
            <DimLine x1={previewScrewX - 42} y1={midY - previewScrewHalf} x2={previewScrewX - 42} y2={midY + previewScrewHalf} label={`R ${fmt(screwSpacing)}`} labelX={previewScrewX - 78} labelY={midY + 4} />
            <line x1={previewScrewX} y1={midY - cupR - 18} x2={previewScrewX} y2={midY - previewScrewHalf} stroke="#737373" strokeWidth="1" />
            <line x1={cupX} y1={midY - cupR - 18} x2={cupX} y2={midY - cupR} stroke="#737373" strokeWidth="1" />
            <DimLine x1={previewScrewX} y1={midY - cupR - 18} x2={cupX} y2={midY - cupR - 18} label={`M ${fmt(screwInward)}`} labelX={(previewScrewX + cupX) / 2} labelY={midY - cupR - 28} />
          </>
        ) : (
          <g opacity="0.55">
            <circle cx={cupX - 32} cy={midY - 58} r="5" fill="none" stroke="#ef4444" strokeDasharray="4 4" />
            <circle cx={cupX - 32} cy={midY + 58} r="5" fill="none" stroke="#ef4444" strokeDasharray="4 4" />
          </g>
        )}

        {cupCenterX !== undefined && positive(tb) && (
          <>
            <line x1={frontEdgeX} y1={midY + cupR + 26} x2={frontEdgeX} y2={midY + cupR + 56} stroke="#737373" strokeWidth="1" />
            <line x1={cupCenterX} y1={midY + cupR + 26} x2={cupCenterX} y2={midY + cupR + 56} stroke="#737373" strokeWidth="1" />
            <DimLine
              x1={frontEdgeX}
              y1={midY + cupR + 44}
              x2={cupCenterX}
              y2={midY + cupR + 44}
              label={`C ${fmt(tb + (cupDiameter ?? 0) / 2)}`}
              labelX={(frontEdgeX + cupCenterX) / 2}
              labelY={midY + cupR + 62}
            />
            <line x1={frontEdgeX} y1={midY + cupR + 76} x2={frontEdgeX} y2={midY + cupR + 102} stroke="#737373" strokeWidth="1" />
            <line x1={cupCenterX + cupR} y1={midY + cupR + 76} x2={cupCenterX + cupR} y2={midY + cupR + 98} stroke="#737373" strokeWidth="1" />
            <DimLine
              x1={frontEdgeX}
              y1={midY + cupR + 88}
              x2={cupCenterX + cupR}
              y2={midY + cupR + 88}
              label={`B ${fmt(tb)}`}
              labelX={(frontEdgeX + cupCenterX + cupR) / 2}
              labelY={midY + cupR + 106}
            />
          </>
        )}

        <rect
          x={previewPlateX - plateBodyWidth / 2}
          y={midY - plateBodyHalf}
          width={plateBodyWidth}
          height={plateBodyHalf * 2}
          rx="14"
          fill={plateReady ? '#1d4ed8' : 'none'}
          opacity={plateReady ? 0.42 : 1}
          stroke={plateReady ? '#93c5fd' : '#737373'}
          strokeWidth="1.5"
          strokeDasharray={plateComplete ? undefined : '7 6'}
        />
        {plateReady ? (
          <>
            <circle
              cx={previewPlateX}
              cy={midY - previewPlateHalf}
              r={plateR}
              fill={positive(plateDiameter) ? '#2563eb' : 'none'}
              stroke="#bfdbfe"
              strokeWidth="1.5"
              strokeDasharray={plateComplete ? undefined : '4 4'}
            />
            <circle
              cx={previewPlateX}
              cy={midY + previewPlateHalf}
              r={plateR}
              fill={positive(plateDiameter) ? '#2563eb' : 'none'}
              stroke="#bfdbfe"
              strokeWidth="1.5"
              strokeDasharray={plateComplete ? undefined : '4 4'}
            />
            <line x1={sideEdgeX} y1={midY + previewPlateHalf + 26} x2={sideEdgeX} y2={midY + previewPlateHalf + 54} stroke="#737373" strokeWidth="1" />
            <line x1={previewPlateX} y1={midY + previewPlateHalf + 26} x2={previewPlateX} y2={midY + previewPlateHalf + 54} stroke="#737373" strokeWidth="1" />
            <DimLine x1={sideEdgeX} y1={midY + previewPlateHalf + 42} x2={previewPlateX} y2={midY + previewPlateHalf + 42} label={`P ${fmt(plateInward)}`} labelX={(sideEdgeX + previewPlateX) / 2} labelY={midY + previewPlateHalf + 60} />
            <line x1={previewPlateX} y1={midY - previewPlateHalf} x2={previewPlateX + 48} y2={midY - previewPlateHalf} stroke="#737373" strokeWidth="1" />
            <line x1={previewPlateX} y1={midY + previewPlateHalf} x2={previewPlateX + 48} y2={midY + previewPlateHalf} stroke="#737373" strokeWidth="1" />
            <DimLine x1={previewPlateX + 48} y1={midY - previewPlateHalf} x2={previewPlateX + 48} y2={midY + previewPlateHalf} label={`S ${fmt(plateSpacing)}`} labelX={previewPlateX + 84} labelY={midY + 4} />
          </>
        ) : (
          <g opacity="0.55">
            <circle cx={previewPlateX} cy={midY - 48} r="7" fill="none" stroke="#60a5fa" strokeDasharray="4 4" />
            <circle cx={previewPlateX} cy={midY + 48} r="7" fill="none" stroke="#60a5fa" strokeDasharray="4 4" />
          </g>
        )}
        <text x={previewPlateX} y={midY + 4} textAnchor="middle" fill="#eff6ff" fontSize="12" fontWeight="700">
          {positive(plateDiameter) ? `Ø${fmt(plateDiameter)}` : 'prowadnik'}
        </text>

        <g fill="#d4d4d4" fontSize="11">
          <circle cx="52" cy="380" r="5" fill="#7f1d1d" stroke="#fca5a5" />
          <text x="64" y="384">puszka</text>
          <circle cx="142" cy="380" r="5" fill="#ef4444" stroke="#fecaca" />
          <text x="154" y="384">mocowanie puszki</text>
          <circle cx="294" cy="380" r="5" fill="#2563eb" stroke="#bfdbfe" />
          <text x="306" y="384">nawierty prowadnika</text>
        </g>
        <g fill="#a3a3a3" fontSize="10">
          <text x="510" y="374">B -&gt; od krawedzi do puszki</text>
          <text x="510" y="389">C -&gt; od krawedzi do osi puszki</text>
          <text x="650" y="374">M/R -&gt; mocowanie</text>
          <text x="650" y="389">P/S -&gt; prowadnik</text>
        </g>
      </svg>
    </div>
  )
}

export function HardwareCatalogImporter({ onClose }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saved, setSaved] = useState(false)

  const draft = useMemo(() => formToDraft(form), [form])
  const validation = useMemo(() => validateHingeTemplateDraft(draft), [draft])
  const canSave = validation.errors.length === 0
  const patch = (part: Partial<FormState>) => setForm((prev) => ({ ...prev, ...part }))

  const handleSave = () => {
    if (!canSave) return
    const entry = buildHingeTemplateEntry(nanoid(), draft)
    saveUserCatalog([...getUserCatalog(), entry])
    setSaved(true)
  }

  const stepLabel = (s: Step) => (s === 1 ? 'Okucie' : s === 2 ? 'Front' : s === 3 ? 'Bok' : 'Zapis')

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-16" onClick={onClose}>
      <div
        className="relative mx-2 max-h-[82vh] w-[860px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-200">Kreator okucia</h2>
          <button className="text-neutral-500 hover:text-neutral-200" onClick={onClose}>
            x
          </button>
        </div>

        <div className="mb-4 flex gap-1 text-xs">
          {([1, 2, 3, 4] as const).map((s) => (
            <button
              key={s}
              className={`rounded px-2 py-0.5 ${step === s ? 'bg-amber-600 text-white' : 'text-neutral-500 hover:bg-neutral-800'}`}
              onClick={() => setStep(s)}
            >
              {s}. {stepLabel(s)}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div>
            <SectionTitle>Dane okucia</SectionTitle>
            <Field label="Typ">
              <select className={cls.select} value="hinge" disabled>
                <option value="hinge">Zawias</option>
              </select>
            </Field>
            <Field label="Nazwa">
              <input className={cls.input} value={form.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>
            <Field label="Producent">
              <input className={cls.input} value={form.manufacturer} onChange={(e) => patch({ manufacturer: e.target.value })} />
            </Field>
            <Field label="Kąt otwarcia">
              <input className={`${cls.input} text-right`} inputMode="decimal" value={form.openingAngle} onChange={(e) => patch({ openingAngle: e.target.value })} />
            </Field>
            <Field label="Nałożenie">
              <select className={cls.select} value={form.overlayClass} onChange={(e) => patch({ overlayClass: e.target.value as HingeOverlayClass | '' })}>
                <option value="">-</option>
                <option value="full">nakładany</option>
                <option value="half">półnakładany</option>
                <option value="inset">wpuszczany</option>
              </select>
            </Field>
            <Field label="Podstawa MD">
              <select className={cls.select} value={form.plateDistance} onChange={(e) => patch({ plateDistance: e.target.value as FormState['plateDistance'] })}>
                <option value="">-</option>
                <option value="0">0 mm</option>
                <option value="3">3 mm</option>
                <option value="6">6 mm</option>
                <option value="9">9 mm</option>
              </select>
            </Field>
            <StepButtons step={step} setStep={setStep} />
          </div>
        )}

        {step === 2 && (
          <div>
            <SectionTitle>Nawierty frontu</SectionTitle>
            <NumberField label="B - krawędź do puszki" value={form.tbDefault} onChange={(tbDefault) => patch({ tbDefault })} />
            <NumberField label="Ø puszki" value={form.cupDiameter} onChange={(cupDiameter) => patch({ cupDiameter })} />
            <NumberField label="Głęb. puszki" value={form.cupDepth} onChange={(cupDepth) => patch({ cupDepth })} />
            <NumberField label="Ø mocowania" value={form.cupScrewDiameter} onChange={(cupScrewDiameter) => patch({ cupScrewDiameter })} />
            <NumberField label="Głęb. mocowania" value={form.cupScrewDepth} onChange={(cupScrewDepth) => patch({ cupScrewDepth })} />
            <NumberField label="D - odsunięcie mocowania" value={form.cupScrewInward} onChange={(cupScrewInward) => patch({ cupScrewInward })} />
            <NumberField label="C - rozstaw mocowania" value={form.cupScrewSpacing} onChange={(cupScrewSpacing) => patch({ cupScrewSpacing })} />
            <HingeTechnicalPreview draft={draft} />
            <StepButtons step={step} setStep={setStep} />
          </div>
        )}

        {step === 3 && (
          <div>
            <SectionTitle>Nawierty boku</SectionTitle>
            <NumberField label="Ø prowadnika" value={form.plateDiameter} onChange={(plateDiameter) => patch({ plateDiameter })} />
            <NumberField label="Głęb. prowadnika" value={form.plateDepth} onChange={(plateDepth) => patch({ plateDepth })} />
            <NumberField label="P - od krawędzi boku" value={form.plateInward} onChange={(plateInward) => patch({ plateInward })} />
            <NumberField label="S - rozstaw prowadnika" value={form.plateSpacing} onChange={(plateSpacing) => patch({ plateSpacing })} />
            <HingeTechnicalPreview draft={draft} />
            <StepButtons step={step} setStep={setStep} />
          </div>
        )}

        {step === 4 && (
          <div>
            <SectionTitle>Podgląd</SectionTitle>
            <HingeTechnicalPreview draft={draft} />
            <div className="mt-3 rounded border border-neutral-800 bg-neutral-950 p-2 text-xs">
              <div className="text-neutral-300">{draft.name.trim() || '(bez nazwy)'}</div>
              <div className="text-neutral-500">{draft.manufacturer.trim() || '-'}</div>
              <div className="mt-2 text-neutral-400">
                Front: Ø{draft.cupDiameter ?? '-'} / głęb. {draft.cupDepth ?? '-'} · Bok: Ø{draft.plateDiameter ?? '-'} / {draft.plateInward ?? '-'} / {draft.plateSpacing ?? '-'}
              </div>
            </div>

            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
              <div className="mt-3 space-y-1 text-xs">
                {validation.errors.map((e) => (
                  <div key={e} className="text-red-400">{e}</div>
                ))}
                {validation.warnings.map((w) => (
                  <div key={w} className="text-amber-400">{w}</div>
                ))}
              </div>
            )}

            {saved ? (
              <p className="mt-3 text-sm text-emerald-400">Zapisano do katalogu.</p>
            ) : (
              <div className="mt-3 flex gap-2">
                <button className={cls.btn} onClick={() => setStep(3)}>
                  Wróć
                </button>
                <button className={cls.btnPrimary} disabled={!canSave} onClick={handleSave}>
                  Zapisz szablon
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StepButtons({ step, setStep }: { step: Step; setStep: (step: Step) => void }) {
  return (
    <div className="mt-3 flex gap-2">
      {step > 1 && (
        <button className={cls.btn} onClick={() => setStep((step - 1) as Step)}>
          Wróć
        </button>
      )}
      {step < 4 && (
        <button className={cls.btnPrimary} onClick={() => setStep((step + 1) as Step)}>
          Dalej
        </button>
      )}
    </div>
  )
}
