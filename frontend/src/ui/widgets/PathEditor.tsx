import type { Vec2 } from '../../model/types'
import { NumberInput } from './NumberInput'

interface Props {
  value: Vec2[]
  onChange: (next: Vec2[]) => void
}

/** Edytor listy punktów ścieżki (groove/cutout/pocket). Współrzędne w mm. */
export function PathEditor({ value, onChange }: Props) {
  const setPoint = (i: number, axis: 0 | 1, v: number) => {
    const next = value.map((p) => [...p] as Vec2)
    next[i][axis] = v
    onChange(next)
  }
  const addPoint = () => {
    const last = value[value.length - 1] ?? [0, 0]
    onChange([...value, [last[0] + 50, last[1]]])
  }
  const removePoint = (i: number) => onChange(value.filter((_, j) => j !== i))

  return (
    <div className="mt-1 rounded border border-neutral-800 p-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-neutral-500">Punkty ({value.length})</span>
        <button className="rounded border border-neutral-700 px-1.5 text-xs hover:bg-neutral-800" onClick={addPoint}>
          + punkt
        </button>
      </div>
      {value.map((p, i) => (
        <div key={i} className="mb-1 flex items-center gap-1 text-xs">
          <span className="w-4 text-neutral-600">{i + 1}</span>
          <NumberInput value={p[0]} unit="" onChange={(v) => setPoint(i, 0, v)} />
          <NumberInput value={p[1]} unit="" onChange={(v) => setPoint(i, 1, v)} />
          <button
            className="px-1 text-neutral-500 hover:text-red-400"
            title="Usuń punkt"
            onClick={() => removePoint(i)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
