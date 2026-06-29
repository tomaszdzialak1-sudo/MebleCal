/**
 * Dispatcher importu plików okuć.
 * Łatwe do rozszerzenia: `.fmc` → parseFMC; kolejne formaty dopisać tu.
 */

import type { DrillHole } from '../hardware-catalog'
import { parseFMC } from './fmc'

export async function parseHardwareFile(file: File): Promise<DrillHole[]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'fmc') {
    throw new Error(`Nieobsługiwany format pliku: .${ext ?? '?'} — oczekiwano .fmc`)
  }
  const content = await file.text()
  const sourceFile = file.name  // File.name nie zawiera ścieżki
  return parseFMC(content).map((h) => ({ ...h, sourceFile }))
}
