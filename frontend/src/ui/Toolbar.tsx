import { useRef, useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useViewStore } from '../store/viewStore'
import { downloadProject, readProjectFile } from '../model/serialization'
import { collectWarnings } from '../model/validate'
import { validateProject } from '../api/client'
import { TextInput } from './widgets/TextInput'

const btn =
  'rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-sm hover:bg-neutral-700 active:bg-neutral-600'

function backendErrorDetail(data: unknown): string {
  if (typeof data === 'string') return data.trim()
  if (!data) return ''
  try {
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}

function isProxyUnavailable(status: number | undefined, data: unknown): boolean {
  const detail = backendErrorDetail(data).toLowerCase()
  return (
    status === 500 &&
    (detail.includes('proxy') ||
      detail.includes('could not proxy') ||
      detail.includes('econnrefused') ||
      detail.includes('connection refused'))
  )
}

function shortBackendDetail(data: unknown): string {
  const detail = backendErrorDetail(data).replace(/\s+/g, ' ')
  return detail.length > 180 ? `${detail.slice(0, 180)}...` : detail
}

export function Toolbar() {
  const project = useProjectStore((s) => s.project)
  const setProjectName = useProjectStore((s) => s.setProjectName)
  const addPanel = useProjectStore((s) => s.addPanel)
  const addRoom = useProjectStore((s) => s.addRoom)
  const loadProject = useProjectStore((s) => s.loadProject)
  const newProject = useProjectStore((s) => s.newProject)
  const setShowCabinetWizard = useViewStore((s) => s.setShowCabinetWizard)
  const roomsVisible = useViewStore((s) => s.roomsVisible)
  const toggleRooms = useViewStore((s) => s.toggleRooms)
  const wallOpacity = useViewStore((s) => s.wallOpacity)
  const setWallOpacity = useViewStore((s) => s.setWallOpacity)
  const magnetEnabled = useViewStore((s) => s.magnetEnabled)
  const toggleMagnet = useViewStore((s) => s.toggleMagnet)
  const showLabels = useViewStore((s) => s.showLabels)
  const toggleLabels = useViewStore((s) => s.toggleLabels)
  const activeView = useViewStore((s) => s.activeView)
  const setActiveView = useViewStore((s) => s.setActiveView)
  const showCollisions = useViewStore((s) => s.showCollisions)
  const toggleCollisions = useViewStore((s) => s.toggleCollisions)
  const showHingeModels = useViewStore((s) => s.showHingeModels)
  const toggleHingeModels = useViewStore((s) => s.toggleHingeModels)
  const showHingeDrills = useViewStore((s) => s.showHingeDrills)
  const toggleHingeDrills = useViewStore((s) => s.toggleHingeDrills)

  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string>('zapisywane lokalnie')

  const onImport = async (file: File) => {
    try {
      const p = await readProjectFile(file)
      loadProject(p)
      setStatus(`zaimportowano: ${file.name}`)
    } catch (err) {
      setStatus(`błąd importu: ${(err as Error).message}`)
    }
  }

  const onValidate = async () => {
    // 1) Ostrzeżenia JAKOŚCI (Ø, poza konturem, szczelina łącznika) — MIĘKKIE.
    //    Nie blokują ani zapisu, ani round-tripa; to wskazówki technologiczne.
    const warnings = collectWarnings(project)
    const wMsg = warnings.length
      ? `⚠ ostrzeżenia (nie blokują zapisu): ${warnings.length} — ${warnings[0]}${
          warnings.length > 1 ? ` (+${warnings.length - 1})` : ''
        }`
      : 'jakość: brak ostrzeżeń'

    // 2) Round-trip przez Pydantic = wyłącznie STRUKTURA modelu (jedyne, co blokuje).
    setStatus(`${wMsg} · sprawdzam strukturę…`)
    try {
      const r = await validateProject(project)
      setStatus(`${wMsg} · struktura OK — płyt: ${r.panels}, pomieszczeń: ${r.rooms}, materiałów: ${r.materials}`)
    } catch (err) {
      const e = err as { response?: { status?: number; data?: unknown }; message?: string }
      if (!e.response) {
        // brak odpowiedzi = backend nie działa / proxy padło. Zapis lokalny działa MIMO TO.
        setStatus(`${wMsg} · backend niedostępny — uruchom serwer; zapis lokalny działa niezależnie`)
      } else if (e.response.status === 422) {
        // 422 = realnie niepoprawna STRUKTURA danych (jedyny powód do blokady).
        setStatus(`${wMsg} · ⛔ błąd STRUKTURY modelu: ${JSON.stringify(e.response.data)}`)
      } else if (isProxyUnavailable(e.response.status, e.response.data)) {
        setStatus(`${wMsg} · backend niedostępny — uruchom albo zrestartuj serwer; zapis lokalny działa`)
      } else {
        const detail = shortBackendDetail(e.response.data)
        setStatus(
          `${wMsg} · backend błąd ${e.response.status}${
            detail ? `: ${detail}` : ''
          } (struktura nie sprawdzona; zapis lokalny działa)`,
        )
      }
    }
  }

  return (
    <header className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-950 px-3 py-2">
      <span className="mr-1 font-semibold text-amber-500">Meble CAD</span>
      <TextInput value={project.name} onChange={setProjectName} className="w-48" placeholder="nazwa projektu" />

      <div className="mx-2 h-5 w-px bg-neutral-800" />
      <button className={btn} onClick={addPanel}>+ Płyta</button>
      <button className={btn} onClick={addRoom}>+ Pomieszczenie</button>
      <button className={btn} onClick={() => setShowCabinetWizard(true)}>+ Szafka</button>

      <div className="mx-2 h-5 w-px bg-neutral-800" />
      <button className={btn} onClick={() => downloadProject(project)}>Eksport JSON</button>
      <button className={btn} onClick={() => fileRef.current?.click()}>Import JSON</button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onImport(f)
          e.target.value = ''
        }}
      />
      <button
        className={btn}
        onClick={() => {
          if (confirm('Nowy projekt? Bieżący zostanie zastąpiony (autosave nadpisany).')) newProject()
        }}
      >
        Nowy
      </button>

      <div className="mx-2 h-5 w-px bg-neutral-800" />
      <button
        className={`${btn} ${magnetEnabled ? 'text-amber-400' : 'text-neutral-500'}`}
        onClick={toggleMagnet}
        title="Magnes: dociąganie płyt na styk przy przeciąganiu (Alt/Ctrl = chwilowo wyłącz)"
      >
        🧲 Magnes
      </button>
      <button
        className={`${btn} ${showLabels ? 'text-sky-400' : 'text-neutral-500'}`}
        onClick={toggleLabels}
        title="Pokaż na zaznaczonej płycie: lico front/back + numery krawędzi 0–3"
      >
        🏷 Lica
      </button>
      <button
        className={`${btn} ${roomsVisible ? '' : 'text-neutral-500'}`}
        onClick={toggleRooms}
        title="Pokaż/ukryj pomieszczenie w scenie (tylko widok — nie zapisywane)"
      >
        {roomsVisible ? '👁 Pokój' : '🚫 Pokój'}
      </button>
      <label
        className={`flex items-center gap-1 text-xs ${roomsVisible ? 'text-neutral-400' : 'text-neutral-700'}`}
        title="Krycie ścian (tylko widok)"
      >
        Ściany
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={wallOpacity}
          disabled={!roomsVisible}
          onChange={(e) => setWallOpacity(Number(e.target.value))}
          className="w-20 accent-amber-500"
        />
      </label>

      <div className="mx-2 h-5 w-px bg-neutral-800" />
      <button
        className={`${btn} ${activeView === '3d' ? 'text-amber-400' : 'text-neutral-400'}`}
        onClick={() => setActiveView('3d')}
        title="Widok 3D"
      >
        3D
      </button>
      <button
        className={`${btn} ${activeView === 'cutlist' ? 'text-amber-400' : 'text-neutral-400'}`}
        onClick={() => setActiveView('cutlist')}
        title="Rozkrój: lista formatek i nesting arkuszy"
      >
        Rozkrój
      </button>

      <button
        className={`${btn} ${showCollisions ? 'text-red-400' : 'text-neutral-500'}`}
        onClick={toggleCollisions}
        title="Sprawdzaj kolizje płyt w czasie rzeczywistym (tylko widok — nie zapisywane)"
      >
        ⚠ Kolizje
      </button>
      <button
        className={`${btn} ${showHingeModels ? 'text-amber-400' : 'text-neutral-500'}`}
        onClick={toggleHingeModels}
        title="Pokaż/ukryj modele 3D zawiasów (puszka + ramię) — tylko widok"
      >
        🔩 Model zawiasu
      </button>
      <button
        className={`${btn} ${showHingeDrills ? 'text-sky-400' : 'text-neutral-500'}`}
        onClick={toggleHingeDrills}
        title="Pokaż/ukryj markery nawiertów zawiasowych — tylko widok; nawierty zawsze zostają w operacjach"
      >
        ⚫ Nawierty
      </button>

      <div className="mx-2 h-5 w-px bg-neutral-800" />
      <button className={btn} onClick={onValidate} title="Round-trip modelu przez Pydantic (backend musi działać)">
        Sprawdź model
      </button>

      <span className="ml-auto truncate text-xs text-neutral-500" title={status}>
        {status}
      </span>
    </header>
  )
}
