import { useEffect, useState } from 'react'

interface Props {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
}

export function NumberInput({ value, onChange, step = 1, min, max, unit = 'mm' }: Props) {
  // Lokalny bufor tekstu, żeby dało się czyścić/wpisywać bez walki ze stanem.
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  const commit = (raw: string) => {
    const n = parseFloat(raw)
    const ok = Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)
    if (ok) onChange(n)
    else setText(String(value))
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        className="w-20 rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-right text-sm tabular-nums outline-none focus:border-amber-500"
        value={text}
        step={step}
        min={min}
        max={max}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
      {unit && <span className="w-6 text-xs text-neutral-500">{unit}</span>}
    </span>
  )
}
