import { useMemo } from 'react'
import { Billboard, Text } from '@react-three/drei'
import type { Panel } from '../model/types'
import { backContour, edgeFrame } from '../model/geometry'

// Subtelne oznaczenia orientacji na ZAZNACZONEJ płycie (lokalny układ płyty —
// renderowane wewnątrz grupy z transformem). Stan widoku, nie model.

const centroid = (pts: [number, number][]): [number, number] => {
  const c = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0])
  return [c[0] / pts.length, c[1] / pts.length]
}

const FACE_COLOR = '#38bdf8'
const EDGE_COLOR = '#fbbf24'

export function PanelLabels({ panel }: { panel: Panel }) {
  const t = panel.thickness
  const n = panel.contour.length

  const front = useMemo(() => centroid(panel.contour as [number, number][]), [panel.contour])
  const back = useMemo(
    () => centroid(backContour(panel.contour, panel.edges, t) as [number, number][]),
    [panel.contour, panel.edges, t],
  )

  // skala tekstu ~ proporcjonalna do płyty, w rozsądnych granicach
  const size = useMemo(() => {
    const xs = panel.contour.map((p) => p[0])
    const ys = panel.contour.map((p) => p[1])
    const d = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
    return Math.max(20, Math.min(60, d / 8))
  }, [panel.contour])

  return (
    <group>
      {/* lico 'front' (z=0, +Z) */}
      <Billboard position={[front[0], front[1], 2]}>
        <Text fontSize={size} color={FACE_COLOR} outlineWidth={size * 0.06} outlineColor="#0a0a0a">
          front
        </Text>
      </Billboard>
      {/* lico 'back' (z=−t) */}
      <Billboard position={[back[0], back[1], -t - 2]}>
        <Text fontSize={size} color={FACE_COLOR} outlineWidth={size * 0.06} outlineColor="#0a0a0a">
          back
        </Text>
      </Billboard>

      {/* numery krawędzi w połowie boku, na wysokości środka grubości */}
      {Array.from({ length: n }, (_, i) => {
        const { a, b, inward } = edgeFrame(panel.contour, i)
        const mx = (a[0] + b[0]) / 2 + inward[0] * size * 0.6
        const my = (a[1] + b[1]) / 2 + inward[1] * size * 0.6
        return (
          <Billboard key={i} position={[mx, my, -t / 2]}>
            <Text
              fontSize={size * 0.85}
              color={EDGE_COLOR}
              outlineWidth={size * 0.05}
              outlineColor="#0a0a0a"
            >
              {`${i}`}
            </Text>
          </Billboard>
        )
      })}
    </group>
  )
}
