import * as THREE from 'three'
import type { Room } from '../model/types'
import { ROOM_SLAB_THICKNESS, ROOM_WALL_THICKNESS } from '../model/defaults'

const toRad3 = (deg: [number, number, number]): [number, number, number] => [
  THREE.MathUtils.degToRad(deg[0]),
  THREE.MathUtils.degToRad(deg[1]),
  THREE.MathUtils.degToRad(deg[2]),
]

// Pomieszczenie = lekki, czysto wizualny obiekt (bez wierceń/rozkroju).
// Powierzchnie renderujemy jako cienkie bryły; grubości są wyłącznie wizualne.
// wallOpacity = krycie ścian (stan widoku, nie modelu).
export function RoomMesh({ room, wallOpacity = 1 }: { room: Room; wallOpacity?: number }) {
  const wallThk = ROOM_WALL_THICKNESS
  const slabThk = ROOM_SLAB_THICKNESS
  const height = room.walls.reduce((m, w) => Math.max(m, w.size[1]), 0) || 2600

  return (
    <group>
      {/* podłoga (z=0) */}
      <mesh position={[0, 0, -slabThk / 2]} receiveShadow>
        <boxGeometry args={[room.floor.size[0], room.floor.size[1], slabThk]} />
        <meshStandardMaterial color={room.floor.color} roughness={0.95} />
      </mesh>

      {/* sufit (z=wysokość) — półprzezroczysty, żeby widzieć wnętrze z góry */}
      <mesh position={[0, 0, height + slabThk / 2]}>
        <boxGeometry args={[room.ceiling.size[0], room.ceiling.size[1], slabThk]} />
        <meshStandardMaterial color={room.ceiling.color} transparent opacity={0.35} roughness={0.95} />
      </mesh>

      {/* ściany: lokalnie [długość(X), grubość(Y), wysokość(Z)], obracane wokół Z */}
      {room.walls.map((w) => (
        <mesh key={w.id} position={w.transform.position} rotation={toRad3(w.transform.rotation)}>
          <boxGeometry args={[w.size[0], wallThk, w.size[1]]} />
          <meshStandardMaterial
            color={w.color}
            roughness={0.95}
            side={THREE.DoubleSide}
            transparent={wallOpacity < 1}
            opacity={wallOpacity}
          />
        </mesh>
      ))}
    </group>
  )
}
