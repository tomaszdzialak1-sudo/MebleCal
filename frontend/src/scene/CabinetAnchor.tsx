import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import type { Cabinet } from '../model/types'

interface Props {
  cabinet: Cabinet
  onCapture: (obj: THREE.Object3D | null) => void
}

/** Niewidoczny punkt-kotwica w cabinet.position — target dla TransformControls. */
export function CabinetAnchor({ cabinet, onCapture }: Props) {
  const ref = useRef<THREE.Mesh>(null)

  useEffect(() => {
    onCapture(ref.current)
    return () => onCapture(null)
  }, [onCapture])

  const [x, y, z] = cabinet.position
  return (
    <mesh ref={ref} position={[x, y, z]} visible={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial />
    </mesh>
  )
}
