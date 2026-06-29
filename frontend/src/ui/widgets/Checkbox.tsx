interface Props {
  checked: boolean
  onChange: (v: boolean) => void
}

export function Checkbox({ checked, onChange }: Props) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 accent-amber-500"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  )
}
