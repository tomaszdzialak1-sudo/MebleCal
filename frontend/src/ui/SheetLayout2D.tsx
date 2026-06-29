import type { Material } from '../model/types'
import type { NestResult } from '../model/nesting'

/** Kolor formatki na podstawie materialId (deterministyczny). */
function materialColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return `hsl(${h % 360}, 50%, 60%)`
}

const MAX_SVG_W = 560 // px — maks. szerokość SVG w layoutcie

function SheetSVG({
  sheet,
  sheetW,
  sheetH,
  color,
  index,
  totalSheets,
}: {
  sheet: NestResult['sheets'][0]
  sheetW: number
  sheetH: number
  color: string
  index: number
  totalSheets: number
}) {
  const scale = Math.min(MAX_SVG_W / sheetW, 240 / sheetH, 0.3)
  const sw = Math.round(sheetW * scale)
  const sh = Math.round(sheetH * scale)
  const fontSize = Math.max(8, Math.min(11, sw / 40))

  return (
    <div className="mb-3">
      <p className="mb-1 text-xs text-neutral-500">
        Arkusz {index + 1}/{totalSheets} — odpad {Math.round(sheet.wastePct * 100)} %
      </p>
      <svg width={sw} height={sh} className="block rounded border border-neutral-700">
        <rect width={sw} height={sh} fill="#2a2a2a" />
        {sheet.placements.map((p, i) => {
          const x = Math.round(p.x * scale)
          const y = Math.round(p.y * scale)
          const w = Math.max(1, Math.round(p.w * scale))
          const h = Math.max(1, Math.round(p.h * scale))
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill={color} stroke="#111" strokeWidth={0.5} opacity={0.85} />
              {w > 24 && h > 14 && (
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fill="#111"
                  fontWeight={600}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name}
                </text>
              )}
              {w > 40 && h > 22 && (
                <text
                  x={x + w / 2}
                  y={y + h / 2 + fontSize + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.max(7, fontSize - 1)}
                  fill="#222"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {Math.round(p.w)}×{Math.round(p.h)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

interface Props {
  nestResults: { material: Material; result: NestResult }[]
}

export function SheetLayout2D({ nestResults }: Props) {
  if (nestResults.length === 0) {
    return <p className="text-xs text-neutral-500">Brak formatek do rozkroju.</p>
  }

  return (
    <div>
      {nestResults.map(({ material, result }) => {
        const color = materialColor(material.id)
        return (
          <div key={material.id} className="mb-6">
            <h4 className="mb-2 text-sm font-semibold text-neutral-300">
              {material.name}{' '}
              <span className="font-normal text-neutral-500">
                — {result.sheetCount} {result.sheetCount === 1 ? 'arkusz' : 'arkuszy'},{' '}
                {Math.round(result.totalWastePct * 100)} % odpadu łącznie
              </span>
            </h4>
            <div className="flex flex-wrap gap-4">
              {result.sheets.map((sheet, si) => (
                <SheetSVG
                  key={si}
                  sheet={sheet}
                  sheetW={material.sheet.w}
                  sheetH={material.sheet.h}
                  color={color}
                  index={si}
                  totalSheets={result.sheetCount}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
