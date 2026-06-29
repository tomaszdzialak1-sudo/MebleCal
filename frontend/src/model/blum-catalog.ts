/**
 * Dane katalogowe Blum (CLIP top BLUMOTION) — Faza 5.
 *
 * WSZYSTKIE liczby z katalogu trzymamy jako DANE (nie magic-numbery w logice).
 * Część wartości jest oznaczona „DO WERYFIKACJI" — katalog ich nie wymiaruje
 * jednoznacznie i przyjęliśmy rozsądne założenie.
 *
 * Jednostki: mm. Kąty: stopnie.
 */

// --- Puszka (cup) na froncie -------------------------------------------------
export const CUP_DIAMETER = 35
export const CUP_DEPTH_DEFAULT = 13 // głębokość rozwierty (max wg instrukcji)
export const TB_MIN = 3
export const TB_MAX = 7
export const TB_DEFAULT = 5
export const CUP_FIXING_SPACING = 45
export const CUP_FIXING_OFFSET_FROM_CUP_CENTER = 9.5
export const CUP_SCREW_DIAMETER = 3.5

/** Środek puszki C: TB/B jest od krawędzi drzwi do krawędzi otworu Ø35. */
export function cupCenterDistance(tb: number, cupDiameter = CUP_DIAMETER): number {
  return tb + cupDiameter / 2
}

// --- Prowadnik (montageplatte) na boku — SYSTEM 32 (twarde liczby) -----------
export const PLATE_HOLE_SPACING = 32 // rozstaw 2 otworów (system 32)
export const PLATE_FRONT_OFFSET = 37 // odległość osi otworów od PRZEDNIEJ krawędzi boku
export const PLATE_HOLE_DIAMETER = 5 // nawiert systemowy pod prowadnik
export const SCREW_PILOT_DEPTH = 11 // głębokość nawiertu pod wkręt (typowa)

// --- Nałożenie (nakładane, fabryczne) ---------------------------------------
// FA = 11 − MD + TB  (MD = plate.distance „D"); dla MD=0 → FA = 11 + TB.
export function overlay(tb: number, plateDistance: number): number {
  return 11 - plateDistance + tb
}

// --- Tabela SZCZELINY F = f(TB, grubość frontu) — DOKŁADNIE z katalogu -------
// Kolumny = grubość frontu (mm); wiersze = TB.
export const F_THICKNESSES = [16, 18, 19, 20, 21, 22, 23, 24, 25, 26] as const
const F_BY_TB: Record<number, number[]> = {
  3: [0.5, 0.8, 1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.5, 4.3],
  4: [0.5, 0.8, 1.0, 1.2, 1.4, 1.7, 2.0, 2.5, 3.1, 3.8],
  5: [0.5, 0.8, 0.9, 1.2, 1.4, 1.7, 2.0, 2.4, 2.9, 3.4],
  6: [0.5, 0.8, 0.9, 1.2, 1.3, 1.6, 1.9, 2.3, 2.7, 3.2],
  7: [0.5, 0.8, 0.9, 1.1, 1.3, 1.6, 1.9, 2.2, 2.6, 3.0],
}
// Fronty 28/30 mm — katalog podaje „wartość specjalna": NIE zgadujemy liczby.
const F_SPECIAL_THICKNESS = new Set([28, 30])

export interface GapResult {
  value: number | null
  note?: string
}

/** Szczelina F dla danego TB i grubości frontu. null = poza tabelą (z notką). */
export function gapF(tb: number, frontThickness: number): GapResult {
  if (F_SPECIAL_THICKNESS.has(frontThickness)) {
    return { value: null, note: 'front 28/30 mm — zalecana próba montażu (katalog nie podaje liczby)' }
  }
  const row = F_BY_TB[Math.round(tb)]
  const col = F_THICKNESSES.indexOf(frontThickness as (typeof F_THICKNESSES)[number])
  if (!row || col < 0) {
    return { value: null, note: `brak w tabeli (TB ${tb}, front ${frontThickness} mm) — zweryfikuj` }
  }
  return { value: row[col] }
}

// --- Otwory mocujące puszki (zależnie od wariantu montażu) -------------------
// Konwencja AuxHole: `along` = wzdłuż osi zawiasu (krawędź), `inward` = odsunięcie
// od punktu bazowego wzoru. Dla puszki punktem bazowym jest środek puszki C.
export interface AuxHole {
  along: number
  inward: number
  diameter: number
}

/**
 * Otwory mocowania puszki wg montażu. Wzór Blum 45 / 9.5:
 * 45 = rozstaw wzdłuż osi zawiasu, 9.5 = odsunięcie od środka puszki w głąb frontu.
 */
export function cupMountHoles(mounting: 'screw' | 'inserta' | 'expando'): AuxHole[] {
  if (mounting === 'inserta' || mounting === 'expando') {
    return [
      { along: -CUP_FIXING_SPACING / 2, inward: CUP_FIXING_OFFSET_FROM_CUP_CENTER, diameter: 8 },
      { along: CUP_FIXING_SPACING / 2, inward: CUP_FIXING_OFFSET_FROM_CUP_CENTER, diameter: 8 },
    ]
  }
  // 'screw' — wkręty 3.5 x 17 wg instrukcji montażowej.
  return [
    { along: -CUP_FIXING_SPACING / 2, inward: CUP_FIXING_OFFSET_FROM_CUP_CENTER, diameter: CUP_SCREW_DIAMETER },
    { along: CUP_FIXING_SPACING / 2, inward: CUP_FIXING_OFFSET_FROM_CUP_CENTER, diameter: CUP_SCREW_DIAMETER },
  ]
}

/** Wzór mocowania prowadnika (system 32): 2 otwory, ±16 wzdłuż, 37 od krawędzi. */
export function plateHoles(): AuxHole[] {
  return [
    { along: -PLATE_HOLE_SPACING / 2, inward: PLATE_FRONT_OFFSET, diameter: PLATE_HOLE_DIAMETER },
    { along: PLATE_HOLE_SPACING / 2, inward: PLATE_FRONT_OFFSET, diameter: PLATE_HOLE_DIAMETER },
  ]
}

// --- Zakresy regulacji zawiasu (informacyjnie; pod Fazę 7) -------------------
export const ADJUSTMENT = { height: 2, depthPlus: 3, depthMinus: 2, side: 2 } // mm

// --- Rozkład zawiasów na wysokości frontu (progi Blum — ORIENTACYJNE) --------
/** Zalecana liczba zawiasów wg wysokości frontu (mm). */
export function hingeCount(frontHeight: number): number {
  if (frontHeight <= 900) return 2
  if (frontHeight <= 1600) return 3
  if (frontHeight <= 2000) return 4
  return 5
}

/**
 * Pozycje zawiasów (offset od dołu krawędzi zawiasowej) — ORIENTACYJNE.
 * Skrajne ~`margin` od końców, środkowe równomiernie. Liczba do ręcznej zmiany.
 */
export function hingePositions(frontHeight: number, count: number, margin = 100): number[] {
  if (count <= 1) return [frontHeight / 2]
  const first = margin
  const last = frontHeight - margin
  const step = (last - first) / (count - 1)
  return Array.from({ length: count }, (_, i) => Math.round(first + i * step))
}
