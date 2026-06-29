import type { HingeTemplateDraft } from '../model/hardware-template'

const positive = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const fmt = (value: number | undefined, digits = 1) => {
  if (!positive(value)) return '-'
  return Number.isInteger(value) ? String(value) : value.toFixed(digits).replace(/\.0$/, '')
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
        stroke="#e5e5e5"
        strokeWidth="1.4"
        strokeDasharray={dashed ? '5 5' : undefined}
        markerStart="url(#dimArrow)"
        markerEnd="url(#dimArrow)"
      />
      <text x={labelX} y={labelY} textAnchor="middle" fill="#f5f5f5" fontSize="18" fontWeight="700">
        {label}
      </text>
    </g>
  )
}

export function HingeTechnicalPreview({ draft }: { draft: HingeTemplateDraft }) {
  const s = 3
  const midY = 205
  const frontX = 58
  const frontY = 54
  const frontW = 270
  const frontH = 302
  const frontEdgeX = frontX + frontW
  const sideEdgeX = 420
  const sideW = 270

  const b = draft.tbDefault
  const cupDiameter = draft.cupDiameter
  const cupDepth = draft.cupDepth
  const screwInward = draft.cupScrewInward
  const screwSpacing = draft.cupScrewSpacing
  const screwDiameter = draft.cupScrewDiameter
  const plateInward = draft.plateInward
  const plateSpacing = draft.plateSpacing
  const plateDiameter = draft.plateDiameter

  const previewB = positive(b) ? b : 5
  const previewCupDiameter = positive(cupDiameter) ? cupDiameter : 35
  const cupR = positive(cupDiameter) ? Math.max(5, (cupDiameter / 2) * s) : (previewCupDiameter / 2) * s
  const cupX = frontEdgeX - (previewB + previewCupDiameter / 2) * s
  const cupEdgeX = cupX + cupR
  const screwX = cupX - (positive(screwInward) ? screwInward : 9.5) * s
  const screwHalf = (positive(screwSpacing) ? screwSpacing : 45) * s / 2
  const screwR = positive(screwDiameter) ? Math.max(2.2, (screwDiameter / 2) * s) : 5

  const plateX = sideEdgeX + (positive(plateInward) ? plateInward : 37) * s
  const plateHalf = (positive(plateSpacing) ? plateSpacing : 32) * s / 2
  const plateR = positive(plateDiameter) ? Math.max(2.4, (plateDiameter / 2) * s) : 7
  const plateBodyHalf = Math.max(52, plateHalf + 30)
  const plateBodyWidth = Math.max(54, plateR * 2 + 42)

  const cupComplete = positive(cupDiameter) && positive(cupDepth)
  const screwComplete = positive(screwDiameter) && positive(screwInward) && positive(screwSpacing)
  const plateComplete = positive(plateDiameter) && positive(plateInward) && positive(plateSpacing)

  return (
    <div className="rounded border border-neutral-800 bg-neutral-950 p-2">
      <svg viewBox="0 0 760 430" className="h-[380px] w-full">
        <defs>
          <marker id="dimArrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M 0 4 L 8 0 L 8 8 Z" fill="#e5e5e5" />
          </marker>
          <filter id="previewShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity="0.35" />
          </filter>
        </defs>

        <rect x="0" y="0" width="760" height="430" rx="8" fill="#0a0a0a" />
        <rect x={frontX} y={frontY} width={frontW} height={frontH} rx="2" fill="#293241" stroke="#64748b" strokeWidth="1.4" filter="url(#previewShadow)" />
        <rect x={sideEdgeX} y={frontY} width={sideW} height={frontH} rx="2" fill="#263241" stroke="#64748b" strokeWidth="1.4" filter="url(#previewShadow)" />
        <rect x={frontEdgeX - 5} y={frontY} width="5" height={frontH} fill="#f59e0b" />
        <rect x={sideEdgeX} y={frontY} width="5" height={frontH} fill="#f59e0b" />

        <text x={frontX + 14} y={frontY + 24} fill="#e5e5e5" fontSize="13" fontWeight="700">Front</text>
        <text x={sideEdgeX + sideW - 14} y={frontY + 24} textAnchor="end" fill="#e5e5e5" fontSize="13" fontWeight="700">Bok</text>
        <text x={frontEdgeX - 8} y={frontY - 12} textAnchor="end" fill="#fbbf24" fontSize="12">krawedz zawiasowa</text>
        <text x={sideEdgeX + 8} y={frontY - 12} fill="#fbbf24" fontSize="12">przednia krawedz boku</text>

        <path
          d={`M ${cupX + 26} ${midY - 28} C ${frontEdgeX + 30} ${midY - 34}, ${sideEdgeX - 18} ${midY - 36}, ${plateX - 20} ${midY - 24}
              L ${plateX + 12} ${midY + 18} C ${sideEdgeX - 18} ${midY + 30}, ${frontEdgeX + 24} ${midY + 32}, ${cupX + 20} ${midY + 28} Z`}
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
          stroke={cupComplete ? '#fca5a5' : '#737373'}
          strokeWidth="2"
          strokeDasharray={cupComplete ? undefined : '7 6'}
        />
        <text x={cupX} y={midY + 4} textAnchor="middle" fill="#fef2f2" fontSize="12" fontWeight="700">
          {positive(cupDiameter) ? `Ø${fmt(cupDiameter)}` : 'puszka'}
        </text>

        <circle cx={screwX} cy={midY - screwHalf} r={screwR} fill={positive(screwDiameter) ? '#ef4444' : 'none'} stroke="#fecaca" strokeWidth="1.5" strokeDasharray={screwComplete ? undefined : '4 4'} />
        <circle cx={screwX} cy={midY + screwHalf} r={screwR} fill={positive(screwDiameter) ? '#ef4444' : 'none'} stroke="#fecaca" strokeWidth="1.5" strokeDasharray={screwComplete ? undefined : '4 4'} />
        <text x={screwX - 6} y={midY + screwHalf + 20} textAnchor="middle" fill="#d4d4d4" fontSize="11">mocowanie</text>

        <line x1={screwX} y1={midY - screwHalf} x2={screwX - 34} y2={midY - screwHalf} stroke="#737373" strokeWidth="1" strokeDasharray={positive(screwSpacing) ? undefined : '4 4'} />
        <line x1={screwX} y1={midY + screwHalf} x2={screwX - 34} y2={midY + screwHalf} stroke="#737373" strokeWidth="1" strokeDasharray={positive(screwSpacing) ? undefined : '4 4'} />
        <DimLine x1={screwX - 34} y1={midY - screwHalf} x2={screwX - 34} y2={midY + screwHalf} label={`C ${fmt(screwSpacing)}`} labelX={screwX - 62} labelY={midY + 5} dashed={!positive(screwSpacing)} />

        <line x1={screwX} y1={midY - cupR - 44} x2={screwX} y2={midY - screwHalf} stroke="#737373" strokeWidth="1" strokeDasharray={positive(screwInward) ? undefined : '4 4'} />
        <line x1={cupX} y1={midY - cupR - 44} x2={cupX} y2={midY - cupR} stroke="#737373" strokeWidth="1" />
        <DimLine x1={screwX} y1={midY - cupR - 34} x2={cupX} y2={midY - cupR - 34} label={`D ${fmt(screwInward)}`} labelX={(screwX + cupX) / 2} labelY={midY - cupR - 48} dashed={!positive(screwInward)} />

        <line x1={frontEdgeX} y1={midY + cupR + 28} x2={frontEdgeX} y2={midY + cupR + 58} stroke="#737373" strokeWidth="1" strokeDasharray={positive(b) ? undefined : '4 4'} />
        <line x1={cupEdgeX} y1={midY} x2={cupEdgeX} y2={midY + cupR + 54} stroke="#737373" strokeWidth="1" strokeDasharray={positive(b) ? undefined : '4 4'} />
        <DimLine x1={frontEdgeX} y1={midY + cupR + 42} x2={cupEdgeX} y2={midY + cupR + 42} label={`B ${fmt(b)}`} labelX={(frontEdgeX + cupEdgeX) / 2} labelY={midY + cupR + 62} dashed={!positive(b)} />

        <rect
          x={plateX - plateBodyWidth / 2}
          y={midY - plateBodyHalf}
          width={plateBodyWidth}
          height={plateBodyHalf * 2}
          rx="14"
          fill={plateComplete ? '#1d4ed8' : 'none'}
          opacity={plateComplete ? 0.42 : 1}
          stroke={plateComplete ? '#93c5fd' : '#737373'}
          strokeWidth="1.5"
          strokeDasharray={plateComplete ? undefined : '7 6'}
        />
        <circle cx={plateX} cy={midY - plateHalf} r={plateR} fill={positive(plateDiameter) ? '#2563eb' : 'none'} stroke="#bfdbfe" strokeWidth="1.5" strokeDasharray={plateComplete ? undefined : '4 4'} />
        <circle cx={plateX} cy={midY + plateHalf} r={plateR} fill={positive(plateDiameter) ? '#2563eb' : 'none'} stroke="#bfdbfe" strokeWidth="1.5" strokeDasharray={plateComplete ? undefined : '4 4'} />
        <text x={plateX} y={midY + 4} textAnchor="middle" fill="#eff6ff" fontSize="12" fontWeight="700">
          {positive(plateDiameter) ? `Ø${fmt(plateDiameter)}` : 'prowadnik'}
        </text>

        <line x1={sideEdgeX} y1={midY + plateHalf + 26} x2={sideEdgeX} y2={midY + plateHalf + 54} stroke="#737373" strokeWidth="1" strokeDasharray={positive(plateInward) ? undefined : '4 4'} />
        <line x1={plateX} y1={midY + plateHalf + 26} x2={plateX} y2={midY + plateHalf + 54} stroke="#737373" strokeWidth="1" strokeDasharray={positive(plateInward) ? undefined : '4 4'} />
        <DimLine x1={sideEdgeX} y1={midY + plateHalf + 42} x2={plateX} y2={midY + plateHalf + 42} label={`P ${fmt(plateInward)}`} labelX={(sideEdgeX + plateX) / 2} labelY={midY + plateHalf + 62} dashed={!positive(plateInward)} />

        <line x1={plateX} y1={midY - plateHalf} x2={plateX + 46} y2={midY - plateHalf} stroke="#737373" strokeWidth="1" strokeDasharray={positive(plateSpacing) ? undefined : '4 4'} />
        <line x1={plateX} y1={midY + plateHalf} x2={plateX + 46} y2={midY + plateHalf} stroke="#737373" strokeWidth="1" strokeDasharray={positive(plateSpacing) ? undefined : '4 4'} />
        <DimLine x1={plateX + 46} y1={midY - plateHalf} x2={plateX + 46} y2={midY + plateHalf} label={`S ${fmt(plateSpacing)}`} labelX={plateX + 74} labelY={midY + 5} dashed={!positive(plateSpacing)} />

        <g fill="#d4d4d4" fontSize="11">
          <circle cx="70" cy="390" r="5" fill="#7f1d1d" stroke="#fca5a5" />
          <text x="82" y="394">puszka</text>
          <circle cx="156" cy="390" r="5" fill="#ef4444" stroke="#fecaca" />
          <text x="168" y="394">mocowanie puszki</text>
          <circle cx="318" cy="390" r="5" fill="#2563eb" stroke="#bfdbfe" />
          <text x="330" y="394">nawierty prowadnika</text>
        </g>
      </svg>
    </div>
  )
}
