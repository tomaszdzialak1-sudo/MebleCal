import { useMemo } from 'react'
import * as THREE from 'three'
import { useProjectStore } from '../store/projectStore'
import { useViewStore } from '../store/viewStore'
import { checkCollisions } from '../model/collisions'

const toRad3 = (deg: [number, number, number]): [number, number, number] => [
  THREE.MathUtils.degToRad(deg[0]),
  THREE.MathUtils.degToRad(deg[1]),
  THREE.MathUtils.degToRad(deg[2]),
]

/** Czerwone wireframe boksy wokół kolizyjnych płyt. */
export function CollisionMarks() {
  const project = useProjectStore((s) => s.project)
  const showCollisions = useViewStore((s) => s.showCollisions)

  const violations = useMemo(
    () => (showCollisions ? checkCollisions(project) : []),
    [project, showCollisions],
  )

  const collidingIds = useMemo(
    () => new Set(violations.flatMap((v) => v.panelIds)),
    [violations],
  )

  if (!showCollisions || collidingIds.size === 0) return null

  return (
    <>
      {project.panels
        .filter((p) => collidingIds.has(p.id))
        .map((panel) => {
          const xs = panel.contour.map((pt) => pt[0])
          const ys = panel.contour.map((pt) => pt[1])
          const xMin = Math.min(...xs), xMax = Math.max(...xs)
          const yMin = Math.min(...ys), yMax = Math.max(...ys)
          const W = xMax - xMin
          const H = yMax - yMin
          const T = panel.thickness
          const cx = (xMin + xMax) / 2
          const cy = (yMin + yMax) / 2

          return (
            <group
              key={panel.id}
              position={panel.transform.position}
              rotation={toRad3(panel.transform.rotation)}
            >
              <mesh position={[cx, cy, -T / 2]}>
                {/* Lekko powiększony box, żeby wireframe był widoczny ponad płytą. */}
                <boxGeometry args={[W + 2, H + 2, T + 2]} />
                <meshBasicMaterial color="#ef4444" wireframe />
              </mesh>
            </group>
          )
        })}
    </>
  )
}
