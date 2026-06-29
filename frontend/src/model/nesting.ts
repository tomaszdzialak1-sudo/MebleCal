/**
 * Nesting gilotynowy (pure).
 *
 * Heurystyka: FF-Decreasing + podział gilotynowy z wyborem dłuższej osi.
 * Każdy materiał nestuje osobno (jeden `Material` na wywołanie).
 * Słój: jeśli materiał ma hasGrain LUB panel ma grain.direction → brak obrotu.
 * Wielokrotności (qty) są rozwijane wewnętrznie.
 *
 * NIE zmienia modelu, NIE emituje operacji.
 */
import type { Material } from './types'
import type { CutItem } from './cutlist'

export interface Placement {
  panelId: string
  name: string
  x: number
  y: number
  w: number
  h: number
}

export interface NestSheet {
  placements: Placement[]
  wastePct: number // 0–1 (udział nieużytego materiału)
}

export interface NestResult {
  sheets: NestSheet[]
  sheetCount: number
  totalWastePct: number
}

interface Piece {
  panelId: string
  name: string
  w: number
  h: number
  canRotate: boolean
}

interface FreeRect {
  x: number
  y: number
  w: number
  h: number
}

/** Indeks najlepiej pasującego wolnego prostokąta (min. obszar ≥ pw×ph). */
function bestFitIdx(rects: FreeRect[], pw: number, ph: number): number {
  let best = -1
  let bestArea = Infinity
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    if (r.w >= pw && r.h >= ph) {
      const a = r.w * r.h
      if (a < bestArea) { bestArea = a; best = i }
    }
  }
  return best
}

/**
 * Umieść element (pw×ph) w wybranym wolnym prostokącie (idx), dodaj dwie
 * nowe wolne przestrzenie (podział gilotynowy wzdłuż dłuższej wolnej osi).
 */
function place(
  rects: FreeRect[],
  placements: Placement[],
  usedRef: { v: number },
  idx: number,
  pw: number,
  ph: number,
  panelId: string,
  name: string,
  kerf: number,
): void {
  const r = rects[idx]
  placements.push({ panelId, name, x: r.x, y: r.y, w: pw, h: ph })
  usedRef.v += pw * ph
  rects.splice(idx, 1)

  const remW = r.w - pw - kerf
  const remH = r.h - ph - kerf

  if (remW >= remH) {
    // Podział pionowy: duży prostokąt po prawej (pełna wysokość), mały pas nad formatką.
    if (remW > 0) rects.push({ x: r.x + pw + kerf, y: r.y, w: remW, h: r.h })
    if (remH > 0) rects.push({ x: r.x, y: r.y + ph + kerf, w: pw, h: remH })
  } else {
    // Podział poziomy: duży prostokąt powyżej (pełna szerokość), mały pas po prawej.
    if (remH > 0) rects.push({ x: r.x, y: r.y + ph + kerf, w: r.w, h: remH })
    if (remW > 0) rects.push({ x: r.x + pw + kerf, y: r.y, w: remW, h: ph })
  }
}

export function nest(items: CutItem[], material: Material, kerf: number): NestResult {
  const k = Math.max(0, kerf)
  const sheetW = material.sheet.w
  const sheetH = material.sheet.h

  // Rozwiń qty → indywidualne elementy do ułożenia.
  const pieces: Piece[] = []
  for (const item of items) {
    const canRotate = item.grainDir === undefined && !material.hasGrain
    for (let i = 0; i < item.qty; i++) {
      pieces.push({
        panelId: item.panelId,
        name: item.qty > 1 ? `${item.name} (${i + 1}/${item.qty})` : item.name,
        w: item.cutW,
        h: item.cutH,
        canRotate,
      })
    }
  }

  // Sortuj malejąco po polu (largest-first).
  pieces.sort((a, b) => b.w * b.h - a.w * a.h)

  const sheets: { placements: Placement[]; freeRects: FreeRect[]; used: { v: number } }[] = []

  const newSheet = () => {
    sheets.push({ placements: [], freeRects: [{ x: 0, y: 0, w: sheetW, h: sheetH }], used: { v: 0 } })
  }

  for (const piece of pieces) {
    const { panelId, name, w, h, canRotate } = piece
    let placed = false

    for (const sh of sheets) {
      const i = bestFitIdx(sh.freeRects, w, h)
      if (i >= 0) { place(sh.freeRects, sh.placements, sh.used, i, w, h, panelId, name, k); placed = true; break }
      if (canRotate && w !== h) {
        const j = bestFitIdx(sh.freeRects, h, w)
        if (j >= 0) { place(sh.freeRects, sh.placements, sh.used, j, h, w, panelId, name, k); placed = true; break }
      }
    }

    if (!placed) {
      newSheet()
      const sh = sheets[sheets.length - 1]
      const i = bestFitIdx(sh.freeRects, w, h)
      if (i >= 0) {
        place(sh.freeRects, sh.placements, sh.used, i, w, h, panelId, name, k)
      } else if (canRotate && w !== h) {
        const j = bestFitIdx(sh.freeRects, h, w)
        if (j >= 0) place(sh.freeRects, sh.placements, sh.used, j, h, w, panelId, name, k)
        // Jeśli element większy niż arkusz: ląduje poza zakresem (odpad 100%),
        // ale nie blokuje nestingu pozostałych elementów.
        else sh.placements.push({ panelId, name, x: 0, y: 0, w, h })
      } else {
        sh.placements.push({ panelId, name, x: 0, y: 0, w, h })
      }
    }
  }

  const sheetArea = sheetW * sheetH
  const nestSheets: NestSheet[] = sheets.map((s) => ({
    placements: s.placements,
    wastePct: sheetArea > 0 ? Math.max(0, 1 - s.used.v / sheetArea) : 0,
  }))

  const totalUsed = sheets.reduce((acc, s) => acc + s.used.v, 0)
  const totalArea = sheets.length * sheetArea
  return {
    sheets: nestSheets,
    sheetCount: sheets.length,
    totalWastePct: totalArea > 0 ? Math.max(0, 1 - totalUsed / totalArea) : 0,
  }
}
