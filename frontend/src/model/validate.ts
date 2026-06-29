/**
 * Miękka walidacja modelu — OSTRZEŻENIA, nie blokady.
 * - otwory (hole) i kieszenie (pocket) na licach front/back poza obrysem płyty;
 * - groove/cutout/pocket ustawione na krawędzi (face:{edge}) — niedozwolone
 *   (geometrycznie bez sensu na czole; tylko hole może być na krawędzi);
 * - ALARM Ø: otwór szerszy niż płaszczyzna, na której leży
 *     • w czole krawędzi: Ø > grubość płyty,
 *     • na licu: okrąg Ø wychodzi poza najbliższą krawędź konturu;
 * - łącznik, którego płyty się nie stykają (Faza 4).
 * Układ współrzędnych operacji — patrz nagłówek types.ts.
 */
import type { Project, Vec2 } from './types'
import { deriveConnectorAnchor, detectRoles } from './connectors'
import { deriveHingeAnchor } from './hinges'
import { gapF, TB_MAX, TB_MIN } from './blum-catalog'
import { isMiterEdge } from './snapping'

/** Test punkt-w-wielokącie (ray casting). */
export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    const hit = yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}

/** Najmniejsza odległość punktu od krawędzi wielokąta (do alarmu Ø na licu). */
export function distanceToBoundary(p: Vec2, poly: Vec2[]): number {
  let min = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j]
    const b = poly[i]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy || 1
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const d = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
    if (d < min) min = d
  }
  return min
}

const isEdgeFace = (face: unknown): boolean =>
  typeof face === 'object' && face !== null && 'edge' in (face as object)

// Typy operacji dozwolone wyłącznie na licach (nie na krawędzi).
const PLANAR_ONLY = new Set(['groove', 'cutout', 'pocket'])

export function collectWarnings(project: Project): string[] {
  const out: string[] = []
  const panelName = (id: string) => project.panels.find((p) => p.id === id)?.name ?? '?'

  for (const panel of project.panels) {
    for (const op of panel.operations) {
      if (isEdgeFace(op.face)) {
        // Na czole dozwolony tylko otwór; reszta to błędne dane (do usunięcia).
        if (PLANAR_ONLY.has(op.type)) {
          out.push(`Płyta „${panel.name}": ${op.type} na krawędzi — niedozwolone, usuń operację`)
        } else if (op.type === 'hole' && op.hole && op.hole.diameter > panel.thickness) {
          out.push(
            `Płyta „${panel.name}": otwór na krawędzi Ø${op.hole.diameter} > grubość ${panel.thickness} mm`,
          )
        }
        continue
      }

      if (op.type === 'hole' && op.hole) {
        const center: Vec2 = [op.hole.x, op.hole.y]
        if (!pointInPolygon(center, panel.contour)) {
          out.push(`Płyta „${panel.name}": otwór poza obrysem (${op.hole.x}, ${op.hole.y})`)
        } else if (distanceToBoundary(center, panel.contour) < op.hole.diameter / 2) {
          // Ø większy niż płaszczyzna w tym miejscu — okrąg wystaje poza krawędź.
          out.push(`Płyta „${panel.name}": otwór Ø${op.hole.diameter} wychodzi poza krawędź płyty`)
        }
      }
      if (op.type === 'pocket' && op.pocket) {
        const outside = op.pocket.path.some((pt) => !pointInPolygon(pt, panel.contour))
        if (outside) out.push(`Płyta „${panel.name}": kieszeń wychodzi poza obrys`)
      }
    }
  }

  // Łączniki: płyty muszą się stykać, żeby otwory miały sens.
  for (const c of project.connectors) {
    const panelA = project.panels.find((p) => p.id === c.panelA)
    const panelB = project.panels.find((p) => p.id === c.panelB)
    if (!panelA || !panelB) {
      out.push(`Łącznik ${c.type}: brak płyty (A=${panelName(c.panelA)}, B=${panelName(c.panelB)})`)
      continue
    }
    const a = deriveConnectorAnchor(panelA, panelB, c.placement)
    if (!a.touching) {
      const reason = !a.onFaceA
        ? `punkt styku wypada poza obrysem płyty „${panelA.name}"`
        : `szczelina ${a.gap.toFixed(1)} mm`
      out.push(`Łącznik ${c.type} (${panelA.name}↔${panelB.name}): płyty nie są poprawnie zestawione (${reason})`)
    }
    // Automat nie potrafi jednoznacznie ustalić lico↔czoło (np. oba czołem / brak
    // wyraźnego styku lico↔czoło) → ostrzeż, nie blokuj. Albo wykrywa odwrotnie.
    const roles = detectRoles(panelA, panelB)
    if (roles.ambiguous && c.type !== 'cam') {
      out.push(
        `Łącznik ${c.type} (${panelA.name}↔${panelB.name}): nie da się jednoznacznie ustalić lico/czoło — ${roles.reason}`,
      )
    } else if (!roles.ambiguous && roles.facePanel.id !== c.panelA) {
      out.push(
        `Łącznik ${c.type} (${panelA.name}↔${panelB.name}): wykryto odwrotny styk (trzpień powinien być na „${roles.facePanel.name}") — użyj „Zamień strony"`,
      )
    }
    if (isMiterEdge(panelB, c.placement.fromEdge)) {
      out.push(
        `Łącznik ${c.type} na krawędzi gerunkowej płyty „${panelB.name}" (cutAngle≠90) — złącze gerunkowe nieobsługiwane w v1`,
      )
    }
  }

  // Okucia (zawiasy Blum)
  for (const h of project.hardware) {
    const hinge = h.hinge
    if (!hinge) continue
    const front = project.panels.find((p) => p.id === hinge.doorPanel)
    const side = project.panels.find((p) => p.id === hinge.sidePanel)
    if (!front || !side) {
      out.push(`Zawias: brak płyty frontu lub boku`)
      continue
    }
    if (hinge.cup.distanceTB < TB_MIN || hinge.cup.distanceTB > TB_MAX) {
      out.push(`Zawias „${front.name}": TB ${hinge.cup.distanceTB} poza zakresem ${TB_MIN}–${TB_MAX}`)
    }
    const g = gapF(hinge.cup.distanceTB, front.thickness)
    if (g.value === null) out.push(`Zawias „${front.name}": ${g.note}`)
    // Czy krawędź zawiasowa frontu spotyka się z bokiem. Środek puszki jest w
    // drzwiach (C = TB + Ø/2), więc nie może być używany jako punkt styku z bokiem.
    hinge.placement.forEach((pl, k) => {
      const a = deriveHingeAnchor(front, side, pl.fromEdge, pl.offset, hinge.cup.distanceTB, hinge.cup.diameter)
      if (!a.touching) {
        out.push(
          `Zawias „${front.name}" #${k + 1}: krawędź zawiasowa nie trafia w bok (szczelina ${a.gap.toFixed(1)} mm) — sprawdź ustawienie/krawędź`,
        )
      }
    })
  }

  return out
}
