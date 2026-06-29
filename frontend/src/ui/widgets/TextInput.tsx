interface Props {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
}

export function TextInput({ value, onChange, className = '', placeholder }: Props) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-sm outline-none focus:border-amber-500 ${className}`}
    />
  )
}
