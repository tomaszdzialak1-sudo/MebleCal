import type { ReactNode } from 'react'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="text-neutral-400">{label}</span>
      <span className="flex-shrink-0">{children}</span>
    </label>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
      {children}
    </h3>
  )
}
