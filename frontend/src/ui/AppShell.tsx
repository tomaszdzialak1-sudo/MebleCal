import type { ReactNode } from 'react'

type AppShellProps = {
  topbar: ReactNode
  leftPanel: ReactNode
  workspace: ReactNode
  rightPanel: ReactNode
  bottomPanel?: ReactNode
  modal?: ReactNode
}

export function AppShell({
  topbar,
  leftPanel,
  workspace,
  rightPanel,
  bottomPanel,
  modal,
}: AppShellProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-neutral-950 text-neutral-100">
      <header className="z-20 shrink-0 border-b border-neutral-800 bg-neutral-950/95 shadow-lg shadow-black/20 backdrop-blur">
        {topbar}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_360px] overflow-hidden">
        <aside className="min-h-0 overflow-hidden border-r border-neutral-800 bg-neutral-950/90">
          <PanelFrame title="Biblioteka / projekt" subtitle="Elementy, materiały, okucia">
            {leftPanel}
          </PanelFrame>
        </aside>

        <main className="relative min-h-0 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.10),_transparent_35%),linear-gradient(180deg,_#0a0a0a,_#111827)]">
          <div className="absolute left-4 top-4 z-10 rounded-full border border-neutral-700/80 bg-neutral-950/75 px-3 py-1 text-xs text-neutral-300 shadow-lg backdrop-blur">
            Obszar roboczy · 2D / 3D / rozkrój
          </div>
          <div className="h-full min-h-0">{workspace}</div>
        </main>

        <aside className="min-h-0 overflow-hidden border-l border-neutral-800 bg-neutral-950/90">
          <PanelFrame title="Właściwości" subtitle="Parametry zaznaczenia">
            {rightPanel}
          </PanelFrame>
        </aside>
      </div>

      {bottomPanel && (
        <footer className="z-20 shrink-0 border-t border-neutral-800 bg-neutral-950/95">
          {bottomPanel}
        </footer>
      )}

      {modal}
    </div>
  )
}

function PanelFrame({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-neutral-800 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400/90">
          {title}
        </div>
        <div className="mt-1 text-xs text-neutral-500">{subtitle}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-3 scrollbar-thin scrollbar-track-neutral-950 scrollbar-thumb-neutral-800">
        {children}
      </div>
    </section>
  )
}
