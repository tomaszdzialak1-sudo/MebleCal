import { Toolbar } from './ui/Toolbar'
import { Sidebar } from './ui/Sidebar'
import { Inspector } from './ui/Inspector'
import { SceneCanvas } from './scene/SceneCanvas'
import { CutListView } from './ui/CutListView'
import { CabinetWizard } from './ui/CabinetWizard'
import { AppShell } from './ui/AppShell'
import { useViewStore } from './store/viewStore'

export default function App() {
  const activeView = useViewStore((s) => s.activeView)
  const showCabinetWizard = useViewStore((s) => s.showCabinetWizard)

  return (
    <AppShell
      topbar={<Toolbar />}
      leftPanel={<Sidebar />}
      rightPanel={<Inspector />}
      workspace={activeView === '3d' ? <SceneCanvas /> : <CutListView />}
      bottomPanel={<StatusBar />}
      modal={showCabinetWizard ? <CabinetWizard /> : null}
    />
  )
}

function StatusBar() {
  return (
    <div className="flex h-8 items-center justify-between gap-4 px-4 text-xs text-neutral-400">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        <span>Gotowe</span>
        <span className="text-neutral-700">|</span>
        <span>Alt = obejście blokady kolizji</span>
      </div>
      <div className="hidden items-center gap-3 md:flex">
        <span>Plan: drag & drop okuć z katalogu na płyty/szafki</span>
        <span className="text-neutral-700">|</span>
        <span>Meble CAD</span>
      </div>
    </div>
  )
}
