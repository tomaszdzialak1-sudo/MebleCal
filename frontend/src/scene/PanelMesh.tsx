import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import type { Panel } from '../model/types'
import { slabPositions } from '../model/geometry'
import { useViewStore } from '../store/viewStore'
import { OperationMarks } from './OperationMarks'
import { PanelLabels } from './PanelLabels'

const toRad3 = (deg: [number, number, number]): [number, number, number] => [
  THREE.MathUtils.degToRad(deg[0]),
  THREE.MathUtils.degToRad(deg[1]),
  THREE.MathUtils.degToRad(deg[2]),
]

const BANDING_Z = 0.5 // mm — pasek obrzeża minimalnie nad licem 'front' (anty z-fight)

interface Props {
  panel: Panel
  selected: boolean
  onSelect: () => void
  /** Przekaż obiekt 3D do gizma, gdy ta płyta jest zaznaczona. */
  captureRef?: (obj: THREE.Object3D | null) => void
}

export function PanelMesh({ panel, selected, onSelect, captureRef }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const showLabels = useViewStore((s) => s.showLabels)

  // Bryła z konturu + grubości + cutAngle per krawędź (p. model/geometry.ts):
  // lico 'front' (kontur) na z=0, materiał ku −Z, boki ścięte wg cutAngle.
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const positions = slabPositions(panel.contour, panel.edges, panel.thickness)
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.computeVertexNormals()
    return g
  }, [panel.contour, panel.edges, panel.thickness])

  useEffect(() => () => geometry.dispose(), [geometry])

  // Udostępnij grupę gizmu, kiedy zaznaczona; wyczyść przy odznaczeniu/odmontowaniu.
  useEffect(() => {
    if (!captureRef) return
    captureRef(groupRef.current)
    return () => captureRef(null)
  }, [captureRef])

  // Krawędzie z obrzeżem → zielony pasek wzdłuż boku na licu 'front'.
  const bandedEdges = useMemo(() => {
    const n = panel.contour.length
    return panel.edges
      .map((e, i) => {
        if (!e.bandingType) return null
        const a = panel.contour[i]
        const b = panel.contour[(i + 1) % n]
        return {
          i,
          points: [
            [a[0], a[1], BANDING_Z],
            [b[0], b[1], BANDING_Z],
          ] as [number, number, number][],
        }
      })
      .filter((x): x is { i: number; points: [number, number, number][] } => x !== null)
  }, [panel.contour, panel.edges])

  return (
    <group
      ref={groupRef}
      position={panel.transform.position}
      rotation={toRad3(panel.transform.rotation)}
    >
      <mesh
        geometry={geometry}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        <meshStandardMaterial
          color={selected ? '#f59e0b' : '#c9a36a'}
          emissive={selected ? '#7c3a00' : '#000000'}
          roughness={0.7}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {bandedEdges.map((edge) => (
        <Line key={edge.i} points={edge.points} color="#34d399" lineWidth={3} />
      ))}

      <OperationMarks panel={panel} />
      {selected && showLabels && <PanelLabels panel={panel} />}
    </group>
  )
}
