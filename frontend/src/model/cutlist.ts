/**
 * Rozkrój — lista formatek do cięcia (pure, bez efektów ubocznych).
 *
 * Dla każdej płyty liczymy wymiary DO CIĘCIA:
 *   • bbox konturu (maxX−minX × maxY−minY) — bez obliczeń CSG,
 *   • odejmujemy settings.bandingThickness od każdej oklejonej krawędzi
 *     (krawędź 0/2 = dół/góra → od wysokości; 1/3 = prawo/lewo → od szerokości),
 *   • grupujemy identyczne formatki (materialId + wymiary + układ oklejonych boków) → qty.
 *
 * NIE emituje operacji, NIE zmienia modelu.
 */
import type { Project } from './types'

export interface CutItem {
  panelId: string         // id pierwszego panelu w grupie
  name: string            // nazwa (pierwszego panelu w grupie)
  materialId: string
  cutW: number            // szerokość do cięcia (po odliczeniu okleiny)
  cutH: number            // wysokość do cięcia
  grainDir?: 0 | 90      // kierunek słoja (z panel.grain.direction)
  bandedEdges: number[]   // indeksy krawędzi (0–3) z ustawionym bandingType
  hasMiter: boolean       // czy jakaś krawędź ma cutAngle≠90
  qty: number
}

export function buildCutList(project: Project): CutItem[] {
  const t = project.settings.bandingThickness ?? 1

  // 1. Policz wymiary cięcia dla każdej płyty.
  const raw: (Omit<CutItem, 'qty'> & { groupKey: string })[] = []

  for (const panel of project.panels) {
    const xs = panel.contour.map((p) => p[0])
    const ys = panel.contour.map((p) => p[1])
    let cutW = Math.max(...xs) - Math.min(...xs)
    let cutH = Math.max(...ys) - Math.min(...ys)

    const bandedEdges: number[] = []
    for (let i = 0; i < panel.edges.length; i++) {
      if (panel.edges[i].bandingType) {
        bandedEdges.push(i)
        // edge 0 = dół, 2 = góra → odejmij od wysokości; 1 = prawo, 3 = lewo → od szerokości
        if (i === 0 || i === 2) cutH -= t
        else cutW -= t
      }
    }

    const hasMiter = panel.edges.some((e) => e.cutAngle !== 90)
    const grainDir = panel.grain?.direction
    const groupKey = `${panel.materialId}|${cutW.toFixed(3)}|${cutH.toFixed(3)}|${[...bandedEdges].sort().join(',')}|${grainDir ?? ''}`

    raw.push({ panelId: panel.id, name: panel.name, materialId: panel.materialId, cutW, cutH, grainDir, bandedEdges, hasMiter, groupKey })
  }

  // 2. Grupuj identyczne formatki.
  const groups = new Map<string, { item: Omit<CutItem, 'qty'>; qty: number }>()
  for (const { groupKey, ...item } of raw) {
    const g = groups.get(groupKey)
    if (g) g.qty++
    else groups.set(groupKey, { item, qty: 1 })
  }

  return [...groups.values()].map(({ item, qty }) => ({ ...item, qty }))
}
