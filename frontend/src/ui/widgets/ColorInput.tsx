interface Props {
  value: string
  onChange: (v: string) => void
}

export function ColorInput({ value, onChange }: Props) {
  return (
    <input
      type="color"
      className="h-6 w-10 cursor-pointer rounded border border-neutral-700 bg-neutral-800"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
