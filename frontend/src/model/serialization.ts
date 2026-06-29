import type { Project } from './types'

// Zapis/odczyt całego Project ↔ JSON (eksport pliku + autosave w localStorage).
// Plik jest opakowany w kopertę z `schemaVersion` → miejsce na migracje w przyszłości.

export const SCHEMA_VERSION = 1
const LS_KEY = 'meble-cad:autosave'

export interface ProjectFile {
  schemaVersion: number
  savedAt: string
  project: Project
}

export function makeFile(project: Project): ProjectFile {
  return { schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(), project }
}

export function serializeProject(project: Project): string {
  return JSON.stringify(makeFile(project), null, 2)
}

/** Migruje stary projekt do aktualnego modelu (brakujące pola → defaulty). */
function migrateProject(p: Project): Project {
  // Faza 6: bandingThickness dodane; stare pliki go nie mają.
  if ((p.settings as unknown as Record<string, unknown>).bandingThickness === undefined) {
    p.settings.bandingThickness = 1
  }
  // Faza 7.1.2: roomId dodane; stare pliki go nie mają — przypisz do pierwszego pokoju.
  const firstRoomId = p.rooms[0]?.id ?? ''
  for (const panel of p.panels) {
    if ((panel as unknown as Record<string, unknown>).roomId === undefined) {
      ;(panel as unknown as Record<string, unknown>).roomId = firstRoomId
    }
  }
  // Faza 7.3b: cabinets dodane; stare pliki go nie mają.
  if (!Array.isArray((p as unknown as Record<string, unknown>).cabinets)) {
    ;(p as unknown as Record<string, unknown>).cabinets = []
  }
  return p
}

/** Parsuje plik/kopertę LUB surowy Project. Minimalna walidacja kształtu. */
export function parseProjectFile(text: string): Project {
  const data = JSON.parse(text)
  const project: unknown = data && typeof data === 'object' && 'project' in data ? (data as ProjectFile).project : data
  if (!project || typeof project !== 'object' || !Array.isArray((project as Project).panels)) {
    throw new Error('Nieprawidłowy plik projektu (brak panels[]).')
  }
  return migrateProject(project as Project)
}

export function downloadProject(project: Project): void {
  const blob = new Blob([serializeProject(project)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const safe = (project.name || 'projekt').trim().replace(/[^\w\-]+/g, '_') || 'projekt'
  a.href = url
  a.download = `${safe}.meblecad.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function readProjectFile(file: File): Promise<Project> {
  const text = await file.text()
  return parseProjectFile(text)
}

export function saveToLocalStorage(project: Project): void {
  try {
    localStorage.setItem(LS_KEY, serializeProject(project))
  } catch {
    /* quota / brak dostępu — ignoruj */
  }
}

export function loadFromLocalStorage(): Project | null {
  try {
    const text = localStorage.getItem(LS_KEY)
    return text ? parseProjectFile(text) : null
  } catch {
    return null
  }
}

export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    /* ignoruj */
  }
}
