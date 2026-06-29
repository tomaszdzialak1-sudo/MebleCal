/**
 * Parser plików FMC (format Blum CNC) — pure, bez efektów ubocznych.
 *
 * Czyta bloki [VBDMES01], wyciąga DM/TI/X/Y/GRP/F, MASSTAB ignorowany.
 *
 * Pilot: dziura z DM < 4mm w tej samej GRP i tej samej pozycji (X,Y) co
 * większa dziura → ustawia pilotDiameter na tamtej i jest pomijana z wyjścia.
 * Dziury małe ale w innej pozycji → osobny DrillHole (np. wkręty puszki).
 *
 * Wszystkie wyjściowe dziury mają role: 'hole' (placeholder do korekty przez UI).
 */

import type { DrillHole } from '../hardware-catalog'

export function parseFMC(content: string): DrillHole[] {
  const blocks = splitBlocks(content)
  const raw = blocks.map(parseBlock).filter((h): h is RawHole => h !== null)
  return mergePilots(raw)
}

// ---------------------------------------------------------------------------

interface RawHole {
  x: number
  y: number
  diameter: number
  depth: number
  group: number
  feedRate?: number
}

function splitBlocks(content: string): string[] {
  return content
    .split(/\[VBDMES01\]/i)
    .slice(1)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function parseBlock(block: string): RawHole | null {
  const kv: Record<string, string> = {}
  for (const line of block.split(/\r?\n/)) {
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim().toUpperCase()
    const val = line.slice(eq + 1).trim()
    kv[key] = val
  }

  const diameter = parseFloat(kv['DM'] ?? '')
  const depth = parseFloat(kv['TI'] ?? '')
  const x = parseFloat(kv['X'] ?? '')
  const y = parseFloat(kv['Y'] ?? '')
  if (isNaN(diameter) || isNaN(depth) || isNaN(x) || isNaN(y)) return null

  const group = kv['GRP'] !== undefined ? (parseInt(kv['GRP'], 10) || 1) : 1
  const f = kv['F'] !== undefined ? parseFloat(kv['F']) : undefined
  const feedRate = f !== undefined && !isNaN(f) ? f : undefined

  return { x, y, diameter, depth, group, feedRate }
}

/** Klucz pozycji z dokładnością 0.01 mm do wykrywania pilotów w tej samej pozycji. */
function posKey(h: RawHole): string {
  return `${h.group}:${Math.round(h.x * 100)}:${Math.round(h.y * 100)}`
}

function mergePilots(raw: RawHole[]): DrillHole[] {
  const result: DrillHole[] = []
  const index = new Map<string, number>() // posKey → indeks w result

  for (const h of raw) {
    const key = posKey(h)

    if (h.diameter < 4) {
      const idx = index.get(key)
      if (idx !== undefined) {
        // Pilot w tej samej pozycji i grupie → merguj z główną dziurą
        const main = result[idx]
        if (!main.pilotDiameter || h.diameter < main.pilotDiameter) {
          main.pilotDiameter = h.diameter
        }
        continue
      }
    }

    const hole: DrillHole = {
      x: h.x,
      y: h.y,
      diameter: h.diameter,
      depth: h.depth,
      group: h.group,
      role: 'hole',
    }
    if (h.feedRate !== undefined) hole.feedRate = h.feedRate

    index.set(key, result.length)
    result.push(hole)
  }

  return result
}
